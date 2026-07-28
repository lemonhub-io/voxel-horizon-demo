# 方界深空 · VOXEL HORIZON

> 全程序化生成的体素星球探索生存游戏 — 灵感来自 No Man's Sky

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue%203-Composition%20API-42b883?logo=vuedotjs)](https://vuejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r185%20WebGPU-049ef4?logo=three.js)](https://threejs.org/)
[![Tests](https://img.shields.io/badge/Tests-199%20passed-44cc11)](#测试)
[![PWA](https://img.shields.io/badge/PWA-ready-5a0fc8)](#pwa)

---

## 游戏简介

你是一名远行者，在一颗未知的体素星球上苏醒。你的星舰「拂晓之羽」已经坠毁，你需要：

- 🔧 **修复星舰** — 精炼材料、合成组件、修复推进器和脉冲引擎
- 🌍 **探索星球** — 每颗星球都有独特的气候、生态和风暴系统
- ✈️ **起飞与跃迁** — 修复完成后起飞，合成跃迁电池前往新星球
- 🏗️ **建造庇护所** — 放置方块建造基地，抵御风暴和恶劣环境
- 📷 **扫描万物** — 用分析目镜记录生物、植物和矿物

**程序化生成** — 纹理、地形、音频、名称等运行时生成；飞船 / 步枪 / 生物等使用仓库内 **CC0** glTF（亦可经 CDN 加载）。

## 技术栈

| 技术 | 用途 |
|---|---|
| **TypeScript** (strict) | 全量类型安全，禁止 `any` |
| **Vue 3** + Composition API | UI 框架，响应式组件 |
| **Pinia** | 状态管理，7 个 store |
| **Three.js r185** + WebGPU | 3D 渲染，TSL 着色器，自动降级 WebGL2 |
| **Vite** | 开发服务器 + HMR + 生产构建 |
| **Vitest** | 单元/集成测试，约 199 个用例 |
| **ESLint** + **Prettier** | 代码质量 + 格式化 |
| **PWA** | Manifest + Service Worker，可安装 / 可离线壳层 |

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
node scripts/generate-icons.mjs  # 重新生成 PWA / favicon 正方形图标
```

## PWA

生产构建支持安装为 Progressive Web App：

- `public/manifest.webmanifest` — 名称、standalone、主题色、图标
- `public/sw.js` — 预缓存壳层 + 运行时缓存同源静态资源
- `src/pwa.ts` — 仅在 **production** 注册 Service Worker（避免 dev HMR 冲突）
- 图标：简洁 2D 正方形（深底 + 青色方块），见 `public/favicon.svg` 与 `public/icons/`

验证：

```bash
npm run build && npm run preview
```

在 Chrome DevTools → Application 中检查 Manifest 与 Service Worker。

## 操作方式

| 按键 | 功能 |
|---|---|
| `W A S D` | 移动（自动翻越单格方块） |
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

### 移动与跳跃手感

- 跳跃输入会保留 **120ms**；在落地前按下跳跃也能及时起跳。
- 离开边缘后的 **100ms** 内仍可跳跃，降低误操作造成的坠落感。
- 轻触后松开跳跃键可获得较低的跳跃高度；持续按住则可在空中启用喷气背包。

### 移动端

游戏会在触控设备上自动显示操作界面：

| 手势 / 按钮 | 功能 |
|---|---|
| 左侧虚拟摇杆 | 移动；双击切换疾跑 |
| 右侧空白区域拖动 | 转动视角 |
| 短击场景 | 放置当前快捷栏方块 / 使用物品 |
| 长按场景 | 持续采集方块或攻击生物 |
| 点击近处飞船模型 | 打开飞船状态面板，可修复、加注并登舰起飞 |
| 右下角跳跃键 | 跳跃 / 按住喷气背包 |
| 顶部图标 | 扫描、分析目镜、背包与暂停 |

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
├── main.ts              # 游戏引擎核心（渲染 + 游戏循环）
├── vue-main.ts          # Vue 入口 + PWA 注册
├── pwa.ts               # Service Worker 注册辅助
├── App.vue              # 根组件（屏幕切换）
├── types.ts / env.d.ts  # 类型与 three/addons 模块声明
├── utils.ts / config.ts # 工具与数据驱动配置（含 CSM/SSAO/电影滤镜）
├── world.ts             # 体素世界（浅层铁脉、深层铜矿）
├── sky.ts               # 柔和 TSL 天空 + 日轮 + CSM 太阳光
├── starfield.ts         # 2D 夜间星空叠加
├── post-processing.ts   # WebGPU 电影级后期（GTAO/Bloom/调色/FXAA）
├── postfx.ts            # CSS 健康晕影 / 电影黑边
├── effects.ts           # InstancedMesh 碎屑、激光光束
├── entities.ts          # 生物 AI（SPAWN_DISABLED 可关生成）
├── cc0-models.ts        # glTF 加载（SkeletonUtils 蒙皮克隆）
├── player.ts / ship.ts / inventory.ts / audio.ts / …
├── stores/ · components/
└── __tests__/           # 约 199 个用例
public/
├── manifest.webmanifest · sw.js · favicon* · icons/
└── models/cc0/          # CC0 飞船 / 步枪 / 生物模型
```

## 游戏设计

### 任务链（无人深空风格）

| 阶段 | 任务 | 核心体验 |
|---|---|---|
| **生存** | 坠毁信号 → 防护系统 → 扫描仪 → 生命维持 | 学会在星球上生存 |
| **精炼** | 材料精炼 → 修推进器 → 修引擎 | 掌握合成系统 |
| **起飞** | 加注燃料 → 起飞 | 驾驶飞船 |
| **开拓** | 天际之后 → 无尽旅程 | 自由探索 |

### 合成体系（15 个配方）

| 层级 | 配方 | 说明 |
|---|---|---|
| **原材料→精炼** | 金属镀层、碳纳米管、玻璃板、导线 | 基础材料加工 |
| **精炼→高级** | 微芯片、能量电池、启动燃料、跃迁电池 | 高级科技产品 |
| **补给品** | 钠电池、氧气罐、修复凝胶 | 生存保障 |
| **建材** | 木板、玻璃块、合金块、灯柱 | 建造用 |

### 星球系统（4 种类型）

| 类型 | 气候 | 危险 | 风暴 | 生态 |
|---|---|---|---|---|
| 🌿 温带 | 温和 | 严寒（夜间） | 热浪风暴 | 丰饶 |
| 🔥 灼热 | 干旱 | 极端高温 | 烈焰风暴 | 稀疏 |
| 冰封 | 严寒 | 极寒 | 暴风雪 | 稀疏 |
| 💜 异常 | 辐射 | 强辐射 | 辐射风暴 | 奇异 |

### 渲染管线

- **WebGPU 渲染器**（Three.js r185）自动降级 WebGL2
- **柔和 TSL 天空** — 调色板渐变穹顶、日轮光晕、黄昏光带（`sky.ts`）
- **级联阴影 CSM** — `CSMShadowNode`，近/中/远三级（`CFG.CSM`）
- **电影级后期** — GTAO → Bloom → 青橙调色 → 暗角 → 胶片颗粒 → ACES → FXAA（`CFG.CINEMATIC` 等）
- **PBR 材质** — `MeshStandardMaterial` + 程序化法线
- **ACES 色调映射** — exposure 约 0.9（与柔和天空匹配）
- **32×32 像素纹理图集** — Mipmap 远景平滑

### 存档系统

使用 **OPFS（Origin Private File System）** 支持多存档：
- 10 个存档槽位
- 每 60 秒自动存档
- 存档管理界面

## 测试

```bash
npm run test           # 运行全部 193 个测试
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
