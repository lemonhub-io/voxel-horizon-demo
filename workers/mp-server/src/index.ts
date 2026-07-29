/**
 * Edge entry for Voxel Horizon public multiplayer.
 * No account system, no save hosting — only ephemeral public sessions.
 */
import { PlanetRoom, type RoomStatus } from './PlanetRoom';
import { MP_MAX_PLAYERS, MP_PUBLIC_SHARDS } from './protocol';

export { PlanetRoom };

export interface Env {
  PLANET_ROOM: DurableObjectNamespace<PlanetRoom>;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

async function listPublicRooms(env: Env): Promise<RoomStatus[]> {
  const rooms: RoomStatus[] = [];
  for (let i = 0; i < MP_PUBLIC_SHARDS; i++) {
    const roomId = `public-${i}`;
    const id = env.PLANET_ROOM.idFromName(roomId);
    const stub = env.PLANET_ROOM.get(id);
    const status = await stub.getStatus(roomId);
    rooms.push(status);
  }
  return rooms;
}

async function pickPublicRoom(env: Env): Promise<RoomStatus | null> {
  const rooms = await listPublicRooms(env);
  // Prefer rooms with players but not full; else empty; never full.
  const open = rooms.filter((r) => !r.full);
  if (open.length === 0) return null;
  open.sort((a, b) => {
    // Fill partially occupied rooms first for social density
    if (a.playerCount === 0 && b.playerCount > 0) return 1;
    if (b.playerCount === 0 && a.playerCount > 0) return -1;
    return a.playerCount - b.playerCount;
  });
  return open[0] ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // Public lobby listing
    if (url.pathname === '/api/public/rooms' && request.method === 'GET') {
      const rooms = await listPublicRooms(env);
      return json({
        rooms: rooms.map((r) => ({
          roomId: r.roomId,
          playerCount: r.playerCount,
          maxPlayers: r.maxPlayers,
          seed: r.seed,
          palIdx: r.palIdx,
          planetName: r.planetName,
        })),
        maxPlayers: MP_MAX_PLAYERS,
      });
    }

    // Auto-join least-loaded public shard
    if (url.pathname === '/api/public/join' && (request.method === 'POST' || request.method === 'GET')) {
      const room = await pickPublicRoom(env);
      if (!room) {
        return json({ ok: false, reason: '公开房间已满，请稍后再试' }, 503);
      }
      return json({
        ok: true,
        roomId: room.roomId,
        wsPath: `/ws?room=${encodeURIComponent(room.roomId)}`,
        seed: room.seed,
        palIdx: room.palIdx,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers,
      });
    }

    // WebSocket upgrade → room DO
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'public-0';
      if (!/^public-\d+$/.test(roomId)) {
        return new Response('Invalid room', { status: 400, headers: corsHeaders() });
      }
      const id = env.PLANET_ROOM.idFromName(roomId);
      const stub = env.PLANET_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'voxel-horizon-mp', mode: 'public-session-only' });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};
