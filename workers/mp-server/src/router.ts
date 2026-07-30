import type { Env } from './env';
import { corsHeaders, json } from './http';
import { MP_MAX_PLAYERS, OFFICIAL_ROOM_ID, R2_WORLD_KEY } from './protocol';
import { r2ConfigFromEnv, s3GetJson, s3Head } from './r2S3';
import { getOfficialStatus, officialStub } from './services/officialStatus';
import { describeR2Backend, isWorldSaveV1 } from './worldSave';

function directory(env: Env) {
  return env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('public-directory'));
}

async function publicRooms(env: Env): Promise<Response> {
  const [hostRooms, official] = await Promise.all([directory(env).listPublic(), getOfficialStatus(env)]);
  return json({ rooms: [official, ...hostRooms], maxPlayers: MP_MAX_PLAYERS });
}

async function officialServer(env: Env): Promise<Response> {
  const data = await getOfficialStatus(env);
  return json({
    ...data,
    wsPath: `/ws?room=${encodeURIComponent(OFFICIAL_ROOM_ID)}`,
    worldBackend: describeR2Backend(env),
    r2Key: R2_WORLD_KEY,
  });
}

async function officialWorld(env: Env): Promise<Response> {
  const cfg = r2ConfigFromEnv(env);
  if (!cfg) {
    return json(
      { ok: false, error: 'R2 S3 secrets not configured', backend: describeR2Backend(env) },
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
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        backend: describeR2Backend(env),
      },
      502,
    );
  }
}

function createPublicRoom(): Response {
  const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
  return json({
    ok: true,
    roomId,
    wsPath: `/ws?room=${encodeURIComponent(roomId)}`,
    maxPlayers: MP_MAX_PLAYERS,
  });
}

function websocket(request: Request, env: Env, roomId: string): Promise<Response> | Response {
  if (roomId === OFFICIAL_ROOM_ID) {
    return officialStub(env).fetch(request);
  }

  if (!/^room-[a-f0-9-]{8,36}$/i.test(roomId) && !/^public-\d+$/.test(roomId)) {
    if (!roomId.startsWith('room-')) {
      return new Response('Invalid room', { status: 400, headers: corsHeaders() });
    }
  }
  return env.PLANET_ROOM.get(env.PLANET_ROOM.idFromName(roomId)).fetch(request);
}

function health(env: Env): Response {
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

/** Routes the public HTTP API and forwards room WebSockets to their DO. */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  if (url.pathname === '/api/public/rooms' && request.method === 'GET') return publicRooms(env);
  if (url.pathname === '/api/official' && request.method === 'GET') return officialServer(env);
  if (url.pathname === '/api/official/world' && request.method === 'GET') return officialWorld(env);
  if (url.pathname === '/api/public/create' && (request.method === 'POST' || request.method === 'GET')) {
    return createPublicRoom();
  }
  if (url.pathname === '/ws') return websocket(request, env, url.searchParams.get('room') || '');
  if (url.pathname === '/' || url.pathname === '/health') return health(env);
  return new Response('Not found', { status: 404, headers: corsHeaders() });
}
