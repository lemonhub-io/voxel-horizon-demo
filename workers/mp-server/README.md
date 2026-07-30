# Voxel Horizon — Multiplayer Server

Cloudflare Workers + Durable Objects:

1. **Host-local public rooms** — list + WebSocket relay; world stays on host browser.
2. **Official server** — `OfficialRoom` DO is authoritative; world edits archive to **R2**.

## Model

| Mode | Authority | Persistence |
|------|-----------|-------------|
| Player host (`room-…`) | Host browser | None (session only) |
| Official (`official-main`) | `OfficialRoom` DO | R2 `worlds/official-main/world.json` + DO SQLite mirror |

## Local dev

```bash
# Create preview R2 bucket once (optional; DO storage still works without it)
npx wrangler r2 bucket create voxel-horizon-worlds-preview

npm run mp:dev   # :8787
npm run dev      # Vite proxies /mp → 8787
```

## Deploy

```bash
# First account (Lemonhub Worker). R2 is on second account via S3 secrets.
cd workers/mp-server
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npm run deploy
```

**Live:** `https://voxel-api.mzhub.space` · `https://voxel-horizon-mp.mzhub.workers.dev`

### World archive (R2 via Worker proxy)

```
Client → Worker (first account) → S3-signed request → R2 mzhub-storage (second account)
```

| Item | Value |
|------|--------|
| Bucket | `mzhub-storage` (var `R2_BUCKET`) |
| Key | `worlds/official-main/world.json` |
| Authority | `OfficialRoom` DO |
| Mirror | DO SQLite + R2 |
| Read proxy | `GET /api/official/world` |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/rooms` | Player-hosted public rooms |
| GET | `/api/public/create` | Allocate `room-xxxxxxxx` |
| GET | `/api/official` | Official server status + `wsPath` |
| WS | `/ws?room=room-…` | Host-local session |
| WS | `/ws?room=official-main` | Official DO session |
| GET | `/` | Health |

## Official protocol notes

- Client `hello` with `role: "player"` (or `"guest"`).
- Server replies `welcome` (`mode: "official"`, `isHost: false`) then `state_snapshot`.
- `block_set` is validated and applied by the DO; broadcasts `block_apply`.
- Dirty edits flush to R2 on a ~15s alarm or when the last player leaves.
