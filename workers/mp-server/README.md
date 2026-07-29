# Voxel Horizon — Public Multiplayer Server

Cloudflare Workers + Durable Objects for **host-local public co-op**.

## Model

- **Host browser** owns world edits, seed, and player authority.
- **Cloudflare** only: public room directory + WebSocket relay.
- **No server-side saves** of map/player progress.
- Late joiners receive a `state_snapshot` from the host.

## Local dev

```bash
npm run mp:dev   # :8787
npm run dev      # Vite proxies /mp → 8787
```

## Deploy

```bash
npm run mp:deploy
```

**Live:** `https://voxel-api.mzhub.space`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/rooms` | Live host rooms (heartbeat) |
| GET | `/api/public/create` | Allocate `room-xxxxxxxx` id |
| WS | `/ws?room=room-…` | Host or guest session |
| GET | `/` | Health |
