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
npm run test        # run tests (193 tests)
npm run test:coverage # coverage report
```

Three.js r185 is installed via npm, bundled by Vite. WebGPU renderer with WebGL2 fallback.

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
| `Sky` | sky.ts | TSL sky dome shader, lighting, fog |
| `Starfield` | starfield.ts | 2D canvas star overlay |
| `FX` | effects.ts | Particles, laser, screen shake |
| `Fauna` | entities.ts | Creature generation and AI |
| `AudioEngine` | audio.ts | Web Audio API procedural sound |
| `TextureAtlas` | atlas.ts | 32×32 procedural texture atlas |
| `PostFX` | postfx.ts | CSS post-processing effects |
| `PostProcessing` | post-processing.ts | EffectComposer pipeline |
| `Missions` | missions.ts | Quest progression + milestones |
| `Save` | save.ts | OPFS multi-slot save system |

### Key Patterns

- **All state lives on `Game` or its sub-instances.** `window.game` is the singleton.
- **Procedural everything.** Textures, terrain, creatures, planet names, flora names, and audio are all generated at runtime from seeds. Zero external asset files.
- **Palettes drive the planet.** `PALETTES` in config.ts defines 4 biome types. Each specifies colors, hazard type, tree types, flora/fauna density, and storm behavior.
- **Block/item definitions are data-driven.** `B` enum → `BLOCK_DEF` array. `ITEMS` object. `RECIPES` array. All in config.ts.
- **ES modules with Vue.** Files use `import`/`export`. Entry point `src/vue-main.ts` bootstraps Vue + Pinia + Game engine.
- **Pinia stores bridge engine and UI.** Game engine writes to stores, Vue components read reactively.
- **Chinese UI.** All user-facing strings are in Simplified Chinese.
- **TSL shaders.** Sky dome uses Three.js Shading Language node materials for WebGPU compatibility.

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
- **TSL sky shader** — Rayleigh scattering, stars, dusk band via node materials
- **PBR materials** — `MeshStandardMaterial` with roughness/metalness
- **Shadow maps** — 2048² PCFSoftShadowMap
- **HDR tone mapping** — ACES Filmic, exposure 2.5
- **32×32 pixel textures** — NearestFilter mag + LinearMipmapLinearFilter min
- **CSS post-processing** — contrast(1.12), saturate(1.2), brightness(1.02)

## Important Conventions

- **TypeScript strict mode.** No `any` types. All variables, parameters, and return types must be explicitly annotated or inferrable.
- **Three.js r185 API.** Uses `WebGPURenderer`, `TSL` node materials, `outputColorSpace = SRGBColorSpace`. THREE is loaded via `three-setup.ts` and set as a global.
- **Module references.** Classes reference each other through `this.g` (game reference passed in constructor) and explicit imports.
- **Seed-based generation.** Use `U.mulberry32(seed)` for seeded RNG, `U.rand(min, max)` / `U.randi(min, max)` for unseeded.
- **Type declarations.** Shared interfaces are in `src/types.ts` with `export`. THREE.js types are declared via `declare global { namespace THREE { ... } }`.
