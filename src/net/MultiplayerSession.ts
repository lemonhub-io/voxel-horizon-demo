import type { Game } from '../types';
import { CFG } from '../config';
import { NetClient, type HostInboxMsg } from './NetClient';
import { RemotePlayer } from './RemotePlayer';
import {
  MP_HOST_HEARTBEAT_S,
  animFromKey,
  type AnimCode,
  type EditEntry,
  type PlayerSnap,
  type ServerMsg,
} from './protocol';

/**
 * Host-local multiplayer: world + player data lives on the host browser.
 * Cloudflare only publishes the room list and relays WebSocket messages.
 */
export class MultiplayerSession {
  readonly net = new NetClient();
  private game: Game | null = null;
  private remotes = new Map<string, RemotePlayer>();
  private unsub: (() => void) | null = null;
  private blockSeq = 0;
  private pendingBlocks = new Map<number, { x: number; y: number; z: number; prev: number }>();
  private heartbeatT = 0;
  active = false;
  isHost = false;
  myId = '';
  roomId = '';
  hostId: string | null = null;

  bind(game: Game): void {
    this.game = game;
  }

  /**
   * Host: publish current local world as a public room.
   * Must be called while game is already in play (or after load).
   */
  async hostPublic(game: Game): Promise<void> {
    this.bind(game);
    this.clearRemotes();
    this.unsub?.();
    this.unsub = this.net.onMessage((msg) => this.onMessage(msg));

    const { roomId, wsPath } = await this.net.createRoom();
    this.roomId = roomId;
    await this.net.connect(wsPath);
    this.net.sendHello('host', {
      seed: game.seed,
      palIdx: game.palIdx,
      planetName: game.planetName,
      time: game.sky?.t ?? 0.28,
    });
    this.active = true;
    this.isHost = true;
    this.heartbeatT = 0;
  }

  /** Guest: join a public room id and wait for host state_snapshot. */
  async joinAsGuest(game: Game, roomId: string): Promise<Extract<ServerMsg, { t: 'state_snapshot' }>> {
    this.bind(game);
    this.clearRemotes();
    this.unsub?.();
    this.unsub = this.net.onMessage((msg) => this.onMessage(msg));

    const snapPromise = this.waitSnapshot(20000);
    this.roomId = roomId;
    await this.net.connect(`/ws?room=${encodeURIComponent(roomId)}`);
    this.net.sendHello('guest');
    this.active = true;
    this.isHost = false;
    return snapPromise;
  }

  waitWelcome(timeoutMs = 10000): Promise<Extract<ServerMsg, { t: 'welcome' }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('等待欢迎消息超时'));
      }, timeoutMs);
      const off = this.net.onMessage((msg) => {
        if (msg.t === 'welcome') {
          clearTimeout(timer);
          off();
          resolve(msg);
        }
        if (msg.t === 'error') {
          clearTimeout(timer);
          off();
          reject(new Error(msg.reason));
        }
      });
    });
  }

  waitSnapshot(timeoutMs = 20000): Promise<Extract<ServerMsg, { t: 'state_snapshot' }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('等待房主世界数据超时'));
      }, timeoutMs);
      const off = this.net.onMessage((msg) => {
        if (msg.t === 'state_snapshot') {
          clearTimeout(timer);
          off();
          resolve(msg);
        }
        if (msg.t === 'host_left' || msg.t === 'error') {
          clearTimeout(timer);
          off();
          reject(new Error(msg.t === 'error' ? msg.reason : '房主已离开'));
        }
      });
    });
  }

  leave(): void {
    this.active = false;
    this.isHost = false;
    this.unsub?.();
    this.unsub = null;
    this.net.disconnect();
    this.clearRemotes();
    this.pendingBlocks.clear();
    this.myId = '';
    this.roomId = '';
    this.hostId = null;
  }

  private clearRemotes(): void {
    for (const r of this.remotes.values()) r.dispose();
    this.remotes.clear();
  }

  private collectEdits(): EditEntry[] {
    const g = this.game;
    if (!g?.world) return [];
    const out: EditEntry[] = [];
    for (const [k, map] of g.world.edits) {
      const [cx, cz] = k.split(',').map(Number);
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
      for (const [idx, id] of map) {
        out.push({ cx, cz, idx, id });
      }
    }
    return out;
  }

  private collectPlayersForSnapshot(): PlayerSnap[] {
    const g = this.game;
    const list: PlayerSnap[] = [];
    if (g?.player) {
      const p = g.player;
      list.push({
        id: this.myId || 'host',
        x: p.pos.x,
        y: p.pos.y,
        z: p.pos.z,
        yaw: p.yaw,
        pitch: p.pitch,
        anim: animFromKey(p.getBodyAnimKey?.() || 'idle'),
        flags: p.inShip ? 1 : 0,
      });
    }
    for (const [id, rp] of this.remotes) {
      list.push({
        id,
        x: rp.root.position.x,
        y: rp.root.position.y,
        z: rp.root.position.z,
        yaw: rp.root.rotation.y - Math.PI,
        pitch: 0,
        anim: 0,
        flags: rp.root.visible ? 0 : 1,
      });
    }
    return list;
  }

  private sendSnapshotTo(guestId: string): void {
    const g = this.game;
    if (!g || !this.isHost) return;
    this.net.sendStateSnapshot(
      {
        seed: g.seed,
        palIdx: g.palIdx,
        planetName: g.planetName,
        time: g.sky?.t ?? 0.28,
        edits: this.collectEdits(),
        players: this.collectPlayersForSnapshot(),
      },
      guestId,
    );
  }

  private onMessage(msg: HostInboxMsg): void {
    const g = this.game;
    if (!g) return;

    switch (msg.t) {
      case 'welcome':
        this.myId = msg.you;
        this.roomId = msg.roomId;
        this.isHost = msg.isHost;
        this.hostId = msg.hostId;
        break;

      case 'peer_join':
        if (msg.id !== this.myId) {
          g.hud?.notify?.('有玩家加入了房间', 'info');
        }
        break;

      case 'peer_leave':
        this.removeRemote(msg.id);
        g.hud?.notify?.('有玩家离开了房间', 'info');
        break;

      case 'host_left':
        g.hud?.notify?.('房主已离开，联机结束', 'danger');
        this.leave();
        break;

      case 'pose':
        if (msg.id === this.myId) return;
        {
          let rp = this.remotes.get(msg.id);
          if (!rp) {
            rp = this.spawnRemote({
              id: msg.id,
              x: msg.x,
              y: msg.y,
              z: msg.z,
              yaw: msg.yaw,
              pitch: msg.pitch,
              anim: msg.anim,
              flags: msg.flags,
            });
          }
          rp.applySnap({
            id: msg.id,
            x: msg.x,
            y: msg.y,
            z: msg.z,
            yaw: msg.yaw,
            pitch: msg.pitch,
            anim: msg.anim,
            flags: msg.flags,
          });
        }
        break;

      case 'block_set':
        // Host inbox: guest wants to set a block
        if (this.isHost && 'from' in msg && msg.from) {
          this.hostHandleGuestBlock(msg.from, msg.x, msg.y, msg.z, msg.id, msg.seq);
        }
        break;

      case 'block_apply':
        if (msg.by === this.myId) {
          for (const [seq, p] of this.pendingBlocks) {
            if (p.x === msg.x && p.y === msg.y && p.z === msg.z) this.pendingBlocks.delete(seq);
          }
        }
        // Host already applied locally when they placed; still apply for guests / remote host confirms
        if (!(this.isHost && msg.by === this.myId)) {
          g.world?.setBlock(msg.x, msg.y, msg.z, msg.id);
        }
        break;

      case 'block_reject':
        {
          const pend = this.pendingBlocks.get(msg.seq);
          if (pend) {
            g.world?.setBlock(pend.x, pend.y, pend.z, pend.prev);
            this.pendingBlocks.delete(msg.seq);
          } else if (msg.id >= 0) {
            g.world?.setBlock(msg.x, msg.y, msg.z, msg.id);
          }
          g.hud?.notify?.(`方块同步被拒：${msg.reason}`, 'warn');
        }
        break;

      case 'state_req':
        if (this.isHost && msg.from) {
          this.sendSnapshotTo(msg.from);
        }
        break;

      case 'state_snapshot':
        // Guest path primarily handled by waitSnapshot during join; if already in-world, restore edits + peers.
        if (!this.isHost && g.world) {
          this.applyEdits(msg.edits);
          if (g.sky && typeof msg.time === 'number') g.sky.t = msg.time;
          for (const p of msg.players) {
            if (p.id === this.myId) continue;
            this.spawnRemote(p);
          }
        }
        break;

      case 'error':
        g.hud?.notify?.(msg.reason, 'danger');
        break;

      default:
        break;
    }
  }

  private hostHandleGuestBlock(
    from: string,
    x: number,
    y: number,
    z: number,
    id: number,
    seq: number,
  ): void {
    const g = this.game;
    if (!g?.player || !g.world) return;
    // Soft reach check against host-known guest pose if available
    const rp = this.remotes.get(from);
    const px = rp ? rp.root.position.x : g.player.pos.x;
    const py = rp ? rp.root.position.y : g.player.pos.y;
    const pz = rp ? rp.root.position.z : g.player.pos.z;
    const dist = Math.hypot(x + 0.5 - px, y + 0.5 - py, z + 0.5 - pz);
    if (y < 1 || y >= CFG.WORLD_H || id < 0 || id > 32 || dist > CFG.REACH + 3) {
      this.net.sendBlockReject(from, x, y, z, g.world.getBlock(x, y, z), 'reach', seq);
      return;
    }
    g.world.setBlock(x, y, z, id);
    this.net.sendBlockApply(x, y, z, id, from);
  }

  applyEdits(edits: EditEntry[]): void {
    const g = this.game;
    if (!g?.world) return;
    for (const e of edits) {
      const lx = e.idx % CFG.CHUNK;
      const tmp = Math.floor(e.idx / CFG.CHUNK);
      const lz = tmp % CFG.CHUNK;
      const y = Math.floor(tmp / CFG.CHUNK);
      const gx = e.cx * CFG.CHUNK + lx;
      const gz = e.cz * CFG.CHUNK + lz;
      if (!g.world.setBlock(gx, y, gz, e.id)) {
        const k = `${e.cx},${e.cz}`;
        let m = g.world.edits.get(k);
        if (!m) {
          m = new Map();
          g.world.edits.set(k, m);
        }
        m.set(e.idx, e.id);
      }
    }
  }

  /** Seed remote avatars after late-join world load (host + other guests). */
  seedRemotesFromSnapshot(players: PlayerSnap[]): void {
    for (const p of players) {
      if (p.id === this.myId) continue;
      this.spawnRemote(p);
    }
  }

  private spawnRemote(snap: PlayerSnap): RemotePlayer {
    const existing = this.remotes.get(snap.id);
    if (existing) {
      existing.applySnap(snap);
      return existing;
    }
    const rp = new RemotePlayer(snap);
    this.remotes.set(snap.id, rp);
    this.game?.scene.add(rp.root);
    return rp;
  }

  private removeRemote(id: string): void {
    const rp = this.remotes.get(id);
    if (!rp) return;
    rp.dispose();
    this.remotes.delete(id);
  }

  /**
   * Host: apply locally then broadcast.
   * Guest: predict then request host authority.
   */
  submitBlock(x: number, y: number, z: number, id: number, prevId: number): void {
    if (!this.active || !this.net.connected) return;
    if (this.isHost) {
      this.net.sendBlockApply(x, y, z, id, this.myId || 'host');
      return;
    }
    this.blockSeq++;
    const seq = this.blockSeq;
    this.pendingBlocks.set(seq, { x, y, z, prev: prevId });
    this.net.sendBlockSet(x, y, z, id, seq);
    if (this.pendingBlocks.size > 64) {
      const first = this.pendingBlocks.keys().next().value;
      if (first !== undefined) this.pendingBlocks.delete(first);
    }
  }

  update(dt: number): void {
    if (!this.active || !this.game) return;
    const g = this.game;
    const p = g.player;

    if (this.isHost && this.net.connected) {
      this.heartbeatT += dt;
      if (this.heartbeatT >= MP_HOST_HEARTBEAT_S) {
        this.heartbeatT = 0;
        this.net.sendHostHeartbeat({
          playerCount: 1 + this.remotes.size,
          planetName: g.planetName,
          seed: g.seed,
          palIdx: g.palIdx,
        });
      }
    }

    if (!p || (g.state !== 'play' && g.state !== 'dead')) {
      for (const r of this.remotes.values()) r.update(dt);
      return;
    }

    const animKey = typeof p.getBodyAnimKey === 'function' ? p.getBodyAnimKey() : p.dead ? 'death' : 'idle';
    const anim = animFromKey(animKey) as AnimCode;
    this.net.tickPose(dt, {
      x: p.pos.x,
      y: p.pos.y,
      z: p.pos.z,
      yaw: p.yaw,
      pitch: p.pitch,
      anim,
      flags: p.inShip ? 1 : 0,
    });

    for (const r of this.remotes.values()) r.update(dt);
  }
}

export const multiplayer = new MultiplayerSession();
