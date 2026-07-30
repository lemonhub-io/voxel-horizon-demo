/**
 * OfficialRoom — DO-authoritative public server.
 *
 * - World authority lives in this Durable Object (not a player host).
 * - Edits hydrate from R2 (S3 API / binding) + DO storage fallback.
 * - Dirty worlds flush to R2 on a throttle / last player leave.
 * - First-account Worker reverse-proxies second-account R2 via secrets.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  MP_MAX_PLAYERS,
  MP_PROTOCOL_VERSION,
  OFFICIAL_DEFAULT,
  OFFICIAL_ROOM_ID,
  R2_FLUSH_MS,
  WORLD_CHUNK,
  WORLD_H,
  WORLD_REACH,
  type AnimCode,
  type ClientMsg,
  type PlayerSnap,
  type ServerMsg,
  decodeClientMsg,
  encodeMsg,
} from './protocol';
import type { WorldSaveV1 } from './protocol';
import {
  applyEditEntry,
  defaultWorldSave,
  describeR2Backend,
  editsMapToList,
  loadWorldFromR2Binding,
  loadWorldFromR2S3,
  recordToEditsMap,
  saveWorldToR2Binding,
  saveWorldToR2S3,
  worldToSave,
} from './worldSave';

export interface OfficialEnv {
  OFFICIAL_ROOM: DurableObjectNamespace;
  /** Same-account R2 binding (optional). */
  WORLD_SAVES?: R2Bucket;
  /** Cross-account R2 S3 credentials (preferred when R2 is on another account). */
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
}

interface Attachment {
  playerId: string;
  joined: boolean;
}

interface PoseState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  anim: AnimCode;
  flags: number;
  seq: number;
}

const STORAGE_KEY = 'world-v1';

export class OfficialRoom extends DurableObject<OfficialEnv> {
  private hydrated = false;
  private dirty = false;
  private flushScheduled = false;
  private seed: number = OFFICIAL_DEFAULT.seed;
  private palIdx: number = OFFICIAL_DEFAULT.palIdx;
  private planetName: string = OFFICIAL_DEFAULT.planetName;
  private time: number = OFFICIAL_DEFAULT.time;
  private edits = new Map<string, Map<number, number>>();
  private poses = new Map<string, PoseState>();
  private peers = new Set<string>();

  async fetch(request: Request): Promise<Response> {
    await this.ensureHydrated();

    const url = new URL(request.url);

    // Internal status for HTTP API
    if (url.pathname.endsWith('/status') || url.searchParams.get('status') === '1') {
      return Response.json({
        roomId: OFFICIAL_ROOM_ID,
        worldBackend: describeR2Backend(this.env),
        playerCount: this.peers.size,
        maxPlayers: MP_MAX_PLAYERS,
        seed: this.seed,
        palIdx: this.palIdx,
        planetName: this.planetName,
        live: true,
        mode: 'official',
        editChunks: this.edits.size,
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    if (this.peers.size >= MP_MAX_PLAYERS) {
      return new Response('Room full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const playerId = crypto.randomUUID();
    server.serializeAttachment({ playerId, joined: false } satisfies Attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    const msg = decodeClientMsg(message);
    if (!msg) return;

    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.playerId) return;

    switch (msg.t) {
      case 'hello':
        await this.handleHello(ws, att, msg);
        break;
      case 'pose':
        if (!att.joined) return;
        this.poses.set(att.playerId, {
          x: msg.x,
          y: msg.y,
          z: msg.z,
          yaw: msg.yaw,
          pitch: msg.pitch,
          anim: msg.anim,
          flags: msg.flags,
          seq: msg.seq,
        });
        this.broadcast(
          {
            t: 'pose',
            id: att.playerId,
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
        break;
      case 'block_set':
        if (!att.joined) return;
        this.handleBlockSet(ws, att.playerId, msg);
        break;
      case 'state_req':
        if (!att.joined) return;
        this.send(ws, this.buildSnapshot());
        break;
      case 'ping':
        this.send(ws, { t: 'pong', n: msg.n });
        break;
      default:
        // Ignore host-only messages on official server
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.playerId) return;
    const id = att.playerId;
    const wasJoined = this.peers.has(id);
    this.peers.delete(id);
    this.poses.delete(id);
    if (wasJoined) {
      this.broadcast({ t: 'peer_leave', id }, ws);
    }
    if (this.peers.size === 0 && this.dirty) {
      await this.flushNow();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'error');
    } catch {
      /* ignore */
    }
  }

  async alarm(): Promise<void> {
    this.flushScheduled = false;
    if (this.dirty) {
      await this.flushNow();
    }
  }

  private async handleHello(
    ws: WebSocket,
    att: Attachment,
    msg: Extract<ClientMsg, { t: 'hello' }>,
  ): Promise<void> {
    await this.ensureHydrated();

    if (msg.v !== MP_PROTOCOL_VERSION) {
      this.send(ws, { t: 'error', reason: '协议版本不匹配' });
      try {
        ws.close(1002, 'version');
      } catch {
        /* ignore */
      }
      return;
    }

    // Official clients use role "player" (also accept "guest" for simplicity).
    if (msg.role === 'host') {
      this.send(ws, { t: 'error', reason: '官方服不支持玩家房主' });
      try {
        ws.close(4001, 'no host role');
      } catch {
        /* ignore */
      }
      return;
    }

    if (this.peers.size >= MP_MAX_PLAYERS) {
      this.send(ws, { t: 'error', reason: '官方服已满' });
      try {
        ws.close(4003, 'full');
      } catch {
        /* ignore */
      }
      return;
    }

    att.joined = true;
    ws.serializeAttachment(att);
    this.peers.add(att.playerId);

    this.send(ws, {
      t: 'welcome',
      v: MP_PROTOCOL_VERSION,
      roomId: OFFICIAL_ROOM_ID,
      you: att.playerId,
      isHost: false,
      hostId: null,
      playerCount: this.peers.size,
      mode: 'official',
    });

    this.broadcast({ t: 'peer_join', id: att.playerId }, ws);
    this.send(ws, this.buildSnapshot());
  }

  private handleBlockSet(
    ws: WebSocket,
    from: string,
    msg: Extract<ClientMsg, { t: 'block_set' }>,
  ): void {
    const { x, y, z, id, seq } = msg;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      this.send(ws, { t: 'block_reject', x, y, z, id: 0, reason: 'bad coords', seq });
      return;
    }
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (iy < 1 || iy >= WORLD_H || id < 0 || id > 32) {
      this.send(ws, { t: 'block_reject', x: ix, y: iy, z: iz, id: 0, reason: 'bounds', seq });
      return;
    }

    const pose = this.poses.get(from);
    if (pose) {
      const dist = Math.hypot(ix + 0.5 - pose.x, iy + 0.5 - pose.y, iz + 0.5 - pose.z);
      if (dist > WORLD_REACH + 3) {
        this.send(ws, { t: 'block_reject', x: ix, y: iy, z: iz, id: 0, reason: 'reach', seq });
        return;
      }
    }

    const cx = Math.floor(ix / WORLD_CHUNK);
    const cz = Math.floor(iz / WORLD_CHUNK);
    const lx = ((ix % WORLD_CHUNK) + WORLD_CHUNK) % WORLD_CHUNK;
    const lz = ((iz % WORLD_CHUNK) + WORLD_CHUNK) % WORLD_CHUNK;
    const idx = lx + WORLD_CHUNK * (lz + WORLD_CHUNK * iy);
    applyEditEntry(this.edits, cx, cz, idx, id);
    this.dirty = true;
    this.scheduleFlush();

    this.broadcast({
      t: 'block_apply',
      x: ix,
      y: iy,
      z: iz,
      id,
      by: from,
    });
  }

  private buildSnapshot(): Extract<ServerMsg, { t: 'state_snapshot' }> {
    const players: PlayerSnap[] = [];
    for (const [id, p] of this.poses) {
      players.push({
        id,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        anim: p.anim,
        flags: p.flags,
      });
    }
    return {
      t: 'state_snapshot',
      seed: this.seed,
      palIdx: this.palIdx,
      planetName: this.planetName,
      time: this.time,
      edits: editsMapToList(this.edits),
      players,
      hostId: 'server',
      mode: 'official',
    };
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;

    // 1) Cross-account R2 via S3 API (Worker → R2 backend)
    const fromS3 = await loadWorldFromR2S3(this.env);
    if (fromS3) {
      this.applySave(fromS3);
      await this.persistLocal();
      return;
    }

    // 2) Same-account R2 binding (if ever enabled)
    const fromBinding = await loadWorldFromR2Binding(this.env.WORLD_SAVES);
    if (fromBinding) {
      this.applySave(fromBinding);
      await this.persistLocal();
      return;
    }

    // 3) DO SQLite storage mirror
    const fromStore = await this.ctx.storage.get<WorldSaveV1>(STORAGE_KEY);
    if (fromStore && fromStore.v === 1) {
      this.applySave(fromStore);
      // Push mirror up to R2 when S3 is configured
      void saveWorldToR2S3(this.env, fromStore);
      return;
    }

    // 4) Fresh official default
    this.applySave(defaultWorldSave());
    await this.persistLocal();
    await this.flushToR2(defaultWorldSave());
  }

  private applySave(save: WorldSaveV1): void {
    this.seed = save.seed;
    this.palIdx = save.palIdx;
    this.planetName = save.planetName || OFFICIAL_DEFAULT.planetName;
    this.time = typeof save.time === 'number' ? save.time : OFFICIAL_DEFAULT.time;
    this.edits = recordToEditsMap(save.edits || {});
    this.dirty = false;
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    void this.ctx.storage.setAlarm(Date.now() + R2_FLUSH_MS);
  }

  private async flushNow(): Promise<void> {
    if (!this.dirty) return;
    const blob = worldToSave(
      {
        seed: this.seed,
        palIdx: this.palIdx,
        planetName: this.planetName,
        time: this.time,
      },
      this.edits,
    );
    await this.ctx.storage.put(STORAGE_KEY, blob);
    const ok = await this.flushToR2(blob);
    // DO storage is always written; clear dirty if R2 ok or R2 not configured.
    if (ok || !this.env.R2_ACCESS_KEY_ID) {
      this.dirty = false;
    }
  }

  private async flushToR2(blob: WorldSaveV1): Promise<boolean> {
    const s3 = await saveWorldToR2S3(this.env, blob);
    if (s3) return true;
    return saveWorldToR2Binding(this.env.WORLD_SAVES, blob);
  }

  private async persistLocal(): Promise<void> {
    const blob = worldToSave(
      {
        seed: this.seed,
        palIdx: this.palIdx,
        planetName: this.planetName,
        time: this.time,
      },
      this.edits,
    );
    await this.ctx.storage.put(STORAGE_KEY, blob);
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
