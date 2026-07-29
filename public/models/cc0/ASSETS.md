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
| `quaternius-astronaut.glb` | 玩家世界空间身体（FPS 隐藏、投影阴影、死亡/移动动画） | [Astronaut — Ultimate Space Kit (Poly Pizza)](https://poly.pizza/m/0D54W8yfrA) / [Ultimate Space Kit](https://quaternius.com/packs/ultimatespacekit.html) |

### 宇航员模型说明

- 文件：`quaternius-astronaut.glb`（约 716 KB，glTF binary）
- 作者：[Quaternius](https://quaternius.com/)
- 许可：**CC0 1.0 Universal**（公共领域，可商用/修改/再分发，无需署名）
- 包体：Ultimate Space Kit（低多边形科幻角色，贴合无人深空画风）
- 特性：约 8.6k tris，带动画（Idle/Walk/Run/Jump/Death 等），FBX/GLTF 同源
- 运行时：`CC0_MODEL_URLS.player` → `Player.loadPlayerBody()`（SkeletonUtils 克隆 + AnimationMixer）
- 下载：`https://static.poly.pizza/f06659f2-e505-43df-a3db-84faec811a57.glb`

这些来源页明确提供 glTF/GLB 格式并标注 CC0。保留该清单是为了便于复核资产许可与后续替换。
