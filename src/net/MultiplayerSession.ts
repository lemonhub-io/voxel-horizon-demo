import type { Game } from '../types';
import { CFG } from '../config';
import { NetClient } from './NetClient';
import { RemotePlayer } from './RemotePlayer';
import { animFromKey, type AnimCode, type EditEntry, type ServerMsg } from './protocol';

/**
 * Client-side multiplayer session. Ephemeral public rooms only — no server save.
 */
export class MultiplayerSession {
  readonly net = new NetClient();
  private game: Game | null = null;
  private remotes = new Map<string, RemotePlayer>();
  private unsub: (() => void) | null = null;
  private blockSeq = 0;
  private pendingBlocks = new Map<number, { x: number; y: number; z: number; prev: number }>();
  active = false;
  myId = '';
  roomId = '';
  displayName = '远行者';

  bind(game: Game): void {
    this.game = game;
  }

  async joinPublic(game: Game, name?: string): Promise<void> {
    this.bind(game);
    this.displayName = (name || '远行者').slice(0, 16);
    this.clearRemotes();
    this.unsub?.();
    this.unsub = this.net.onMessage((msg) => this.onServerMsg(msg));

    const join = await this.net.joinPublic(this.displayName);
    this.roomId = join.roomId;
    this.active = true;
    // hello arrives async via handler; beginLoad waits for seed from hello
  }

  /** Wait until hello received (seed known). */
  waitHello(timeoutMs = 10000): Promise<Extract<ServerMsg, { t: 'hello' }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('等待房间数据超时'));
      }, timeoutMs);
      const off = this.net.onMessage((msg) => {
        if (msg.t === 'hello') {
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

  leave(): void {
    this.active = false;
    this.unsub?.();
    this.unsub = null;
    this.net.disconnect();
    this.clearRemotes();
    this.pendingBlocks.clear();
    this.myId = '';
    this.roomId = '';
  }

  private clearRemotes(): void {
    for (const r of this.remotes.values()) r.dispose();
    this.remotes.clear();
  }

  private onServerMsg(msg: ServerMsg): void {
    const g = this.game;
    if (!g) return;

    switch (msg.t) {
      case 'hello':
        this.myId = msg.you;
        this.roomId = msg.roomId;
        break;
      case 'player_join':
        if (msg.player.id === this.myId) return;
        this.spawnRemote(msg.player);
        g.hud?.notify?.(`${msg.player.name} 加入了联机`, 'info');
        break;
      case 'player_leave':
        this.removeRemote(msg.id);
        break;
      case 'pose':
        if (msg.id === this.myId) return;
        {
          let rp = this.remotes.get(msg.id);
          if (!rp) {
            rp = this.spawnRemote({
              id: msg.id,
              name: '远行者',
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
            name: rp.name,
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
        if (msg.by === this.myId) {
          // Authoritative confirm — clear pending
          for (const [seq, p] of this.pendingBlocks) {
            if (p.x === msg.x && p.y === msg.y && p.z === msg.z) this.pendingBlocks.delete(seq);
          }
        }
        g.world?.setBlock(msg.x, msg.y, msg.z, msg.id);
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
      case 'error':
        g.hud?.notify?.(msg.reason, 'danger');
        break;
      default:
        break;
    }
  }

  private spawnRemote(snap: Parameters<RemotePlayer['applySnap']>[0] & { id: string; name: string }): RemotePlayer {
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

  applyHelloEdits(edits: EditEntry[]): void {
    const g = this.game;
    if (!g?.world) return;
    for (const e of edits) {
      const lx = e.idx % CFG.CHUNK;
      const tmp = Math.floor(e.idx / CFG.CHUNK);
      const lz = tmp % CFG.CHUNK;
      const y = Math.floor(tmp / CFG.CHUNK);
      const gx = e.cx * CFG.CHUNK + lx;
      const gz = e.cz * CFG.CHUNK + lz;
      // Direct edit map + remesh via setBlock when chunk exists; else stash in world.edits
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

  /** Predictive local place/break then net confirm. */
  submitBlock(x: number, y: number, z: number, id: number, prevId: number): void {
    if (!this.active || !this.net.connected) return;
    this.blockSeq++;
    const seq = this.blockSeq;
    this.pendingBlocks.set(seq, { x, y, z, prev: prevId });
    this.net.sendBlockSet(x, y, z, id, seq);
    // Cap pending map
    if (this.pendingBlocks.size > 64) {
      const first = this.pendingBlocks.keys().next().value;
      if (first !== undefined) this.pendingBlocks.delete(first);
    }
  }

  update(dt: number): void {
    if (!this.active || !this.game) return;
    const g = this.game;
    const p = g.player;
    if (!p || g.state !== 'play') {
      for (const r of this.remotes.values()) r.update(dt);
      return;
    }

    const animKey = typeof p.getBodyAnimKey === 'function' ? p.getBodyAnimKey() : p.dead ? 'death' : 'idle';
    const anim = animFromKey(animKey) as AnimCode;
    const flags = p.inShip ? 1 : 0;
    this.net.tickPose(dt, {
      x: p.pos.x,
      y: p.pos.y,
      z: p.pos.z,
      yaw: p.yaw,
      pitch: p.pitch,
      anim,
      flags,
    });

    for (const r of this.remotes.values()) r.update(dt);
  }
}

export const multiplayer = new MultiplayerSession();
