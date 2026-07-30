/** Multiplayer protocol — host-local relay + official DO authority. */

export const MP_PROTOCOL_VERSION = 2;
export const MP_MAX_PLAYERS = 8;
export const MP_POSE_HZ = 15;
export const MP_HOST_HEARTBEAT_S = 4;

/** Fixed official server room id. */
export const OFFICIAL_ROOM_ID = 'official-main';

export type AnimCode = 0 | 1 | 2 | 3 | 4 | 5;
// 0 idle, 1 walk, 2 run, 3 jump, 4 jumpIdle, 5 death

export type SessionMode = 'host-local' | 'official';

export interface PlayerSnap {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  anim: AnimCode;
  flags: number; // bit0 inShip
}

export interface EditEntry {
  cx: number;
  cz: number;
  idx: number;
  id: number;
}

/** Messages from browser → DO (relay / host control / official). */
export type ClientMsg =
  | {
      t: 'hello';
      v: number;
      /** host/guest = player-hosted; player = official server client */
      role: 'host' | 'guest' | 'player';
      /** Host only: world identity for the public list + late join. */
      seed?: number;
      palIdx?: number;
      planetName?: string;
      time?: number;
    }
  | { t: 'host_heartbeat'; playerCount: number; planetName: string; seed: number; palIdx: number }
  | { t: 'pose'; seq: number; x: number; y: number; z: number; yaw: number; pitch: number; anim: AnimCode; flags: number }
  /** Guest / official predictive request; authority replies with block_apply. */
  | { t: 'block_set'; x: number; y: number; z: number; id: number; seq: number }
  /** Host authority apply (host-local only). */
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
  | { t: 'ping'; n: number };

/** Messages DO → browser. */
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
    }
  | { t: 'pong'; n: number }
  | { t: 'error'; reason: string };

export interface PublicRoomInfo {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  seed: number;
  palIdx: number;
  planetName: string;
  live: boolean;
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
  editChunks?: number;
}

export function encodeMsg(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function decodeMsg(raw: string): ClientMsg | ServerMsg | null {
  try {
    const v = JSON.parse(raw) as ClientMsg | ServerMsg;
    if (!v || typeof v !== 'object' || typeof (v as { t?: unknown }).t !== 'string') return null;
    return v;
  } catch {
    return null;
  }
}

export function animFromKey(key: string): AnimCode {
  switch (key) {
    case 'walk':
      return 1;
    case 'run':
      return 2;
    case 'jump':
      return 3;
    case 'jumpIdle':
      return 4;
    case 'death':
      return 5;
    default:
      return 0;
  }
}

export function animToKey(code: AnimCode): string {
  switch (code) {
    case 1:
      return 'walk';
    case 2:
      return 'run';
    case 3:
      return 'jump';
    case 4:
      return 'jumpIdle';
    case 5:
      return 'death';
    default:
      return 'idle';
  }
}
