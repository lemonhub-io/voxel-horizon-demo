# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voxel Horizon (方界深空) is a browser-based 3D voxel exploration/survival game inspired by No Man's Sky. The player explores procedurally generated voxel planets, mines resources, crafts items, repairs a crashed starship, and warps to new planets. All UI text is in Simplified Chinese.

## Development

```bash
npm install         # install dependencies
npm run dev         # start Vite dev server with HMR
npm run build       # production build → dist/
npm run preview     # preview production build
npm run typecheck   # type-check only (no output)
npm run lint        # ESLint check
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier format
npm run test        # run tests (~199 tests)
npm run test:coverage # coverage report
node scripts/generate-icons.mjs  # regenerate PWA/favicon square icons
```

Three.js r185 is installed via npm, bundled by Vite. WebGPU renderer with WebGL2 fallback. Production builds register a service worker (`src/pwa.ts` + `public/sw.js`).

## Architecture

TypeScript (strict mode, no `any`) with Vite. Vue 3 + Pinia for UI. Three.js r185 with WebGPU/TSL. Entry point is `src/vue-main.ts`.

### Core Classes and Objects

| Class/Object | File | Role |
|---|---|---|
| `Game` | main.ts | Central state machine, main loop, input routing |
| `Input` | main.ts | Keyboard/mouse state |
| `World` | world.ts | Chunk-based voxel terrain (16×64×16 chunks) |
| `Player` | player.ts | First-person controller, survival mechanics |
| `Ship` | ship.ts | Starship, flight physics, launch/land/warp |
| `Inventory` | inventory.ts | Item storage, crafting, hotbar |
| `HUD` | hud.ts | Compass canvas, marker management |
| `Sky` | sky.ts | Soft TSL skydome + sun disc, directional light, CSM |
| `Starfield` | starfield.ts | 2D canvas star overlay |
| `FX` | effects.ts | InstancedMesh debris, laser beam, shake, warp |
| `Fauna` | entities.ts | Creature AI (generation gated by `Fauna.SPAWN_DISABLED`) |
| `AudioEngine` | audio.ts | Web Audio API procedural sound |
| `TextureAtlas` | atlas.ts | 32×32 procedural texture atlas |
| `PostFX` | postfx.ts | CSS health vignette / letterbox |
| `PostProcessing` | post-processing.ts | WebGPU cinematic pipeline (GTAO/Bloom/grade/FXAA) |
| `Missions` | missions.ts | Quest progression + milestones |
| `Save` | save.ts | OPFS multi-slot save system |

### Key Patterns

- **All state lives on `Game` or its sub-instances.** `window.game` is the singleton.
- **Mostly procedural.** Textures, terrain, audio, names from seeds; optional CC0 glTF models under `public/models/cc0/` (skinned fauna must use `SkeletonUtils.clone` via `cc0-models.ts`).
- **Palettes drive the planet.** `PALETTES` in config.ts defines 4 biome types. Each specifies colors, hazard type, tree types, flora/fauna density, and storm behavior.
- **Block/item definitions are data-driven.** `B` enum → `BLOCK_DEF` array. `ITEMS` object. `RECIPES` array. All in config.ts. Graphics knobs: `CFG.CSM`, `CFG.SSAO`, `CFG.BLOOM`, `CFG.CINEMATIC`, `CFG.POST`.
- **ES modules with Vue.** Entry point `src/vue-main.ts` bootstraps Vue + Pinia + Game engine + PWA registration.
- **Pinia stores bridge engine and UI.** Game engine writes to stores, Vue components read reactively.
- **Chinese UI.** All user-facing strings are in Simplified Chinese.
- **TSL shaders.** Soft sky dome and cinematic post stack use Three.js Shading Language for WebGPU.

### Game State Machine

`Game.state` controls what runs in the main loop:
- `title` — title screen with star canvas animation
- `loading` — chunk pregeneration with progress bar
- `intro` — typewriter intro sequence (click to skip)
- `play` — active gameplay (player, world, fauna, storms, auto-save every 60s)
- `pause` — paused, pointer lock released
- `dead` — death screen, respawn available
- `warp` — interplanetary warp sequence (timed, ~5s total)

### World/Chunk System

- Chunks: 16×64×16 voxels. Terrain height generated via `SimplexNoise` with palette-specific parameters.
- **Ores:** ferrite forms shallow dual-noise veins / surface outcrops (depth 0–9); copper remains deeper stone veins. Do not place ferrite as isolated props on grass.
- `World.edits` is a `Map<string, Map<number, number>>` tracking player block modifications.
- `World.update(px, pz, radius)` loads/unloads chunks around the player. Render distance is configurable (3-6 chunks).
- Block meshing uses face culling with ambient occlusion and palette-colored UVs from the texture atlas.

### Save System

- Uses **OPFS (Origin Private File System)** for multi-slot saves
- `Save.save(game, slot?)` — async write to `saves/slot-N.json`
- `Save.load(slot?)` — async read
- `Save.listSlots()` — list all save metadata
- Settings stored in localStorage (sync)
- Auto-save every 60 seconds during play

### Rendering Pipeline

- **Three.js r185** with `WebGPURenderer` (auto WebGL2 fallback)
- **Soft TSL sky** — palette gradient dome + sun disc/halo (`sky.ts`); 2D starfield at night
- **CSM** — `CSMShadowNode` on directional sun light (`CFG.CSM`, near/mid/far)
- **Cinematic post** — GTAO → Bloom → grade → vignette → grain → ACES → FXAA (`post-processing.ts`)
- **PBR materials** — `MeshStandardMaterial` with roughness/metalness + atlas normals
- **Tone mapping** — ACES Filmic, exposure ≈ 0.9
- **32×32 pixel textures** — NearestFilter mag + LinearMipmapLinearFilter min
- **CSS overlays** — health vignette, light letterbox (`postfx.ts`)

## Important Conventions

- **TypeScript strict mode.** No `any` types. All variables, parameters, and return types must be explicitly annotated or inferrable.
- **Three.js r185 API.** Uses `WebGPURenderer`, `TSL` node materials, `outputColorSpace = SRGBColorSpace`. THREE is loaded via `three-setup.ts` and set as a global.
- **Module references.** Classes reference each other through `this.g` (game reference passed in constructor) and explicit imports.
- **Seed-based generation.** Use `U.mulberry32(seed)` for seeded RNG, `U.rand(min, max)` / `U.randi(min, max)` for unseeded.
- **Type declarations.** Shared interfaces are in `src/types.ts` with `export`. THREE.js types are declared via `declare global { namespace THREE { ... } }`.
