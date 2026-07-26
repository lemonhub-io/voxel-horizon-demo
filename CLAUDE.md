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
```

Three.js r185 is installed via npm, bundled by Vite. WebGPU renderer with WebGL2 fallback.

## Architecture

TypeScript (strict mode, no `any`) with Vite. ES modules with proper imports/exports. Entry point is `src/main.ts`, loaded via `<script type="module">` in `index.html`. Cross-file types are in `src/types.ts`.

### Core Classes and Objects

| Class/Object | File | Role |
|---|---|---|
| `Game` | main.ts | Central state machine (`title`→`loading`→`intro`→`play`, also `pause`/`dead`/`warp`). Owns the main loop (`Game.loop()` via `requestAnimationFrame`), input routing, and all subsystem instances. |
| `Input` | main.ts | Static object. Keyboard/mouse state (`keys`, `buttons`, `dx`, `dy`). Dispatches to `Game.onKey`, `Game.onMouseDown`, `Game.onWheel`. |
| `World` | world.ts | Chunk-based voxel terrain. Chunks are 16×64×16 (`CFG.CHUNK` × `CFG.WORLD_H`). Handles procedural terrain generation via simplex noise, mesh building (greedy-style), and block edits persistence. |
| `Player` | player.ts | First-person controller. Movement, gravity, jetpack, mining (laser), block placement, visor analysis, survival stats (HP, hazard protection, life support). |
| `Ship` | ship.ts | Starship mesh, flight physics, launch/land/warp sequence. Components need repair before launch. |
| `Inventory` | inventory.ts | Item storage, crafting (`RECIPES`), hotbar (9 slots), drag-and-drop. |
| `HUD` | hud.ts | All 2D HUD rendering: compass, stat bars, toasts, mission card, planet card, markers, milestone popups. |
| `Sky` | sky.ts | Custom GLSL shader sky dome. Day/night cycle, stars, palette-driven colors. |
| `FX` | effects.ts | Particle system, laser beam rendering, screen shake, warp visual effect. |
| `Fauna` | entities.ts | Procedural creature generation from planet seed. Simple wander/flee AI. |
| `AudioEngine` | audio.ts | All sound via Web Audio API oscillators — zero audio files. Procedural music, SFX, ambient loops. |
| `TextureAtlas` | atlas.ts | Canvas-based procedural texture atlas. Built per-planet from palette colors and seed. |
| `Missions` | missions.ts | Linear quest progression (repair ship → launch → warp). |
| `Milestones` | missions.ts | Achievement tracking (walk distance, blocks mined, etc.). |
| `Save` | save.ts | `localStorage` serialization. Single object: `Save.save(game)` / `Save.load()`. |
| `U` | utils.ts | Math utilities, `SimplexNoise`, planet name generator, color helpers. |

### Key Patterns

- **All state lives on `Game` or its sub-instances.** `window.game` is the singleton. Access subsystems via `game.world`, `game.player`, `game.inv`, etc.
- **Procedural everything.** Textures, terrain, creatures, planet names, flora names, and audio are all generated at runtime from seeds. There are zero external asset files (no images, audio, or 3D models).
- **Palettes drive the planet.** `PALETTES` in config.ts defines 6 biome types (lush, scorched, frozen, exotic, toxic, barren). Each palette specifies colors, hazard type/rate, tree types, flora/fauna density, and storm behavior. `game.palette` is the active one.
- **Block/item definitions are data-driven.** `B` enum → `BLOCK_DEF` array (block properties). `ITEMS` object (item properties). `RECIPES` array (crafting). All in config.ts.
- **ES modules.** Files use `import`/`export`. Entry point `src/main.ts` imports everything. THREE.js is loaded via script tag as a global.
- **Chinese UI.** All user-facing strings (block names, item descriptions, mission text, UI labels) are in Chinese. Keep new strings consistent with existing style.

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
- `World.edits` is a `Map<string, Map<number, number>>` tracking player block modifications (serialized to save).
- `World.update(px, pz, radius)` loads/unloads chunks around the player. Render distance is configurable (3-6 chunks).
- Block meshing uses face culling (only exposed faces) with palette-colored UVs from the texture atlas.

### Save System

- `Save.save(game)` serializes: seed, palette index, player state, ship state, inventory, world edits, missions, milestones, discoveries, time.
- Stored in `localStorage` under key `CFG.SAVE_KEY` (`voxelhorizon_save_v1`).
- Settings stored separately under `CFG.SET_KEY`.
- Auto-save every 60 seconds during play. Also saves on `beforeunload`.

## Important Conventions

- **TypeScript strict mode.** No `any` types. All variables, parameters, and return types must be explicitly annotated or inferrable.
- **Three.js r185 API with WebGPU.** Uses `WebGPURenderer` (auto-fallback to WebGL2), `outputColorSpace = SRGBColorSpace`. THREE is loaded via `<script>` tag (`libs/three.webgpu.min.js`) and declared as a global namespace in `src/types.ts`.
- **Module references.** Classes reference each other through `this.g` (game reference passed in constructor) and explicit imports.
- **Seed-based generation.** Use `U.mulberry32(seed)` for seeded RNG, `U.rand(min, max)` / `U.randi(min, max)` for unseeded.
- **Type declarations.** Shared interfaces are in `src/types.ts` with `export`. THREE.js types are declared via `declare global { namespace THREE { ... } }`.
