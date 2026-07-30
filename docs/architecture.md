# 架构说明

## 前端边界

浏览器应用由 Vue 外壳和惰性加载的 Three.js 引擎组成：

```text
vue-main.ts → Vue + Pinia
                    ↓ 用户操作
App.vue / components → composables → engine-loader.ts → Game (main.ts)
                    ↑ 响应式状态             ↓
                 Pinia stores ← 引擎的 syncStore()
```

`engine-loader.ts` 是进入 `main.ts` 的唯一 UI 入口。它动态导入引擎、创建单例并经 `runtime/game-runtime.ts` 注册；这样标题、帮助和存档界面不会提前下载 Three.js/WebGPU。`App.vue` 负责根据 `game.state` 组合屏幕，游戏流程位于 `useGameFlow`，存档位于 `useSaveSlots`。

## 引擎与界面

- `main.ts`：`Game` 状态机、主循环与输入协调；不放置 DOM 界面。
- `world.ts`、`player.ts`、`ship.ts`、`inventory.ts`、`missions.ts`：游戏规则与实体状态。
- `stores/`：Pinia 的 UI 快照。引擎改变库存或飞船等数据后显式调用 `syncStore()`。
- `components/`：纯视图及事件转发；复杂交互优先移至 `composables/`。
- `runtime/game-runtime.ts`：浏览器全局引擎的唯一边界，供 UI 与低层输入模块窄化依赖。

## 渲染与资产

引擎从 `three/webgpu` 导入 Three.js r185；WebGPU 不可用时降级 WebGL2。世界、纹理、音频和名称由种子生成。仅 `public/models/cc0/` 保存可选的 CC0 glTF/GLB 模型，许可见该目录的 `ASSETS.md`。PWA 入口在 `src/pwa.ts`；`public/sw.js` 负责版本化的离线壳和运行时缓存。

## 联机架构

```text
浏览器 MultiplayerApi ─HTTP→ mp Worker 路由
浏览器 NetClient      ──WS──→ Durable Object
                                   ├─ PlanetRoom：玩家主机房间的中继
                                   └─ OfficialRoom：官方星域权威
                                                     ↓
                                            DO SQLite + R2 归档
```

`MultiplayerApi` 与 `NetClient` 分别处理发现/创建 API 与 WebSocket 传输，`MultiplayerSession` 负责会话组合。玩家主机房间的世界快照由房主提供；官方 `official-main` 验证并广播方块编辑，约每 15 秒或最后一名玩家离开时归档到 R2。

## 保存与配置

`Save` 把本地进度保存在 OPFS 的 `saves/slot-N.json`，并维护元数据文件；写入会串行化以避免元数据与存档不一致。当前槽号和设置使用 `localStorage`。联机进度不作为本地单人存档保存。
