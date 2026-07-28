# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### 新增
- **级联阴影（CSM）** — `CSMShadowNode` + TSL，近/中/远三级，近处清晰、远处柔和
- **电影级后期管线** — WebGPU `RenderPipeline`：GTAO、Bloom、青橙调色、暗角、胶片颗粒、FXAA
- **柔和 TSL 天空** — 调色板驱动的 LDR 天空穹顶、日轮与黄昏光带（替代易过曝的 Preetham HDR 天空）
- **PWA 支持** — `manifest.webmanifest`、Service Worker 离线缓存、安装图标与 standalone 显示
- **正方形应用图标** — SVG/PNG/ICO（`public/favicon*`、`public/icons/`）
- **InstancedMesh 碎屑粒子** — 兼容 WebGPU（Points 在 WebGPU 上仅 1px）
- **矿物分层音效** — 铁/铜/晶体等采集与破碎差异化
- **铁屑岩浅层矿脉** — 双噪声矿囊嵌入地表与表土，不再孤立立在草上
- **WebGPU 渲染** — Three.js r185，WebGPURenderer 自动降级 WebGL2
- **Vue 3 + Pinia** — 响应式 UI 与 7 个 store
- **OPFS 多存档** — 多槽位异步读写
- **PBR 材质 / ACES 色调映射** — 体素与模型统一光照
- **完整触控操作** — 虚拟摇杆、滑动视角、飞行适配
- **ESLint + Prettier + Vitest** — 质量门禁与测试

### 变更
- 阴影：单级大图 → **CSM 三级 2048²**（`CFG.CSM`）
- 后期：CSS 滤镜主调 → **TSL 电影级管线**（`CFG.POST` / `CFG.CINEMATIC` / `CFG.BLOOM` / `CFG.SSAO`）
- 天空：Canvas 渐变 / Preetham SkyMesh → **可控 LDR TSL 穹顶 + 可见日轮**
- 激光光束：对齐枪口锚点；枪械模型朝向修正（枪托向内）
- 动物 glTF：使用 `SkeletonUtils.clone` 正确绑定蒙皮（修复只见阴影不见模型）
- 动物生成：**暂时关闭**（`Fauna.SPAWN_DISABLED = true`，代码保留）
- 曝光与光照整体柔化，避免天边过曝
- 测试数量更新至约 199 项

### 修复
- 激光光束消失/朝向错误、枪口与光束起点错位
- 天空灰白（雾染远平面 + HDR 过曝）
- 采集碎屑不可见（WebGPU Points 限制）
- 控制台：favicon 404、`willReadFrequently`、`powerPreference` 警告
- 蒙皮生物克隆后不可见

## [1.0.0] - 2026-07-25

### 新增
- 首次发布
- 体素世界生成（4 种星球类型）
- 玩家移动、跳跃、喷气背包
- 激光采集与方块放置
- 背包系统与合成
- 星舰修复、起飞、飞行、跃迁
- 生物系统（程序化生成 + AI）
- 任务与里程碑系统
- 程序化音频（Web Audio API）
- 程序化纹理（Canvas 2D）
- 自定义天空穹顶着色器
- 风暴系统
- 分析目镜与扫描系统
- 存档/读档
