# 部署指南

本文只描述配置形状，不记录真实令牌、账户密钥或私有端点。部署前确认已安装并登录 Cloudflare Wrangler，并在对应 Worker 目录安装依赖。

## 前端

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

将 `dist/` 发布到静态站点托管服务即可。Vite 使用相对 `base: './'`，适合子路径部署。生产环境的联机地址可在构建时注入：

```text
VITE_MP_HTTP_URL=https://<multiplayer-api>
VITE_MP_WS_URL=wss://<multiplayer-api>
```

若未设置，生产前端默认使用项目代码中的公开 API 地址；本地开发会使用 Vite `/mp` 代理。

## 联机 Worker

`workers/mp-server/` 部署 Durable Object 路由、玩家房间中继和官方房间。首次部署或变更 Durable Object 类/迁移时尤其谨慎：迁移标签一旦上线不能随意改写。

```bash
cd workers/mp-server
npm install
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npm run deploy
```

`R2_BUCKET` 是 `wrangler.toml` 的非敏感变量；三个 R2 S3 凭据必须以 Worker secret 设置。部署后检查：

```bash
curl https://<worker>/health
curl https://<worker>/api/public/rooms
curl https://<worker>/api/official
```

官方世界归档端点为 `GET /api/official/world`。R2 凭据未配置时它返回 `503`，不应把这当作空世界。

## R2 CDN Worker

该 Worker 通过 S3 兼容 API 读取另一个账户的 R2。它只接受 `lemonhub-cdn` 与 `mzhub-storage` 两个存储桶，且仅处理 `GET`、`HEAD` 和 CORS 预检。

```bash
cd workers/r2-cdn-proxy
npm install
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npm run deploy
```

部署后访问 `GET /health`，再用 `GET /{key}` 或 `GET /b/{bucket}/{key}` 验证对象读取。该 Worker 的边缘缓存只缓存成功、完整的 GET 响应；不要把私有对象暴露到允许的公共路径。

## 发布检查表

- 前端四项检查均通过：类型、lint、测试、构建。
- 两个 Worker 的类型检查通过。
- 无密钥、访问令牌、存档或 `.wrangler-out/` 进入提交。
- 验证生产 API 的健康检查、公开房间列表、官方房间状态和 WebSocket 连接。
- 更新 `CHANGELOG.md` 的 Unreleased 条目，并在 PR 中记录部署版本或 Worker 版本。
