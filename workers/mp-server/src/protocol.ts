/** Mirror of src/net/protocol.ts — host-local authority; CF lists + relays only. */

export const MP_PROTOCOL_VERSION = 2;
export const MP_MAX_PLAYERS = 8;
export const MP_HOST_STALE_MS = 12_000;

export type AnimCode = 0 | 1 | 2 | 3 | 4 | 5;

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

export type ClientMsg =
  | {
      t: 'hello';
      v: number;
      role: 'host' | 'guest';
      seed?: number;
      palIdx?: number;
      planetName?: string;
      time?: number;
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
  | { t: 'ping'; n: number };

export type ServerMsg =
  | {
      t: 'welcome';
      v: number;
      roomId: string;
      you: string;
      isHost: boolean;
      hostId: string | null;
      playerCount: number;
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
}
