/**
 * Global public room directory (ephemeral metadata only — no world data).
 */
import { DurableObject } from 'cloudflare:workers';
import { MP_HOST_STALE_MS, MP_MAX_PLAYERS, type PublicRoomInfo } from './protocol';

interface RoomMeta {
  roomId: string;
  planetName: string;
  seed: number;
  palIdx: number;
  playerCount: number;
  lastBeat: number;
}

export class RoomDirectory extends DurableObject {
  private rooms = new Map<string, RoomMeta>();

  async listPublic(): Promise<PublicRoomInfo[]> {
    const now = Date.now();
    const out: PublicRoomInfo[] = [];
    for (const [id, r] of this.rooms) {
      if (now - r.lastBeat > MP_HOST_STALE_MS) {
        this.rooms.delete(id);
        continue;
      }
      out.push({
        roomId: r.roomId,
        playerCount: r.playerCount,
        maxPlayers: MP_MAX_PLAYERS,
        seed: r.seed,
        palIdx: r.palIdx,
        planetName: r.planetName,
        live: true,
      });
    }
    out.sort((a, b) => b.playerCount - a.playerCount);
    return out;
  }

  async upsert(meta: {
    roomId: string;
    planetName: string;
    seed: number;
    palIdx: number;
    playerCount: number;
  }): Promise<void> {
    this.rooms.set(meta.roomId, {
      roomId: meta.roomId,
      planetName: meta.planetName.slice(0, 32),
      seed: meta.seed,
      palIdx: meta.palIdx,
      playerCount: Math.max(0, Math.min(MP_MAX_PLAYERS, meta.playerCount | 0)),
      lastBeat: Date.now(),
    });
  }

  async remove(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }
}
