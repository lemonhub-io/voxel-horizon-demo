/**
 * Edge entry — public room directory + host-local session relay.
 * Does not host world/player saves.
 */
import { PlanetRoom } from './PlanetRoom';
import { RoomDirectory } from './RoomDirectory';
import { MP_MAX_PLAYERS } from './protocol';

export { PlanetRoom, RoomDirectory };

export interface Env {
  PLANET_ROOM: DurableObjectNamespace<PlanetRoom>;
  ROOM_DIRECTORY: DurableObjectNamespace<RoomDirectory>;
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

function directory(env: Env) {
  return env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('public-directory'));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/public/rooms' && request.method === 'GET') {
      const rooms = await directory(env).listPublic();
      return json({ rooms, maxPlayers: MP_MAX_PLAYERS });
    }

    // Create a new room id for hosting (client then opens WS as host)
    if (url.pathname === '/api/public/create' && (request.method === 'POST' || request.method === 'GET')) {
      const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
      return json({
        ok: true,
        roomId,
        wsPath: `/ws?room=${encodeURIComponent(roomId)}`,
        maxPlayers: MP_MAX_PLAYERS,
      });
    }

    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || '';
      if (!/^room-[a-f0-9-]{8,36}$/i.test(roomId) && !/^public-\d+$/.test(roomId)) {
        // allow room-xxxxxxxx (8 hex from uuid slice) or legacy public-N during transition
        if (!roomId.startsWith('room-')) {
          return new Response('Invalid room', { status: 400, headers: corsHeaders() });
        }
      }
      const id = env.PLANET_ROOM.idFromName(roomId);
      const stub = env.PLANET_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        service: 'voxel-horizon-mp',
        mode: 'host-local-authority',
        note: 'World data lives on host client; server only lists + relays',
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};
