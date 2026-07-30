/**
 * Cross-account R2 access via S3-compatible API (Worker on account A → R2 on account B).
 * Same pattern as workers/r2-cdn-proxy — Worker is the only public face; R2 stays private.
 */
import { AwsClient } from 'aws4fetch';

export interface R2S3Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function hasR2S3Config(env: {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
}): env is R2S3Config & {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
} {
  return !!(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    (env.R2_BUCKET || true)
  );
}

function client(cfg: R2S3Config): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
}

function objectUrl(cfg: R2S3Config, key: string): string {
  const enc = key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${enc}`;
}

export function r2ConfigFromEnv(env: {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
}): R2S3Config | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) return null;
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET || 'mzhub-storage',
  };
}

export async function s3GetJson(cfg: R2S3Config, key: string): Promise<unknown | null> {
  const aws = client(cfg);
  const res = await aws.fetch(objectUrl(cfg, key), { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`R2 GET ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export async function s3PutJson(cfg: R2S3Config, key: string, data: unknown): Promise<void> {
  const aws = client(cfg);
  const body = JSON.stringify(data);
  const res = await aws.fetch(objectUrl(cfg, key), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`R2 PUT ${res.status}: ${t.slice(0, 200)}`);
  }
}

export async function s3Head(cfg: R2S3Config, key: string): Promise<{ exists: boolean; size?: number }> {
  const aws = client(cfg);
  const res = await aws.fetch(objectUrl(cfg, key), { method: 'HEAD' });
  if (res.status === 404) return { exists: false };
  if (!res.ok) return { exists: false };
  const len = res.headers.get('content-length');
  return { exists: true, size: len ? Number(len) : undefined };
}
