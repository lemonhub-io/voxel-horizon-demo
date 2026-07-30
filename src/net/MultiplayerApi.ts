import {
  OFFICIAL_ROOM_ID,
  type OfficialStatus,
  type PublicRoomInfo,
} from "./protocol";

const DEFAULT_PROD_MP = "https://voxel-api.mzhub.space";

/** Resolve the HTTP endpoint independently from WebSocket transport. */
export function defaultMultiplayerApiBase(): string {
  const env = import.meta.env.VITE_MP_HTTP_URL as string | undefined;
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV && typeof location !== "undefined") {
    return `${location.protocol}//${location.host}/mp`;
  }
  return DEFAULT_PROD_MP;
}

/** HTTP discovery and room-allocation API. It has no WebSocket state. */
export class MultiplayerApi {
  constructor(readonly httpBase = defaultMultiplayerApiBase()) {}

  async listPublicRooms(): Promise<PublicRoomInfo[]> {
    const res = await fetch(`${this.httpBase}/api/public/rooms`);
    if (!res.ok) throw new Error(`联机服务不可用 (${res.status})`);
    const data = (await res.json()) as { rooms?: PublicRoomInfo[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  }

  async createRoom(): Promise<{ roomId: string; wsPath: string }> {
    const res = await fetch(`${this.httpBase}/api/public/create`);
    if (!res.ok) throw new Error(`无法创建房间 (${res.status})`);
    const data = (await res.json()) as {
      ok?: boolean;
      roomId?: string;
      wsPath?: string;
      reason?: string;
    };
    if (!data.roomId || !data.wsPath)
      throw new Error(data.reason || "创建房间失败");
    return { roomId: data.roomId, wsPath: data.wsPath };
  }

  async getOfficialStatus(): Promise<OfficialStatus> {
    const res = await fetch(`${this.httpBase}/api/official`);
    if (!res.ok) throw new Error(`官方服不可用 (${res.status})`);
    const data = (await res.json()) as Partial<OfficialStatus>;
    if (!data.roomId && !data.wsPath) throw new Error("官方服响应无效");
    return {
      roomId: data.roomId || OFFICIAL_ROOM_ID,
      wsPath: data.wsPath || `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
      playerCount: data.playerCount ?? 0,
      maxPlayers: data.maxPlayers ?? 8,
      seed: data.seed ?? 0,
      palIdx: data.palIdx ?? 0,
      planetName: data.planetName || "官方星域",
      live: data.live !== false,
      mode: "official",
      editChunks: data.editChunks,
    };
  }
}
