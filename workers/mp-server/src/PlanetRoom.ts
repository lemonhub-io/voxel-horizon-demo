/**
 * PlanetRoom — public multiplayer session Durable Object.
 *
 * Session-only: all state is in-memory. No save hosting / no SQLite world archive.
 * When the last player leaves, the room is free to be reclaimed (cold start resets world).
 */
import { DurableObject } from 'cloudflare:workers';
import {
  CHUNK,
  MP_MAX_PLAYERS,
  MP_PROTOCOL_VERSION,
  MP_REACH,
  MP_REACH_SLACK,
  WORLD_H,
  type AnimCode,
  type ClientMsg,
  type EditEntry,
  type PlayerSnap,
  type ServerMsg,
  chunkKey,
  decodeClientMsg,
  encodeMsg,
  localIdx,
  parseChunkKey,
} from './protocol';

export interface RoomStatus {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  seed: number;
  palIdx: number;
  planetName: string;
  full: boolean;
}

interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  anim: AnimCode;
  flags: number;
  lastSeq: number;
  joined: boolean;
}

interface Attachment {
  playerId: string;
}

const PAL_COUNT = 4;

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYL_A = ['泽', '辉', '苍', '玄', '星', '岚', '烬', '霜', '潮', '烬'];
const SYL_B = ['界', '域', '渊', '环', '礁', '原', '海', '漠', '林', '湾'];

function planetName(rng: () => number): string {
  return SYL_A[Math.floor(rng() * SYL_A.length)] + SYL_B[Math.floor(rng() * SYL_B.length)];
}

export class PlanetRoom extends DurableObject {
  private roomId = '';
  private seed = 0;
  private palIdx = 0;
  private planetName = '未知';
  private time = 0.28;
  private started = false;
  /** chunkKey -> (localIdx -> blockId) — session memory only */
  private edits = new Map<string, Map<number, number>>();
  private players = new Map<string, PlayerState>();

  private ensureWorld(): void {
    if (this.started) return;
    this.started = true;
    this.seed = Math.floor(Math.random() * 1e9);
    this.palIdx = Math.floor(Math.random() * PAL_COUNT);
    const rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.planetName = planetName(rng);
    this.time = 0.28;
    this.edits.clear();
  }

  private resetIfEmpty(): void {
    if (this.players.size === 0) {
      this.started = false;
      this.edits.clear();
    }
  }

  async getStatus(roomId: string): Promise<RoomStatus> {
    this.roomId = roomId || this.roomId;
    if (!this.started && this.players.size === 0) {
      // Lazy preview for empty public shard (not persisted).
      this.ensureWorld();
    }
    return {
      roomId: this.roomId || roomId,
      playerCount: this.players.size,
      maxPlayers: MP_MAX_PLAYERS,
      seed: this.seed,
      palIdx: this.palIdx,
      planetName: this.planetName,
      full: this.players.size >= MP_MAX_PLAYERS,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room') || this.roomId || 'public-0';
    this.roomId = roomId;

    if (url.pathname.endsWith('/status') || url.searchParams.get('status') === '1') {
      const status = await this.getStatus(roomId);
      return Response.json(status);
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    this.ensureWorld();
    if (this.players.size >= MP_MAX_PLAYERS) {
      return new Response('Room full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const playerId = crypto.randomUUID();
    server.serializeAttachment({ playerId } satisfies Attachment);
    this.players.set(playerId, {
      id: playerId,
      name: '远行者',
      x: 8,
      y: 40,
      z: 8,
      yaw: 0,
      pitch: 0,
      anim: 0,
      flags: 0,
      lastSeq: 0,
      joined: false,
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    const msg = decodeClientMsg(message);
    if (!msg) return;

    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.playerId) return;
    const player = this.players.get(att.playerId);
    if (!player) return;

    switch (msg.t) {
      case 'join':
        this.handleJoin(ws, player, msg);
        break;
      case 'pose':
        this.handlePose(ws, player, msg);
        break;
      case 'block_set':
        this.handleBlockSet(ws, player, msg);
        break;
      case 'ping':
        this.send(ws, { t: 'pong', n: msg.n });
        break;
      default:
        break;
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.playerId) return;
    const player = this.players.get(att.playerId);
    this.players.delete(att.playerId);
    if (player?.joined) {
      this.broadcast({ t: 'player_leave', id: att.playerId }, ws);
    }
    this.resetIfEmpty();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, 'error');
    } catch {
      /* ignore */
    }
  }

  private handleJoin(ws: WebSocket, player: PlayerState, msg: Extract<ClientMsg, { t: 'join' }>): void {
    if (msg.v !== MP_PROTOCOL_VERSION) {
      this.send(ws, { t: 'error', reason: '协议版本不匹配，请更新客户端' });
      try {
        ws.close(1002, 'version');
      } catch {
        /* ignore */
      }
      return;
    }
    const name = (msg.name || '远行者').slice(0, 16);
    player.name = name;
    player.joined = true;

    const edits = this.serializeEdits();
    const others = [...this.players.values()]
      .filter((p) => p.id !== player.id && p.joined)
      .map((p) => this.toSnap(p));

    this.send(ws, {
      t: 'hello',
      v: MP_PROTOCOL_VERSION,
      roomId: this.roomId,
      you: player.id,
      seed: this.seed,
      palIdx: this.palIdx,
      planetName: this.planetName,
      time: this.time,
      edits,
      players: others,
    });

    this.broadcast({ t: 'player_join', player: this.toSnap(player) }, ws);
  }

  private handlePose(ws: WebSocket, player: PlayerState, msg: Extract<ClientMsg, { t: 'pose' }>): void {
    if (!player.joined) return;
    if (msg.seq <= player.lastSeq) return;
    // Soft anti-teleport: clamp step (session trust, not anti-cheat hard)
    const dx = msg.x - player.x;
    const dy = msg.y - player.y;
    const dz = msg.z - player.z;
    const dist = Math.hypot(dx, dy, dz);
    if (player.lastSeq > 0 && dist > 40) {
      // ignore extreme jump; keep last pose
      return;
    }
    player.lastSeq = msg.seq;
    player.x = msg.x;
    player.y = msg.y;
    player.z = msg.z;
    player.yaw = msg.yaw;
    player.pitch = msg.pitch;
    player.anim = msg.anim;
    player.flags = msg.flags;

    this.broadcast(
      {
        t: 'pose',
        id: player.id,
        seq: msg.seq,
        x: msg.x,
        y: msg.y,
        z: msg.z,
        yaw: msg.yaw,
        pitch: msg.pitch,
        anim: msg.anim,
        flags: msg.flags,
      },
      ws,
    );
  }

  private handleBlockSet(ws: WebSocket, player: PlayerState, msg: Extract<ClientMsg, { t: 'block_set' }>): void {
    if (!player.joined) return;
    const { x, y, z, id, seq } = msg;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || !Number.isInteger(id)) {
      this.send(ws, { t: 'block_reject', x, y, z, id: 0, reason: 'invalid', seq });
      return;
    }
    if (y < 1 || y >= WORLD_H || id < 0 || id > 32) {
      this.send(ws, { t: 'block_reject', x, y, z, id: this.getBlock(x, y, z), reason: 'bounds', seq });
      return;
    }
    const reach = MP_REACH + MP_REACH_SLACK;
    const dist = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y, z + 0.5 - player.z);
    if (dist > reach + 2) {
      this.send(ws, { t: 'block_reject', x, y, z, id: this.getBlock(x, y, z), reason: 'reach', seq });
      return;
    }

    this.setEdit(x, y, z, id);
    this.broadcast({ t: 'block_set', x, y, z, id, by: player.id });
  }

  private getBlock(gx: number, gy: number, gz: number): number {
    const cx = Math.floor(gx / CHUNK);
    const cz = Math.floor(gz / CHUNK);
    const lx = gx - cx * CHUNK;
    const lz = gz - cz * CHUNK;
    const map = this.edits.get(chunkKey(cx, cz));
    if (!map) return -1; // unknown (client has terrain)
    const v = map.get(localIdx(lx, gy, lz));
    return v === undefined ? -1 : v;
  }

  private setEdit(gx: number, gy: number, gz: number, id: number): void {
    const cx = Math.floor(gx / CHUNK);
    const cz = Math.floor(gz / CHUNK);
    const lx = gx - cx * CHUNK;
    const lz = gz - cz * CHUNK;
    const k = chunkKey(cx, cz);
    let map = this.edits.get(k);
    if (!map) {
      map = new Map();
      this.edits.set(k, map);
    }
    map.set(localIdx(lx, gy, lz), id);
  }

  private serializeEdits(): EditEntry[] {
    const out: EditEntry[] = [];
    for (const [k, map] of this.edits) {
      const parsed = parseChunkKey(k);
      if (!parsed) continue;
      for (const [idx, id] of map) {
        out.push({ cx: parsed.cx, cz: parsed.cz, idx, id });
      }
    }
    return out;
  }

  private toSnap(p: PlayerState): PlayerSnap {
    return {
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      anim: p.anim,
      flags: p.flags,
    };
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(encodeMsg(msg));
    } catch {
      /* ignore */
    }
  }

  private broadcast(msg: ServerMsg, except?: WebSocket): void {
    const data = encodeMsg(msg);
    for (const client of this.ctx.getWebSockets()) {
      if (except && client === except) continue;
      try {
        client.send(data);
      } catch {
        /* ignore */
      }
    }
  }
}
