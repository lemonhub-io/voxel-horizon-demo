/**
 * PlanetRoom — WebSocket relay for a host-local multiplayer session.
 *
 * World / player data is owned by the host browser. This DO only:
 * - assigns peer ids
 * - tracks who is host
 * - relays messages (pose, blocks, state snapshots)
 * - updates the public directory heartbeat (via host messages)
 */
import { DurableObject } from 'cloudflare:workers';
import {
  MP_MAX_PLAYERS,
  MP_PROTOCOL_VERSION,
  type ClientMsg,
  type ServerMsg,
  decodeClientMsg,
  encodeMsg,
} from './protocol';
import type { RoomDirectory } from './RoomDirectory';

export interface Env {
  PLANET_ROOM: DurableObjectNamespace;
  ROOM_DIRECTORY: DurableObjectNamespace<RoomDirectory>;
}

interface Attachment {
  playerId: string;
  role: 'host' | 'guest' | 'pending';
}

export class PlanetRoom extends DurableObject<Env> {
  private roomId = '';
  private hostId: string | null = null;
  private peers = new Map<string, { role: 'host' | 'guest' }>();

  private directory() {
    const id = this.env.ROOM_DIRECTORY.idFromName('public-directory');
    return this.env.ROOM_DIRECTORY.get(id);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.roomId = url.searchParams.get('room') || this.roomId || 'unknown';

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
    server.serializeAttachment({ playerId, role: 'pending' } satisfies Attachment);
    this.peers.set(playerId, { role: 'guest' });

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
        this.handleHello(ws, att, msg);
        break;
      case 'host_heartbeat':
        if (att.role === 'host' && att.playerId === this.hostId) {
          await this.directory().upsert({
            roomId: this.roomId,
            planetName: msg.planetName,
            seed: msg.seed,
            palIdx: msg.palIdx,
            playerCount: Math.max(1, msg.playerCount),
          });
        }
        break;
      case 'pose':
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
        // Guest request → host only (with from). Host should send block_apply after local apply.
        if (att.role === 'host') {
          this.broadcast({
            t: 'block_apply',
            x: msg.x,
            y: msg.y,
            z: msg.z,
            id: msg.id,
            by: att.playerId,
          });
        } else {
          this.sendToHostRaw(
            JSON.stringify({
              t: 'block_set',
              x: msg.x,
              y: msg.y,
              z: msg.z,
              id: msg.id,
              seq: msg.seq,
              from: att.playerId,
            }),
          );
        }
        break;
      case 'block_apply':
        if (att.role === 'host') {
          this.broadcast({
            t: 'block_apply',
            x: msg.x,
            y: msg.y,
            z: msg.z,
            id: msg.id,
            by: msg.by || att.playerId,
          });
        }
        break;
      case 'block_reject':
        if (att.role === 'host') {
          this.sendToPlayer(msg.to, {
            t: 'block_reject',
            x: msg.x,
            y: msg.y,
            z: msg.z,
            id: msg.id,
            reason: msg.reason,
            seq: msg.seq,
          });
        }
        break;
      case 'state_req':
        // Tell host someone needs a snapshot
        this.sendToHost({ t: 'state_req', from: att.playerId });
        break;
      case 'state_snapshot':
        if (att.role === 'host') {
          const target = msg.to;
          const payload: ServerMsg = {
            t: 'state_snapshot',
            seed: msg.seed,
            palIdx: msg.palIdx,
            planetName: msg.planetName,
            time: msg.time,
            edits: msg.edits,
            players: msg.players,
            hostId: att.playerId,
          };
          if (target) this.sendToPlayer(target, payload);
          else this.broadcast(payload, ws);
        }
        break;
      case 'ping':
        this.send(ws, { t: 'pong', n: msg.n });
        break;
      default:
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.playerId) return;
    const wasHost = att.playerId === this.hostId;
    this.peers.delete(att.playerId);

    if (wasHost) {
      this.hostId = null;
      await this.directory().remove(this.roomId);
      this.broadcast({ t: 'host_left' }, ws);
      // Kick remaining — host-local data is gone
      for (const client of this.ctx.getWebSockets()) {
        if (client === ws) continue;
        try {
          client.close(4000, 'host left');
        } catch {
          /* ignore */
        }
      }
      this.peers.clear();
      return;
    }

    this.broadcast({ t: 'peer_leave', id: att.playerId }, ws);
    if (this.hostId) {
      // update count on next heartbeat; optional immediate
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'error');
    } catch {
      /* ignore */
    }
  }

  private handleHello(
    ws: WebSocket,
    att: Attachment,
    msg: Extract<ClientMsg, { t: 'hello' }>,
  ): void {
    if (msg.v !== MP_PROTOCOL_VERSION) {
      this.send(ws, { t: 'error', reason: '协议版本不匹配' });
      try {
        ws.close(1002, 'version');
      } catch {
        /* ignore */
      }
      return;
    }

    if (msg.role === 'host') {
      if (this.hostId && this.hostId !== att.playerId) {
        this.send(ws, { t: 'error', reason: '房间已有房主' });
        try {
          ws.close(4001, 'host exists');
        } catch {
          /* ignore */
        }
        return;
      }
      this.hostId = att.playerId;
      att.role = 'host';
      ws.serializeAttachment(att);
      this.peers.set(att.playerId, { role: 'host' });
      void this.directory().upsert({
        roomId: this.roomId,
        planetName: msg.planetName || '未知星域',
        seed: msg.seed ?? 0,
        palIdx: msg.palIdx ?? 0,
        playerCount: 1,
      });
    } else {
      if (!this.hostId) {
        this.send(ws, { t: 'error', reason: '房主尚未就绪' });
        try {
          ws.close(4002, 'no host');
        } catch {
          /* ignore */
        }
        return;
      }
      att.role = 'guest';
      ws.serializeAttachment(att);
      this.peers.set(att.playerId, { role: 'guest' });
      this.broadcast({ t: 'peer_join', id: att.playerId }, ws);
      // Ask host for full state for this guest
      this.sendToHost({ t: 'state_req', from: att.playerId });
    }

    this.send(ws, {
      t: 'welcome',
      v: MP_PROTOCOL_VERSION,
      roomId: this.roomId,
      you: att.playerId,
      isHost: att.role === 'host',
      hostId: this.hostId,
      playerCount: this.peers.size,
    });
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(encodeMsg(msg));
    } catch {
      /* ignore */
    }
  }

  private sendToHost(msg: ServerMsg): void {
    if (!this.hostId) return;
    this.sendToPlayer(this.hostId, msg);
  }

  private sendToHostRaw(data: string): void {
    if (!this.hostId) return;
    for (const client of this.ctx.getWebSockets()) {
      const att = client.deserializeAttachment() as Attachment | null;
      if (att?.playerId === this.hostId) {
        try {
          client.send(data);
        } catch {
          /* ignore */
        }
        return;
      }
    }
  }

  private sendToPlayer(playerId: string, msg: ServerMsg): void {
    for (const client of this.ctx.getWebSockets()) {
      const att = client.deserializeAttachment() as Attachment | null;
      if (att?.playerId === playerId) {
        this.send(client, msg);
        return;
      }
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
