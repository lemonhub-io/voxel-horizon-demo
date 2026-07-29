import {
  MP_POSE_HZ,
  MP_PROTOCOL_VERSION,
  type AnimCode,
  type ClientMsg,
  type PublicJoinResponse,
  type PublicRoomInfo,
  type ServerMsg,
  decodeMsg,
  encodeMsg,
} from './protocol';

export type NetHandler = (msg: ServerMsg) => void;

/** Production Worker URL (overridden by VITE_MP_HTTP_URL). */
const DEFAULT_PROD_MP = 'https://voxel-horizon-mp.mzhub.workers.dev';

function defaultHttpBase(): string {
  const env = import.meta.env.VITE_MP_HTTP_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  // Local Vite dev uses proxy /mp → wrangler :8787
  if (import.meta.env.DEV && typeof location !== 'undefined') {
    return `${location.protocol}//${location.host}/mp`;
  }
  return DEFAULT_PROD_MP;
}

function wsUrlFromHttp(httpBase: string, wsPath: string): string {
  const envWs = import.meta.env.VITE_MP_WS_URL as string | undefined;
  if (envWs) {
    const base = envWs.replace(/\/$/, '');
    return `${base}${wsPath.startsWith('/') ? wsPath : `/${wsPath}`}`;
  }
  const u = new URL(httpBase, typeof location !== 'undefined' ? location.href : 'http://127.0.0.1');
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  // httpBase may be .../mp — append path after that
  const pathBase = u.pathname.replace(/\/$/, '');
  u.pathname = `${pathBase}${wsPath.startsWith('/') ? wsPath : `/${wsPath}`}`;
  u.search = '';
  // wsPath may include query
  if (wsPath.includes('?')) {
    const [p, q] = wsPath.split('?');
    u.pathname = `${pathBase}${p.startsWith('/') ? p : `/${p}`}`;
    u.search = `?${q}`;
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

  private emit(msg: ServerMsg): void {
    for (const h of this.handlers) h(msg);
  }

  async listPublicRooms(): Promise<PublicRoomInfo[]> {
    const res = await fetch(`${this.httpBase}/api/public/rooms`);
    if (!res.ok) throw new Error(`联机服务不可用 (${res.status})`);
    const data = (await res.json()) as { rooms?: PublicRoomInfo[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  }

  async joinPublic(name: string): Promise<PublicJoinResponse> {
    // GET is sufficient (no body); avoids edge cases with empty POST bodies.
    const res = await fetch(`${this.httpBase}/api/public/join`);
    const data = (await res.json()) as PublicJoinResponse | { ok: false; reason: string };
    if (!res.ok || !data || !('ok' in data) || !data.ok) {
      const reason =
        data && typeof data === 'object' && 'reason' in data
          ? String((data as { reason?: string }).reason || '')
          : '';
      throw new Error(reason || '加入公开房间失败');
    }
    await this.connect(data.wsPath, name);
    this.roomId = data.roomId;
    return data;
  }

  /** Join a specific public shard by id (e.g. public-0). */
  async joinRoom(roomId: string, name: string): Promise<void> {
    if (!/^public-\d+$/.test(roomId)) throw new Error('无效的公开分片');
    await this.connect(`/ws?room=${encodeURIComponent(roomId)}`, name);
    this.roomId = roomId;
  }

  async connect(wsPath: string, name: string): Promise<void> {
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
        this.send({ t: 'join', v: MP_PROTOCOL_VERSION, name: name.slice(0, 16) || '远行者' });
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
        const msg = decodeMsg(ev.data);
        if (!msg || !('t' in msg)) return;
        // Client only handles server messages
        const t = (msg as ServerMsg).t;
        if (
          t === 'hello' ||
          t === 'pose' ||
          t === 'player_join' ||
          t === 'player_leave' ||
          t === 'block_set' ||
          t === 'block_reject' ||
          t === 'pong' ||
          t === 'error'
        ) {
          if (t === 'hello') this.playerId = (msg as Extract<ServerMsg, { t: 'hello' }>).you;
          this.emit(msg as ServerMsg);
        }
      };
    });
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

  /** Call from game loop with dt; rate-limits pose uploads. */
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
}
