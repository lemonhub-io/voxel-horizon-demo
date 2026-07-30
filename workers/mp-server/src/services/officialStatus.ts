import type { Env } from '../env';
import {
  MP_MAX_PLAYERS,
  OFFICIAL_DEFAULT,
  OFFICIAL_ROOM_ID,
  type OfficialStatus,
} from '../protocol';

export function officialStub(env: Env) {
  return env.OFFICIAL_ROOM.get(env.OFFICIAL_ROOM.idFromName(OFFICIAL_ROOM_ID));
}

/**
 * Queries the official Durable Object while retaining a joinable advertised
 * default during a cold start or a transient DO failure.
 */
export async function getOfficialStatus(env: Env): Promise<OfficialStatus> {
  try {
    const response = await officialStub(env).fetch(
      new Request('https://official/status?status=1', { method: 'GET' }),
    );
    if (response.ok) {
      const status = (await response.json()) as OfficialStatus;
      return {
        ...status,
        roomId: status.roomId || OFFICIAL_ROOM_ID,
        wsPath: status.wsPath || `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
        mode: 'official',
      };
    }
  } catch {
    // Advertise the default official world if its Durable Object is unavailable.
  }

  return {
    roomId: OFFICIAL_ROOM_ID,
    wsPath: `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
    playerCount: 0,
    maxPlayers: MP_MAX_PLAYERS,
    seed: OFFICIAL_DEFAULT.seed,
    palIdx: OFFICIAL_DEFAULT.palIdx,
    planetName: OFFICIAL_DEFAULT.planetName,
    live: true,
    mode: 'official',
  };
}
