# Voxel Horizon — Public Multiplayer Server

Cloudflare Workers + Durable Objects session server for **public co-op**.

## Constraints

- **No save hosting** — world edits live only in DO memory for the active session.
- When the last player leaves, the room can cold-start with a new seed.
- **Public only** — rooms are `public-0` … `public-3` shards (max 8 players each).

## Local dev

```bash
# from repo root
npm run mp:dev
# → http://127.0.0.1:8787

# game (another terminal)
npm run dev
# Vite proxies /mp → 8787
```

## Deploy

```bash
npm run mp:deploy
```

**Live (current):** `https://voxel-horizon-mp.mzhub.workers.dev`

Production frontend uses `VITE_MP_HTTP_URL` / `.env.production` pointing at this URL.
Local `npm run dev` still proxies `/mp` → `wrangler dev` on port 8787.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/rooms` | List public shards |
| POST/GET | `/api/public/join` | Pick a non-full shard |
| WS | `/ws?room=public-N` | Join session |
| GET | `/health` | Liveness |
