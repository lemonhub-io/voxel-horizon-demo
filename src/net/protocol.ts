/** Shared multiplayer protocol (client). Server mirrors in workers/mp-server. */

export const MP_PROTOCOL_VERSION = 1;
export const MP_MAX_PLAYERS = 8;
export const MP_PUBLIC_SHARDS = 4;
export const MP_POSE_HZ = 15;
export const MP_REACH_SLACK = 1.5;

export type AnimCode = 0 | 1 | 2 | 3 | 4 | 5;
// 0 idle, 1 walk, 2 run, 3 jump, 4 jumpIdle, 5 death

export interface PlayerSnap {
  id: string;
  name: string;
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

export type ClientMsg =
  | { t: 'join'; v: number; name: string }
  | { t: 'pose'; seq: number; x: number; y: number; z: number; yaw: number; pitch: number; anim: AnimCode; flags: number }
  | { t: 'block_set'; x: number; y: number; z: number; id: number; seq: number }
  | { t: 'ping'; n: number };

export type ServerMsg =
  | {
      t: 'hello';
      v: number;
      roomId: string;
      you: string;
      seed: number;
      palIdx: number;
      planetName: string;
      time: number;
      edits: EditEntry[];
      players: PlayerSnap[];
    }
  | { t: 'pose'; id: string; seq: number; x: number; y: number; z: number; yaw: number; pitch: number; anim: AnimCode; flags: number }
  | { t: 'player_join'; player: PlayerSnap }
  | { t: 'player_leave'; id: string }
  | { t: 'block_set'; x: number; y: number; z: number; id: number; by: string }
  | { t: 'block_reject'; x: number; y: number; z: number; id: number; reason: string; seq: number }
  | { t: 'pong'; n: number }
  | { t: 'error'; reason: string };

export interface PublicJoinResponse {
  ok: true;
  roomId: string;
  wsPath: string;
  seed: number;
  palIdx: number;
  playerCount: number;
  maxPlayers: number;
}

export interface PublicJoinError {
  ok: false;
  reason: string;
}

export interface PublicRoomInfo {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  seed: number;
  palIdx: number;
  planetName: string;
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
