# r2-cdn-proxy

Cloudflare Worker on the **first account** (Lemonhub / `e28c0202…`) that reverse-proxies **R2 on a second account** via S3-compatible API.

## Why

R2 custom domains cannot be bound (constraint). This Worker provides a stable `*.workers.dev` (and optional custom domain on the first account) while objects stay in the R2 account.

## Deploy

```bash
cd workers/r2-cdn-proxy
npm install

# Secrets = R2 account S3 credentials (second account)
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY

npm run deploy
```

## Usage

| Path | Description |
|------|-------------|
| `GET /` | Health |
| `GET /{key}` | Object from default bucket (`lemonhub-cdn`) |
| `GET /b/{bucket}/{key}` | Object from allowed bucket |
| `HEAD …` | Metadata only |

Allowed buckets: `lemonhub-cdn`, `mzhub-storage`.

## Custom domain (first account)

In the Lemonhub Cloudflare dashboard, add a Worker custom domain or route, e.g. `cdn.mzhub.space` → `r2-cdn-proxy` (zone must be on the first account).
