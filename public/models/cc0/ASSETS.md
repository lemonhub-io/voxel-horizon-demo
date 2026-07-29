# CC0 模型来源

本目录中的 glTF 文件均来自 Quaternius，按 **CC0 1.0 Universal** 发布，可用于商业项目、修改和再分发。

运行时从 `v0.1.0` 标签对应的 jsDelivr CDN 加载模型，格式为：

```text
https://cdn.jsdelivr.net/gh/lemonhub-io/voxel-horizon-demo@v0.1.0/public/models/cc0/<模型文件名>
```

同一批文件也作为 GitHub Release `v0.1.0` 的附件发布，方便离线下载与许可复核。

| 文件 | 游戏用途 | 来源 |
|---|---|---|
| `quaternius-bob.gltf` | 玩家飞船 | [Ultimate Spaceships Pack](https://quaternius.com/packs/ultimatespaceships.html) |
| `quaternius-alien.gltf` | 异星生物 | [Cute Animated Monsters Pack](https://quaternius.com/packs/cutemonsters.html) |
| `quaternius-crab.gltf` | 异星生物 | [Cute Animated Monsters Pack](https://quaternius.com/packs/cutemonsters.html) |
| `quaternius-deer.gltf` | 异星生物 | [Cute Animated Monsters Pack](https://quaternius.com/packs/cutemonsters.html) |
| `quaternius-scifi-assault-rifle.glb` | 玩家第一人称突击步枪 | [Scifi Assault Rifle (Poly Pizza)](https://poly.pizza/m/RGtBoJNn3N) |
| `quaternius-astronaut.glb` | 玩家世界空间身体（FPS 隐藏、投影阴影、死亡/移动动画） | [Astronaut — Ultimate Modular Men Pack (Poly Pizza)](https://poly.pizza/m/3hC2i0CTuO) / [Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html) |

### 宇航员模型说明

- 文件：`quaternius-astronaut.glb`（约 1.9 MB，glTF binary）
- 作者：[Quaternius](https://quaternius.com/)
- 许可：**CC0 1.0 Universal**（公共领域，可商用/修改/再分发，无需署名）
- 包体：**Ultimate Modular Men Pack** 人形宇航服（橙白防护服 + 头盔），替代原 Ultimate Space Kit 的青蛙头变体
- 特性：约 5.3k tris，蒙皮动画（Idle/Walk/Run/Death 等；空中动作映射到 Run_Back）
- 运行时：`CC0_MODEL_URLS.player` → `Player.loadPlayerBody()` / `RemotePlayer`（SkeletonUtils 克隆 + AnimationMixer）
- 下载：`https://static.poly.pizza/0076345b-bbea-42d5-931c-4a5ad2050b18.glb`

这些来源页明确提供 glTF/GLB 格式并标注 CC0。保留该清单是为了便于复核资产许可与后续替换。
