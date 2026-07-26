# 方界深空 · VOXEL HORIZON

> 全程序化生成的体素星球探索生存游戏 — 灵感来自 No Man's Sky

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue%203-Composition%20API-42b883?logo=vuedotjs)](https://vuejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r185%20WebGPU-049ef4?logo=three.js)](https://threejs.org/)
[![Tests](https://img.shields.io/badge/Tests-191%20passed-44cc11)](#测试)

**中文** | [English](#english)

---

## 游戏简介

你是一名远行者，在一颗未知的体素星球上苏醒。你的星舰「拂晓之羽」已经坠毁，你需要：

- 🔧 **修复星舰** — 采集资源、合成组件、修复推进器和脉冲引擎
- 🌍 **探索星球** — 每颗星球都有独特的气候、生态和风暴系统
- ✈️ **起飞与跃迁** — 修复完成后起飞，合成跃迁电池前往新星球
- 🏗️ **建造庇护所** — 放置方块建造基地，抵御风暴和恶劣环境
- 📷 **扫描万物** — 用分析目镜记录生物、植物和矿物

**所有内容均为程序化生成** — 零外部资源文件，纹理、地形、生物、音频全部运行时生成。

## 截图

```
[待添加游戏截图]
```

## 技术栈

| 技术 | 用途 |
|---|---|
| **TypeScript 6** (strict) | 全量类型安全，禁止 `any` |
| **Vue 3** + Composition API | UI 框架，15 个响应式组件 |
| **Pinia** | 状态管理，7 个 store |
| **Three.js r185** + WebGPU | 3D 渲染，自动降级 WebGL2 |
| **Vite** | 开发服务器 + HMR + 生产构建 |
| **Vitest** | 单元/集成测试，191 个用例 |
| **ESLint** + **Prettier** | 代码质量 + 格式化 |

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9
- 现代浏览器（Chrome/Edge 推荐，支持 WebGPU 更佳）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/lemonhub-io/voxel-horizon-demo.git
cd voxel-horizon-demo

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器自动打开 `http://localhost:5173/`。

### 其他命令

```bash
npm run build         # 生产构建 → dist/
npm run preview       # 预览生产构建
npm run typecheck     # TypeScript 类型检查
npm run lint          # ESLint 代码检查
npm run lint:fix      # 自动修复 ESLint 问题
npm run format        # Prettier 格式化
npm run test          # 运行测试
npm run test:watch    # 监听模式测试
npm run test:coverage # 生成覆盖率报告
```

## 操作方式

| 按键 | 功能 |
|---|---|
| `W A S D` | 移动 |
| `Shift` | 冲刺 |
| `空格` | 跳跃 / 按住喷气背包 |
| `鼠标左键` | 激光采集 / 攻击 |
| `鼠标右键` | 放置方块 / 使用物品 |
| `1-9` / `滚轮` | 快捷栏选择 |
| `E` | 交互 / 进入飞船 |
| `Tab` | 背包 · 合成 · 发现 |
| `C` | 扫描脉冲（标记资源） |
| `F` | 分析目镜 |
| `Z` | 补充生命维持（消耗氧） |
| `X` | 补充危险防护（消耗钠） |
| `T` | 手电 |
| `Esc` | 暂停 |

### 飞行模式

| 按键 | 功能 |
|---|---|
| 鼠标 | 转向 |
| `W` / `S` | 油门 |
| `空格` | 加力推进 |
| `E` | 降落 |
| `J` | 跃迁（需跃迁电池） |

## 项目结构

```
src/
├── main.ts              # 游戏引擎核心（Three.js 渲染 + 游戏循环）
├── vue-main.ts          # Vue 应用入口 + 引擎初始化
├── App.vue              # 根组件（屏幕切换管理）
├── types.ts             # 共享类型定义 + THREE.js 声明
├── utils.ts             # 数学工具、噪声、名称生成器
├── config.ts            # 游戏配置（方块/物品/配方/调色板）
├── save.ts              # OPFS 存档系统
├── atlas.ts             # 程序化纹理图集
├── audio.ts             # Web Audio API 程序化音效
├── world.ts             # 体素世界/区块系统
├── sky.ts               # 天空穹顶着色器
├── effects.ts           # 粒子系统、激光、屏幕震动
├── entities.ts          # 生物生成与 AI
├── inventory.ts         # 背包、合成、快捷栏
├── ship.ts              # 星舰系统
├── player.ts            # 玩家控制器
├── hud.ts               # HUD 引擎逻辑
├── missions.ts          # 任务与里程碑
├── stores/              # Pinia 状态管理
│   ├── gameStore.ts     # 游戏全局状态
│   ├── playerStore.ts   # 玩家状态
│   ├── inventoryStore.ts# 背包状态
│   ├── shipStore.ts     # 飞船状态
│   ├── missionsStore.ts # 任务状态
│   ├── milestonesStore.ts# 里程碑状态
│   └── hudStore.ts      # HUD 状态
├── components/          # Vue 组件
│   ├── TitleScreen.vue  # 标题画面
│   ├── LoadingScreen.vue# 加载画面
│   ├── IntroScreen.vue  # 开场动画
│   ├── HudOverlay.vue   # 游戏内 HUD
│   ├── InventoryScreen.vue# 背包界面
│   ├── ShipPanel.vue    # 飞船面板
│   ├── PauseScreen.vue  # 暂停菜单
│   ├── DeathScreen.vue  # 死亡画面
│   ├── SettingsScreen.vue# 设置界面
│   ├── HelpScreen.vue   # 帮助手册
│   └── ...
└── __tests__/           # 测试文件
    ├── utils.test.ts    # 工具函数测试
    ├── config.test.ts   # 配置数据测试
    ├── stores/          # Store 测试
    ├── components/      # 组件测试
    └── helpers/         # 测试辅助（THREE mock）
```

## 游戏设计

### 星球系统

游戏包含 6 种星球类型，每种有独特的环境：

| 类型 | 气候 | 危险 | 风暴 | 生态 |
|---|---|---|---|---|
| 🌿 温和 | 微热 | 灼热/严寒 | 热浪风暴 | 丰饶 |
| 🔥 灼热 | 干旱 | 极端高温 | 烈焰风暴 | 稀疏 |
| ❄️ 冰封 | 严寒 | 极寒 | 暴风雪 | 稀疏 |
| 💜 异常 | 辐射 | 强辐射 | 辐射风暴 | 奇异 |
| ☣️ 剧毒 | 孢雾 | 毒雾 | 毒雨风暴 | 疯长 |
| 🏜️ 荒芜 | 尘暴 | 弱辐射/寒夜 | 尘暴 | 贫瘠 |

### 存档系统

使用 **OPFS（Origin Private File System）** 存储，比 localStorage 更可靠：
- 容量无限制（几百 MB）
- 异步 I/O，不阻塞主线程
- 自动存档每 60 秒
- 设置保存在 localStorage

## 测试

```bash
npm run test           # 运行全部 191 个测试
npm run test:coverage  # 查看覆盖率
```

| 模块 | 覆盖率 |
|---|---|
| Pinia Stores | 94% |
| 工具函数 | 80% |
| 背包逻辑 | 78% |
| 任务系统 | 72% |

## 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程。

## 许可证

[MIT License](LICENSE) © 2026 Janex

---

<a name="english"></a>

## English

**Voxel Horizon** is a browser-based 3D voxel exploration/survival game inspired by No Man's Sky. Explore procedurally generated planets, mine resources, craft items, repair your starship, and warp to new worlds.

**Key Features:**
- 100% procedurally generated — zero external assets
- WebGPU rendering with WebGL2 fallback
- Vue 3 + Pinia UI with TypeScript strict mode
- 191 automated tests
- OPFS-based save system

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.
