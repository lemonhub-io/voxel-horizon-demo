# 测试指南

## 命令

```bash
npm run test            # Vitest 一次性运行，适合 CI 与提交前检查
npm run test:watch      # 本地迭代时的监听模式
npm run test:coverage   # V8 覆盖率报告
npm run typecheck
npm run lint
npm run build
```

Vitest 配置在 `vite.config.ts`，环境为 `happy-dom`。覆盖率包含 `src/**/*.ts` 与 `src/**/*.vue`，但排除测试文件、`main.ts`、`vue-main.ts`、`env.d.ts` 和 `types.ts`。测试数量会增长，请以命令输出为准。

## 测试位置

```text
src/__tests__/
├── components/   Vue 组件交互与呈现
├── stores/       Pinia 状态
├── composables/  跨屏流程与存档逻辑
├── net/          联机协议和 HTTP 客户端
├── runtime/      引擎运行时边界
└── helpers/      Three.js 与 canvas mock
```

## 编写原则

- 引擎类依赖全局 `THREE`、canvas 或 WebGL 时，在导入被测模块前调用 `createThreeMock()`；它也会提供 2D canvas stub。简单场景可在测试内设置最小 `globalThis.THREE` mock。
- Pinia store 测试在每个用例前执行 `setActivePinia(createPinia())`。
- 组件测试使用 `@vue/test-utils` 挂载；需要图标或引擎动作时 mock `runtime/game-runtime.ts` 或最小 `window.game` 契约。
- OPFS 存档测试 mock `navigator.storage.getDirectory()` 与 `localStorage`，覆盖成功、损坏数据和元数据恢复路径。
- 修复缺陷时先写能复现问题的回归测试；不要只提高行覆盖率而遗漏事件、失败分支或异步行为。

## Worker 检查

Worker 不包含在前端 Vitest 配置中。修改它们时至少执行：

```bash
npm run typecheck --prefix workers/mp-server
npm run typecheck --prefix workers/r2-cdn-proxy
```

本地联调可启动 `npm run mp:dev`，再运行前端 `npm run dev`，用 `/mp` 代理验证 HTTP 和 WebSocket 路径。
