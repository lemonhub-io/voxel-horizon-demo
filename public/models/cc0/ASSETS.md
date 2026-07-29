# CC0 模型来源

本目录中的 glTF 文件均来自 Quaternius / Poly Pizza，按 **CC0 1.0 Universal** 发布，可用于商业项目、修改和再分发。

| 文件 | 游戏用途 | 来源 |
|---|---|---|
| `quaternius-bob.gltf` | 玩家飞船 | [Ultimate Spaceships Pack](https://quaternius.com/packs/ultimatespaceships.html) |
| `quaternius-alien.gltf` | 异星生物 | [Cute Animated Monsters Pack](https://quaternius.com/packs/cutemonsters.html) |
| `quaternius-crab.gltf` | 异星生物 | [Cute Animated Monsters Pack](https://quaternius.com/packs/cutemonsters.html) |
| `quaternius-deer.gltf` | 异星生物 | [Cute Animated Monsters Pack](https://quaternius.com/packs/cutemonsters.html) |
| `quaternius-scifi-assault-rifle.glb` | 玩家第一人称突击步枪 | [Scifi Assault Rifle (Poly Pizza)](https://poly.pizza/m/RGtBoJNn3N) |
| `modular-men-astronaut.glb` | 玩家世界空间身体（FPS 隐藏、投影阴影、移动/死亡动画） | [Astronaut — Ultimate Modular Men Pack](https://poly.pizza/m/3hC2i0CTuO) / [Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html) |

### 玩家模型说明

- **文件**：`modular-men-astronaut.glb`（约 1.9 MB）
- **网格**：`SpaceSuit_Feet` / `SpaceSuit_Legs` / `SpaceSuit_Body` / `SpaceSuit_Head`（人形宇航服，**不是** Ultimate Space Kit 的 `FinnTheFrog`）
- **作者**：Quaternius · **许可**：CC0 1.0
- **动画**：Idle / Walk / Run / Death / Roll 等 24 条（`CharacterArmature|*`）
- **运行时**：`CC0_MODEL_URLS.player` → `Player.loadPlayerBody()` / `RemotePlayer`
- **下载**：`https://static.poly.pizza/0076345b-bbea-42d5-931c-4a5ad2050b18.glb`

> 已彻底移除旧版 Ultimate Space Kit 青蛙宇航员（`FinnTheFrog` / 原 `quaternius-astronaut.glb`）。请勿再引入该资产。
