import {
  MP_POSE_HZ,
  MP_PROTOCOL_VERSION,
  OFFICIAL_ROOM_ID,
  type AnimCode,
  type ClientMsg,
  type OfficialStatus,
  type PublicRoomInfo,
  type ServerMsg,
  decodeMsg,
  encodeMsg,
} from './protocol';

export type NetHandler = (msg: ServerMsg | HostInboxMsg) => void;

/** Host-only messages relayed by the DO (not in ServerMsg union). */
export type HostInboxMsg =
  | { t: 'block_set'; x: number; y: number; z: number; id: number; seq: number; from: string }
  | ServerMsg;

const DEFAULT_PROD_MP = 'https://voxel-api.mzhub.space';

function defaultHttpBase(): string {
  const env = import.meta.env.VITE_MP_HTTP_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  if (import.meta.env.DEV && typeof location !== 'undefined') {
    return `${location.protocol}//${location.host}/mp`;
  }
  return DEFAULT_PROD_MP;
}

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
  httpBase = defaultHttpBase();

  onMessage(handler: NetHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(msg: HostInboxMsg): void {
    for (const h of this.handlers) h(msg);
  }

  async listPublicRooms(): Promise<PublicRoomInfo[]> {
    const res = await fetch(`${this.httpBase}/api/public/rooms`);
    if (!res.ok) throw new Error(`联机服务不可用 (${res.status})`);
    const data = (await res.json()) as { rooms?: PublicRoomInfo[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  }

  async createRoom(): Promise<{ roomId: string; wsPath: string }> {
    const res = await fetch(`${this.httpBase}/api/public/create`);
    if (!res.ok) throw new Error(`无法创建房间 (${res.status})`);
    const data = (await res.json()) as { ok?: boolean; roomId?: string; wsPath?: string; reason?: string };
    if (!data.roomId || !data.wsPath) throw new Error(data.reason || '创建房间失败');
    return { roomId: data.roomId, wsPath: data.wsPath };
  }

  async getOfficialStatus(): Promise<OfficialStatus> {
    const res = await fetch(`${this.httpBase}/api/official`);
    if (!res.ok) throw new Error(`官方服不可用 (${res.status})`);
    const data = (await res.json()) as Partial<OfficialStatus>;
    if (!data.roomId && !data.wsPath) throw new Error('官方服响应无效');
    return {
      roomId: data.roomId || OFFICIAL_ROOM_ID,
      wsPath: data.wsPath || `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
      playerCount: data.playerCount ?? 0,
      maxPlayers: data.maxPlayers ?? 8,
      seed: data.seed ?? 0,
      palIdx: data.palIdx ?? 0,
      planetName: data.planetName || '官方星域',
      live: data.live !== false,
      mode: 'official',
      editChunks: data.editChunks,
    };
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
