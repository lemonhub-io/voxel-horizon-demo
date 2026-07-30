/** Mirror of src/net/protocol.ts — host-local relay + official DO authority. */

export const MP_PROTOCOL_VERSION = 2;
export const MP_MAX_PLAYERS = 8;
export const MP_HOST_STALE_MS = 12_000;

/** Fixed official server room id (DO name + WS query). */
export const OFFICIAL_ROOM_ID = 'official-main';

/** Default world identity when R2 has no archive yet. */
export const OFFICIAL_DEFAULT = {
  seed: 0x0ff1c1a1,
  palIdx: 0,
  planetName: '官方星域',
  time: 0.28,
} as const;

export const WORLD_CHUNK = 16;
export const WORLD_H = 64;
export const WORLD_REACH = 6;
export const R2_FLUSH_MS = 15_000;
export const R2_WORLD_KEY = 'worlds/official-main/world.json';

export type AnimCode = 0 | 1 | 2 | 3 | 4 | 5;
export type SessionMode = 'host-local' | 'official';

export interface PlayerSnap {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  anim: AnimCode;
  flags: number;
}

export interface EditEntry {
  cx: number;
  cz: number;
  idx: number;
  id: number;
}

/** Private official-server progress stored per opaque browser profile ID. */
export interface OfficialPlayerSaveV1 {
  v: 1;
  nickname: string;
  player: {
    pos: number[];
    yaw: number;
    pitch: number;
    hp: number;
    hazard: number;
    ls: number;
    flash?: boolean;
  };
  inv: {
    slots: ({ id: string; n: number } | null)[];
    hotbar: ({ id: string; n: number } | null)[];
    sel: number;
    units: number;
  };
  ship: { pos: number[]; rotY: number; fuel: number; thruster: boolean; pulse: boolean };
  missions: { idx: number; scanner: boolean; shelter?: number; launched?: boolean };
  milestones: { stats: Record<string, number>; awarded: Record<string, number> };
  discoveries: { planets: unknown[]; entries: unknown[] };
  playTime: number;
  updatedAt?: number;
}

/** Persistent world blob in R2 (+ DO SQLite mirror). */
export interface WorldSaveV1 {
  v: 1;
  seed: number;
  palIdx: number;
  planetName: string;
  time: number;
  /** chunkKey "cx,cz" → flat [idx, id, idx, id, ...] */
  edits: Record<string, number[]>;
  /** Optional for backward compatibility with world-only v1 archives. */
  players?: Record<string, OfficialPlayerSaveV1>;
  updatedAt: number;
}

export type ClientMsg =
  | {
      t: 'hello';
      v: number;
      /** host/guest = player-hosted room; player = official server client */
      role: 'host' | 'guest' | 'player';
      seed?: number;
      palIdx?: number;
      planetName?: string;
      time?: number;
      profileId?: string;
    }
  | { t: 'host_heartbeat'; playerCount: number; planetName: string; seed: number; palIdx: number }
  | { t: 'pose'; seq: number; x: number; y: number; z: number; yaw: number; pitch: number; anim: AnimCode; flags: number }
  | { t: 'block_set'; x: number; y: number; z: number; id: number; seq: number }
  | { t: 'block_apply'; x: number; y: number; z: number; id: number; by: string }
  | { t: 'block_reject'; to: string; x: number; y: number; z: number; id: number; reason: string; seq: number }
  | { t: 'state_req' }
  | {
      t: 'state_snapshot';
      to?: string;
      seed: number;
      palIdx: number;
      planetName: string;
      time: number;
      edits: EditEntry[];
      players: PlayerSnap[];
    }
  | { t: 'ping'; n: number }
  | { t: 'player_save'; save: OfficialPlayerSaveV1 };

export type ServerMsg =
  | {
      t: 'welcome';
      v: number;
      roomId: string;
      you: string;
      isHost: boolean;
      hostId: string | null;
      playerCount: number;
      mode?: SessionMode;
    }
  | { t: 'peer_join'; id: string }
  | { t: 'peer_leave'; id: string }
  | { t: 'host_left' }
  | { t: 'pose'; id: string; seq: number; x: number; y: number; z: number; yaw: number; pitch: number; anim: AnimCode; flags: number }
  | { t: 'block_apply'; x: number; y: number; z: number; id: number; by: string }
  | { t: 'block_reject'; x: number; y: number; z: number; id: number; reason: string; seq: number }
  | { t: 'state_req'; from: string }
  | {
      t: 'state_snapshot';
      seed: number;
      palIdx: number;
      planetName: string;
      time: number;
      edits: EditEntry[];
      players: PlayerSnap[];
      hostId: string;
      mode?: SessionMode;
      /** Sent only to the matching official-profile connection. */
      playerSave?: OfficialPlayerSaveV1;
    }
  | { t: 'pong'; n: number }
  | { t: 'error'; reason: string };

export function encodeMsg(msg: ServerMsg | ClientMsg): string {
  return JSON.stringify(msg);
}

export function decodeClientMsg(raw: string): ClientMsg | null {
  try {
    const v = JSON.parse(raw) as ClientMsg;
    if (!v || typeof v !== 'object' || typeof (v as { t?: unknown }).t !== 'string') return null;
    return v;
  } catch {
    return null;
  }
}

export interface PublicRoomInfo {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  seed: number;
  palIdx: number;
  planetName: string;
  live: boolean;
  /** official rooms are DO-backed and always listed when API is up */
  mode?: SessionMode;
}

export interface OfficialStatus {
  roomId: string;
  wsPath: string;
  playerCount: number;
  maxPlayers: number;
  seed: number;
  palIdx: number;
  planetName: string;
  live: boolean;
  mode: 'official';
}
