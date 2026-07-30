/**
 * R2 CDN reverse proxy (Worker on account A, R2 on account B via S3 API).
 *
 * Secrets (wrangler secret put):
 *   R2_ACCOUNT_ID          — R2 account id
 *   R2_ACCESS_KEY_ID       — S3 access key
 *   R2_SECRET_ACCESS_KEY   — S3 secret key
 *
 * Vars (wrangler.toml [vars]):
 *   R2_BUCKET              — default bucket name
 *   CACHE_CONTROL          — Cache-Control for successful GETs
 *
 * Paths:
 *   /                      — health
 *   /health                — health JSON
 *   /{objectKey}           — GET/HEAD object from default bucket
 *   /b/{bucket}/{key}      — GET/HEAD object from named bucket
 */
import { AwsClient } from 'aws4fetch';

export interface Env {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  CACHE_CONTROL?: string;
}

const ALLOWED_BUCKETS = new Set(['lemonhub-cdn', 'mzhub-storage']);

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, ETag, Accept-Ranges, Content-Range',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    },
  });
}

/** Normalize and reject unsafe object keys. */
function sanitizeKey(raw: string): string | null {
  let key = raw.replace(/^\/+/, '');
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  if (!key || key.includes('\\') || key.includes('\0')) return null;
  // path traversal
  const parts = key.split('/');
  if (parts.some((p) => p === '..')) return null;
  // no absolute / Windows drives
  if (/^[a-zA-Z]:/.test(key)) return null;
  if (key.length > 1024) return null;
  return key;
}

function parsePath(pathname: string): { bucket: string | null; key: string | null } | 'health' {
  if (pathname === '/' || pathname === '/health') return 'health';
  // /b/{bucket}/{key...}
  const bMatch = pathname.match(/^\/b\/([^/]+)\/(.+)$/);
  if (bMatch) {
    return { bucket: bMatch[1], key: bMatch[2] };
  }
  // /{key...} using default bucket
  return { bucket: null, key: pathname.replace(/^\//, '') };
}

function endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function awsClient(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      return json(
        {
          ok: false,
          error: 'R2 secrets not configured',
          hint: 'wrangler secret put R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY',
        },
        503,
        cors,
      );
    }

    const url = new URL(request.url);
    const parsed = parsePath(url.pathname);

    if (parsed === 'health') {
      return json(
        {
          ok: true,
          service: 'r2-cdn-proxy',
          account: 'first (worker host)',
          defaultBucket: env.R2_BUCKET || 'lemonhub-cdn',
          note: 'GET /{key} or /b/{bucket}/{key}',
        },
        200,
        cors,
      );
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ ok: false, error: 'Method not allowed' }, 405, cors);
    }

    const bucketName = (parsed.bucket || env.R2_BUCKET || 'lemonhub-cdn').trim();
    if (!ALLOWED_BUCKETS.has(bucketName)) {
      return json({ ok: false, error: 'Bucket not allowed' }, 403, cors);
    }

    const key = sanitizeKey(parsed.key || '');
    if (!key) {
      return json({ ok: false, error: 'Invalid object key' }, 400, cors);
    }

    // Edge cache (GET only)
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    if (request.method === 'GET') {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const h = new Headers(hit.headers);
        for (const [k, v] of Object.entries(cors)) h.set(k, v as string);
        h.set('X-CDN-Cache', 'HIT');
        return new Response(hit.body, { status: hit.status, headers: h });
      }
    }

    const objectUrl = `${endpoint(env.R2_ACCOUNT_ID)}/${bucketName}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;

    const upstreamHeaders = new Headers();
    const range = request.headers.get('Range');
    if (range) upstreamHeaders.set('Range', range);
    const inm = request.headers.get('If-None-Match');
    if (inm) upstreamHeaders.set('If-None-Match', inm);
    const ims = request.headers.get('If-Modified-Since');
    if (ims) upstreamHeaders.set('If-Modified-Since', ims);

    const client = awsClient(env);
    let upstream: Response;
    try {
      upstream = await client.fetch(objectUrl, {
        method: request.method,
        headers: upstreamHeaders,
      });
    } catch (e) {
      return json(
        {
          ok: false,
          error: 'Upstream R2 request failed',
          detail: e instanceof Error ? e.message : String(e),
        },
        502,
        cors,
      );
    }

    if (upstream.status === 404) {
      return json({ ok: false, error: 'Not found', key, bucket: bucketName }, 404, cors);
    }

    if (upstream.status === 403) {
      return json({ ok: false, error: 'Forbidden by R2', key, bucket: bucketName }, 403, cors);
    }

    if (!upstream.ok && upstream.status !== 304 && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      return json(
        {
          ok: false,
          error: 'R2 error',
          status: upstream.status,
          body: text.slice(0, 300),
        },
        502,
        cors,
      );
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(cors)) headers.set(k, v as string);

    const pass = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
      'cache-control',
    ];
    for (const name of pass) {
      const v = upstream.headers.get(name);
      if (v) headers.set(name, v);
    }

    if (!headers.has('Cache-Control') && upstream.ok) {
      headers.set('Cache-Control', env.CACHE_CONTROL || 'public, max-age=86400');
    }
    headers.set('X-CDN-Cache', 'MISS');
    headers.set('X-CDN-Bucket', bucketName);
    headers.set('X-Content-Type-Options', 'nosniff');

    const out = new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    });

    // Cache successful full GET responses (not ranges)
    if (
      request.method === 'GET' &&
      upstream.status === 200 &&
      !range &&
      out.headers.get('Content-Type')
    ) {
      const toCache = out.clone();
      ctx.waitUntil(cache.put(cacheKey, toCache));
    }

    return out;
  },
};
