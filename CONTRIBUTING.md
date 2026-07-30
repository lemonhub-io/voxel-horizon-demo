# 贡献指南

感谢你改进方界深空。提交前请以仓库中的脚本和本文档为准；游戏与界面的面向用户文案使用简体中文。

## 环境与启动

使用 Node.js `^20.19.0` 或 `>=22.12.0`，然后执行：

```bash
npm install
npm run dev
```

联机 Worker 与 R2 CDN Worker 各自是独立的 npm 包。首次进入相应目录时需分别执行 `npm install`。

## 开发检查

前端改动提交前依次运行：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

修改 Worker 时还应运行：

```bash
npm run typecheck --prefix workers/mp-server
npm run typecheck --prefix workers/r2-cdn-proxy
```

`npm run lint` 与格式化脚本只作用于 `src/`；根目录配置、Worker 和文档需要自行复核。不要将 `dist/`、`coverage/`、`node_modules/` 或 `workers/*/.wrangler-out/` 提交进仓库。

## 代码与测试

- TypeScript 开启 strict；避免 `any`，类型专用导入使用 `import type`。
- Vue 组件使用 `<script setup>` 与 Composition API；组件名用 PascalCase。
- 引擎模块从 `three/webgpu` 导入。UI 不应静态导入 `src/main.ts`，请经 `engine-loader.ts` 懒加载。
- 引擎状态通过 Pinia 同步到界面；读取浏览器运行时引擎请使用 `src/runtime/game-runtime.ts`，不要在视图中直接访问 `window.game`。
- 新功能添加对应测试；修复缺陷添加回归测试。Three.js 相关测试先安装 `createThreeMock()`；存档测试复用 OPFS mock。详见[测试指南](docs/testing.md)。

## 提交与 Pull Request

分支使用 `feat/*`、`fix/*`、`docs/*` 或 `test/*`。提交遵循 Conventional Commits，例如：

```text
feat(multiplayer): show official server status
fix(save): recover stale slot metadata
docs(deploy): document Worker secrets
```

PR 请说明目的、影响范围和验证命令；关联 Issue。涉及界面或触摸操作时附截图或录屏；涉及 Worker 时说明部署目标、配置变量与是否迁移 Durable Object。不要在 Issue、PR 或提交中包含 API 密钥、R2 凭据或存档数据。
