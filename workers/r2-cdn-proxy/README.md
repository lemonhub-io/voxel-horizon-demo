# R2 CDN Proxy Worker

该 Cloudflare Worker 部署在第一个账户，通过 S3 兼容 API 读取第二个账户的 R2。它适用于 R2 自定义域名不可用、但需要稳定公开入口的场景。

## 安全边界

- 只允许读取 `lemonhub-cdn` 与 `mzhub-storage` 两个存储桶。
- 只接受 `GET`、`HEAD` 与 `OPTIONS`；不提供上传、删除或列举接口。
- 拒绝空键、反斜杠、`..`、Windows 驱动器前缀和超长对象键。
- 仅将成功、非 Range 的完整 GET 响应放入 Cloudflare edge cache。

因此它不是通用对象存储管理 API；不要把私有文件放在可公开读取的允许路径。

## 本地开发

```bash
cd workers/r2-cdn-proxy
npm install
npm run typecheck
npm run dev             # 默认 :8790
```

需要先配置下面的 S3 secret，`/health` 才会返回成功状态。

## 配置与部署

`wrangler.toml` 保存非敏感默认值：`R2_BUCKET` 和 `CACHE_CONTROL`。从命令行写入第二个 R2 账户的 S3 凭据：

```bash
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npm run deploy
```

可在 Cloudflare 控制台为 Worker 绑定自定义域名或 route；域名必须位于 Worker 部署账户中。绝不将三项 secret、访问令牌或真实对象 URL 写入仓库。

## HTTP 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/`、`/health` | 健康状态与默认桶信息 |
| `GET`、`HEAD` | `/{key}` | 从默认 `R2_BUCKET` 读取对象 |
| `GET`、`HEAD` | `/b/{bucket}/{key}` | 从允许的指定桶读取对象 |
| `OPTIONS` | 任意路径 | CORS 预检 |

响应会透传内容类型、长度、范围、ETag、最后修改时间和上游缓存策略；没有上游策略时使用 `CACHE_CONTROL`。成功响应带有 `X-CDN-Cache: HIT|MISS` 和 `X-CDN-Bucket`，可用于排障。

部署后可验证：

```bash
curl https://<worker>/health
curl -I https://<worker>/<known-public-key>
curl -I https://<worker>/b/mzhub-storage/<known-public-key>
```
