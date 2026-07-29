/** Mirror of src/net/protocol.ts — keep in sync (no save hosting). */

export const MP_PROTOCOL_VERSION = 1;
export const MP_MAX_PLAYERS = 8;
export const MP_PUBLIC_SHARDS = 4;
export const MP_REACH = 6;
export const MP_REACH_SLACK = 1.5;
export const CHUNK = 16;
export const WORLD_H = 64;

export type AnimCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface PlayerSnap {
  id: string;
  name: string;
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

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function localIdx(lx: number, y: number, lz: number): number {
  return lx + lz * CHUNK + y * (CHUNK * CHUNK);
}

export function parseChunkKey(k: string): { cx: number; cz: number } | null {
  const [a, b] = k.split(',');
  const cx = Number(a);
  const cz = Number(b);
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
  return { cx, cz };
}
