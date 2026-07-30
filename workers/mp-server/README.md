# Voxel Horizon 联机 Worker

该 Cloudflare Worker 提供 HTTP 房间发现与 WebSocket 会话，并通过 Durable Objects 支持两种联机模式。

| 模式 | 房间 | 世界权威 | 持久化 |
| --- | --- | --- | --- |
| 玩家主机 | `room-<uuid>` | 房主浏览器 | 仅当前会话 |
| 官方星域 | `official-main` | `OfficialRoom` Durable Object | DO SQLite 镜像 + R2 JSON 归档 |

公开列表总会包含官方星域；官方对象冷启动或短暂失败时，路由会返回可加入的默认条目，而不是把它从列表中移除。

## 本地开发

```bash
cd workers/mp-server
npm install
npm run typecheck
npm run dev             # 默认 :8787
```

在仓库根目录另开终端运行 `npm run dev`。Vite 会将 `/mp/*` 转发到 `http://127.0.0.1:8787/*`，并代理 WebSocket。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/`、`/health` | 服务、官方房间和归档后端状态 |
| `GET` | `/api/public/rooms` | 官方星域 + 当前活跃的玩家主机房间 |
| `GET` 或 `POST` | `/api/public/create` | 分配 `room-<uuid>` 房间 ID 与 WebSocket 路径 |
| `GET` | `/api/official` | 官方星域状态、`wsPath` 和归档信息 |
| `GET` | `/api/official/world` | R2 归档元数据；未配置 S3 secret 时返回 `503` |
| `GET`/WebSocket | `/ws?room=<id>` | 连接玩家主机房间或 `official-main` |

响应带宽松的 CORS 头以支持前端部署在不同域名。协议版本、消息联合类型和最大玩家数位于 `src/protocol.ts`；前端镜像定义在 `src/net/protocol.ts`，修改时必须同步。

## 官方世界归档

官方房间验证 `block_set`，广播 `block_apply`，并把编辑存为 `worlds/official-main/world.json`。编辑在约 15 秒后、或最后一名玩家离开时刷新至 R2；Durable Object SQLite 作为在线镜像。R2 不可用时，官方实时房间仍可运行，但归档接口会报告后端问题。

## 部署

在 `wrangler.toml` 所属的 Cloudflare 账户部署 Worker 与 Durable Objects。R2 位于另一账户时，通过 S3 兼容 API 提供以下 secret：

```bash
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npm run deploy
```

`R2_BUCKET` 是非敏感变量，默认在 `wrangler.toml` 中声明。不要提交这些 secret，也不要改写已发布的 Durable Object migration 标签。部署后至少验证 `/health`、`/api/public/rooms`、`/api/official` 和一次 WebSocket 加入。
