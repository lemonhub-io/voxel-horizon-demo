import {
  MP_POSE_HZ,
  MP_PROTOCOL_VERSION,
  type OfficialPlayerSave,
  type AnimCode,
  type ClientMsg,
  type ServerMsg,
  decodeMsg,
  encodeMsg,
} from './protocol';
import { defaultMultiplayerApiBase } from './MultiplayerApi';

export type NetHandler = (msg: ServerMsg | HostInboxMsg) => void;

/** Host-only messages relayed by the DO (not in ServerMsg union). */
export type HostInboxMsg =
  | { t: 'block_set'; x: number; y: number; z: number; id: number; seq: number; from: string }
  | ServerMsg;

function wsUrlFromHttp(httpBase: string, wsPath: string): string {
  const envWs = import.meta.env.VITE_MP_WS_URL as string | undefined;
  if (envWs) {
    const base = envWs.replace(/\/$/, '');
    const [p, q] = wsPath.split('?');
    return `${base}${p.startsWith('/') ? p : `/${p}`}${q ? `?${q}` : ''}`;
  }
  const u = new URL(httpBase, typeof location !== 'undefined' ? location.href : 'http://127.0.0.1');
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  const pathBase = u.pathname.replace(/\/$/, '');
  if (wsPath.includes('?')) {
    const [p, q] = wsPath.split('?');
    u.pathname = `${pathBase}${p.startsWith('/') ? p : `/${p}`}`;
    u.search = `?${q}`;
  } else {
    u.pathname = `${pathBase}${wsPath.startsWith('/') ? wsPath : `/${wsPath}`}`;
    u.search = '';
  }
  return u.toString();
}

export class NetClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<NetHandler>();
  private poseAcc = 0;
  private poseSeq = 0;
  private closed = false;
  connected = false;
  roomId = '';
  playerId = '';

  constructor(readonly httpBase = defaultMultiplayerApiBase()) {}

  onMessage(handler: NetHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(msg: HostInboxMsg): void {
    for (const h of this.handlers) h(msg);
  }

  async connect(wsPath: string): Promise<void> {
    this.disconnect();
    this.closed = false;
    const url = wsUrlFromHttp(this.httpBase, wsPath);
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => {
        reject(new Error('连接超时'));
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }, 12000);

      ws.onopen = () => {
        clearTimeout(timer);
        this.connected = true;
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        if (!this.connected) reject(new Error('无法连接联机服务'));
      };
      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        if (!this.closed) this.emit({ t: 'error', reason: '与服务器断开连接' });
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        // Host may receive raw block_set with from
        try {
          const raw = JSON.parse(ev.data) as HostInboxMsg;
          if (raw && typeof raw === 'object' && typeof (raw as { t?: unknown }).t === 'string') {
            if (raw.t === 'welcome') this.playerId = (raw as Extract<ServerMsg, { t: 'welcome' }>).you;
            this.emit(raw);
            return;
          }
        } catch {
          /* fall through */
        }
        const msg = decodeMsg(ev.data);
        if (msg) this.emit(msg as ServerMsg);
      };
    });
  }

  sendHello(
    role: 'host' | 'guest' | 'player',
    world?: { seed: number; palIdx: number; planetName: string; time: number },
    profileId?: string,
  ): void {
    const msg: ClientMsg = {
      t: 'hello',
      v: MP_PROTOCOL_VERSION,
      role,
      ...(role === 'host' && world
        ? {
            seed: world.seed,
            palIdx: world.palIdx,
            planetName: world.planetName,
            time: world.time,
          }
        : {}),
      ...(profileId ? { profileId } : {}),
    };
    this.send(msg);
  }

  disconnect(): void {
    this.closed = true;
    this.connected = false;
    this.playerId = '';
    if (this.ws) {
      try {
        this.ws.close(1000, 'bye');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
  }

  send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeMsg(msg));
  }

  tickPose(
    dt: number,
    pose: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      anim: AnimCode;
      flags: number;
    },
  ): void {
    if (!this.connected) return;
    this.poseAcc += dt;
    const interval = 1 / MP_POSE_HZ;
    if (this.poseAcc < interval) return;
    this.poseAcc = 0;
    this.poseSeq++;
    this.send({
      t: 'pose',
      seq: this.poseSeq,
      x: pose.x,
      y: pose.y,
      z: pose.z,
      yaw: pose.yaw,
      pitch: pose.pitch,
      anim: pose.anim,
      flags: pose.flags,
    });
  }

  sendBlockSet(x: number, y: number, z: number, id: number, seq: number): void {
    this.send({ t: 'block_set', x, y, z, id, seq });
  }

  /** Private official-server profile sync; never broadcast to peers. */
  sendPlayerSave(save: OfficialPlayerSave): void {
    this.send({ t: 'player_save', save });
  }

  sendBlockApply(x: number, y: number, z: number, id: number, by: string): void {
    this.send({ t: 'block_apply', x, y, z, id, by });
  }

  sendBlockReject(to: string, x: number, y: number, z: number, id: number, reason: string, seq: number): void {
    this.send({ t: 'block_reject', to, x, y, z, id, reason, seq });
  }

  sendHostHeartbeat(info: {
    playerCount: number;
    planetName: string;
    seed: number;
    palIdx: number;
  }): void {
    this.send({ t: 'host_heartbeat', ...info });
  }

  sendStateSnapshot(
    snap: {
      seed: number;
      palIdx: number;
      planetName: string;
      time: number;
      edits: import('./protocol').EditEntry[];
      players: import('./protocol').PlayerSnap[];
    },
    to?: string,
  ): void {
    this.send({ t: 'state_snapshot', to, ...snap });
  }
}
