# Claude Code 项目说明

本文件为在此仓库工作的 Claude Code 提供简明、与当前实现一致的上下文。通用协作规则见 [CONTRIBUTING.md](CONTRIBUTING.md)，详细设计见 [docs/architecture.md](docs/architecture.md)。

## 快速命令

```bash
npm install
npm run dev
npm run typecheck && npm run lint && npm run test && npm run build
npm run mp:dev                 # 联机 Worker，:8787
npm run cdn:dev                # R2 CDN Worker，:8790
```

Vite 8 要求 Node.js `^20.19.0` 或 `>=22.12.0`。Worker 是独立 npm 包；首次运行其命令前在对应目录执行 `npm install`。

## 关键边界

- `src/vue-main.ts` 先安装 Pinia，再挂载 Vue。游戏引擎由 `src/engine-loader.ts` 动态导入，避免把 Three.js/WebGPU 拉入标题页初始包。
- `src/main.ts` 是引擎；Vue 屏幕位于 `src/App.vue` 和 `src/components/`。Pinia store 是引擎写入、UI 读取的状态桥。
- UI 通过 `src/runtime/game-runtime.ts` 获取惰性创建的 `Game` 实例。不要在组件中直接读取 `window.game`，也不要静态导入 `main.ts`。
- `src/composables/` 承担屏幕流程、存档、联机大厅和触摸/HUD 逻辑；新增交互优先放入恰当的 composable，而非继续扩大 `App.vue`。
- 引擎代码使用 `three/webgpu` 与全局 `THREE` 类型声明。对 `three/addons` 的环境声明在 `src/env.d.ts`，不要安装额外的 `@types/three/*` 包。

## 状态、存档与联机

- 引擎修改库存、飞船等状态后调用其 `syncStore()`，保证 Pinia 反映最新值。
- 本地存档使用 OPFS，最多十个槽；设置保存在 `localStorage`。联机不写入本地游戏存档。
- `MultiplayerApi` 负责 HTTP 房间发现，`NetClient` 负责 WebSocket，`MultiplayerSession` 组合两者。
- 玩家主机房间的世界权威在房主浏览器；官方房间 `official-main` 的权威在 Durable Object，并异步归档至 R2。参见 `workers/mp-server/README.md`。

## 测试与风格

- 测试在 `src/__tests__/`；不要写死测试数量。`happy-dom` 不提供 Three.js/WebGL，相关测试需在导入被测模块前调用 `createThreeMock()`。
- TypeScript strict；不用 `any`；类型导入用 `import type`。Vue 使用 `<script setup>` 与 Composition API。
- 用户可见文案使用简体中文。除 `public/models/cc0/` 的已许可模型外，不要添加预制图像或音频资产。
