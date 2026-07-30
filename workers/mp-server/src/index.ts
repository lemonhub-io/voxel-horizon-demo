/**
 * Edge entry — host-local public rooms + official DO server.
 * World archive: second-account R2 via S3 API (Worker reverse-proxy backend).
 */
import { OfficialRoom } from './OfficialRoom';
import { PlanetRoom } from './PlanetRoom';
import { RoomDirectory } from './RoomDirectory';
import {
  MP_MAX_PLAYERS,
  OFFICIAL_DEFAULT,
  OFFICIAL_ROOM_ID,
  R2_WORLD_KEY,
  type OfficialStatus,
} from './protocol';
import { r2ConfigFromEnv, s3GetJson, s3Head } from './r2S3';
import { describeR2Backend, isWorldSaveV1 } from './worldSave';

export { OfficialRoom, PlanetRoom, RoomDirectory };

export interface Env {
  PLANET_ROOM: DurableObjectNamespace<PlanetRoom>;
  ROOM_DIRECTORY: DurableObjectNamespace<RoomDirectory>;
  OFFICIAL_ROOM: DurableObjectNamespace<OfficialRoom>;
  WORLD_SAVES?: R2Bucket;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
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

function officialStub(env: Env) {
  return env.OFFICIAL_ROOM.get(env.OFFICIAL_ROOM.idFromName(OFFICIAL_ROOM_ID));
}

async function getOfficialStatus(env: Env): Promise<OfficialStatus> {
  try {
    const res = await officialStub(env).fetch(
      new Request('https://official/status?status=1', { method: 'GET' }),
    );
    if (res.ok) {
      const status = (await res.json()) as OfficialStatus;
      return {
        ...status,
        roomId: status.roomId || OFFICIAL_ROOM_ID,
        wsPath: status.wsPath || `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
        mode: 'official',
      };
    }
  } catch {
    /* fall through to the advertised default server */
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/public/rooms' && request.method === 'GET') {
      const [hostRooms, official] = await Promise.all([directory(env).listPublic(), getOfficialStatus(env)]);
      // Keep the official DO world discoverable through the same public-list API
      // as player-hosted rooms. Clients use `mode` to render it with official UI
      // and to join via the authoritative-server flow rather than host relay.
      return json({ rooms: [official, ...hostRooms], maxPlayers: MP_MAX_PLAYERS });
    }

    // Official server status (always available; DO hydrates on demand)
    if (url.pathname === '/api/official' && request.method === 'GET') {
      const data = await getOfficialStatus(env);
      return json({
        ...data,
        wsPath: `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
        worldBackend: describeR2Backend(env),
        r2Key: R2_WORLD_KEY,
      });
    }

    /**
     * Worker reverse-proxy to R2 world archive (read-only).
     * Does not expose raw R2 credentials; S3 signed requests stay on the edge.
     */
    if (url.pathname === '/api/official/world' && request.method === 'GET') {
      const cfg = r2ConfigFromEnv(env);
      if (!cfg) {
        return json(
          {
            ok: false,
            error: 'R2 S3 secrets not configured',
            backend: describeR2Backend(env),
          },
          503,
        );
      }
      try {
        const head = await s3Head(cfg, R2_WORLD_KEY);
        const data = await s3GetJson(cfg, R2_WORLD_KEY);
        if (data === null || !isWorldSaveV1(data)) {
          return json({
            ok: true,
            exists: false,
            bucket: cfg.bucket,
            key: R2_WORLD_KEY,
            backend: describeR2Backend(env),
            note: 'No archive yet — will be created on first official session flush',
          });
        }
        return json({
          ok: true,
          exists: true,
          bucket: cfg.bucket,
          key: R2_WORLD_KEY,
          size: head.size,
          backend: describeR2Backend(env),
          world: {
            v: data.v,
            seed: data.seed,
            palIdx: data.palIdx,
            planetName: data.planetName,
            time: data.time,
            updatedAt: data.updatedAt,
            editChunks: Object.keys(data.edits || {}).length,
          },
        });
      } catch (e) {
        return json(
          {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            backend: describeR2Backend(env),
          },
          502,
        );
      }
    }

    // Create a new room id for player hosting (client then opens WS as host)
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

      if (roomId === OFFICIAL_ROOM_ID) {
        const stub = officialStub(env);
        return stub.fetch(request);
      }

      if (!/^room-[a-f0-9-]{8,36}$/i.test(roomId) && !/^public-\d+$/.test(roomId)) {
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
        modes: ['host-local-authority', 'official-do-r2-proxy'],
        officialRoom: OFFICIAL_ROOM_ID,
        worldArchive: describeR2Backend(env),
        r2Bucket: env.R2_BUCKET || 'mzhub-storage',
        r2Key: R2_WORLD_KEY,
        note: 'Official world: DO authority; R2 via Worker S3 proxy (cross-account)',
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};
