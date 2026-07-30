# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/)。未发布内容反映当前主分支以外的开发状态，发布前会整理版本号与日期。

## [Unreleased]

### 新增

- 官方公共星域：`official-main` 由 Cloudflare Durable Object 托管，世界编辑在 Durable Object SQLite 与 R2 中持久化。
- 公共联机大厅、房间发现与官方服务器状态接口；玩家主机房间仍由房主浏览器保存世界状态。
- 跨账户 R2 只读 CDN Worker，支持缓存、范围请求、条件请求和允许列表中的存储桶。
- 应用运行时桥接、联机 API、存档、游戏流程、触摸输入与 HUD 标记的组合式模块。
- 官方联机发现、运行时桥接、存档流程和组件交互的单元/集成测试。
- 新的线框应用图标，并同步更新 PWA 清单和 Service Worker 预缓存。

### 变更

- `App.vue` 仅负责屏幕组合；游戏启动、存档、联机和暂停操作下沉至 `src/composables/`。
- 联机 HTTP 发现从 WebSocket 传输层分离：`MultiplayerApi` 负责 API，`NetClient` 只管理 WebSocket。
- 联机 Worker 的入口拆分为路由、HTTP 响应、环境声明与官方状态服务。

### 修复

- 官方服务器始终作为可加入条目出现在公开联机列表中，即使官方 Durable Object 正在冷启动或短暂不可用。

## [1.0.0] - 2026-07-25

### 新增

- 程序化体素星球、采集、制造、飞船、任务、存档、触摸控制和 PWA 基础体验。
- Vue 3 + Pinia 界面、Three.js WebGPU 渲染及 Vitest 测试基础设施。
