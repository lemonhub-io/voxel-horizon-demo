# AGENTS.md

Compact guidance for AI agents working in `voxel-horizon-demo`.
For game-design / systems detail, see `CLAUDE.md` and `README.md`.

## Project shape

- Frontend package plus two self-contained Worker packages under `workers/` (not an npm workspace). Frontend: TS + Vite + Vue 3 + Pinia + Three.js r185 (WebGPU build).
- Engine (`src/main.ts`) and Vue UI (`src/App.vue`, `src/components/`) are split; `src/stores/` Pinia stores are the bridge, while `src/composables/` owns cross-screen flows.
- No CI workflows directory (`.github/` absent) — the `typecheck → lint → test → build` checklist from `CONTRIBUTING.md` is enforced at PR-review time only.

## Commands (require `npm install` first)

```bash
npm run dev          # Vite; auto-opens browser (server.open:true in vite.config.ts)
npm run build        # vite build → dist/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/  (only src/, never root configs)
npm run lint:fix
npm run format       # prettier --write src/  (only src/)
npm run format:check
npm run test         # vitest run — ONE-SHOT, not watch
npm run test:watch   # watch mode
npm run test:coverage
```

Non-obvious:
- The Vitest `test` config block lives inside `vite.config.ts` (no separate `vitest.config.ts`).
- Test environment is `happy-dom`.
- `npm run test` does not watch — use `npm run test:watch` while iterating.
- `lint`/`format` scope is `src/`; root files like `eslint.config.js`, `vite.config.ts`, `index.html` are not linted.

## Three.js init — non-obvious gotchas

- Engine modules import directly from **`three/webgpu`** (not `three`) and use that namespace as the bare `THREE` global via `src/types.ts` (`import type * as THREE from 'three/webgpu'` + `declare global { namespace THREE {...} }`). `src/vue-main.ts` ties engine init to Vue via `src/engine-loader.ts`, which lazily `await import('./main')` only when the player starts/continues a game — **do not** statically `import from './main'` in App/UI code or you'll pull the whole Three.js + WebGPU graph into the initial chunk and break lazy load.
- `@types/three` is pinned at `^0.185.1` (matched to the installed `three@0.185.x`). Type declarations for `three/addons/...` (CSM, GTAO, SkyMesh, GLTFLoader, etc.) live as ambient `declare module` blocks in **`src/env.d.ts`** — this is the source of truth, do not install separate `@types/three/*` packages.
- `window.game` is the runtime `Game` singleton, set only after lazy engine creation in `engine-loader.ts`. UI code reaches it through `src/runtime/game-runtime.ts` rather than reading the window global directly.

## Engine ↔ UI data flow

- `main.ts` is the engine only — **no DOM UI**. All screens are Vue components.
- Engine writes to Pinia via `this.stores.*`. `Game._stores` is lazily initialized inside `_getStores()`. Accessing `this.stores` before Pinia is installed throws — keep Pinia init order in `vue-main.ts`.
- `Inventory` (`src/inventory.ts`) and `Ship` (`src/ship.ts`) expose explicit `syncStore()` methods. Call these after mutating engine-side state so the Vue UI reflects it; existing call sites in `player.ts`/`missions.ts` show the pattern.
- Vue components read stores and route user actions through `runtime/game-runtime.ts` or a focused composable.
- `App.vue` is the screen router keyed on `game.state`; `useGameFlow`, `useSaveSlots`, and `useMultiplayerLobby` own startup, saves, and lobby state. Add a screen as a component plus its `v-if` block, keeping orchestration out of the view.

## Tests

- Test counts drift as the project grows — run `npm run test` for the current number instead of trusting a pinned figure. Files live in `src/__tests__/`, plus `components/`, `stores/`, `composables/`, `net/`, and `runtime/` subdirectories.
- Engine classes read the **global `THREE`** and WebGL/canvas APIs, which `happy-dom` does not provide. Tests must install a THREE mock before importing the class under test:
  - Helper: `import { createThreeMock } from './helpers/three-mock'` (adjust path), then call `createThreeMock()` at the top of the file. See `ship.test.ts`, `hud.test.ts`, `missions.test.ts`.
  - For narrow cases you can inline a smaller `(globalThis as Record<string, unknown>).THREE = { ... }` (see `world.test.ts`).
  - The helper also stubs `HTMLCanvasElement.prototype.getContext('2d')` for atlas/HUD tests hitting canvas.
- Pinia store tests (`src/__tests__/stores/`) use `setActivePinia(createPinia())` in `beforeEach`. No THREE mock needed — stores are pure state.
- Component tests (`src/__tests__/components/`) mount via `@vue/test-utils` and typically mock `window.game` for `atlas.icon(...)`.
- Save tests (`src/__tests__/save.test.ts`) mock `navigator.storage.getDirectory()` (OPFS) and `localStorage` — reuse this setup for any OPFS-touching test.
- Coverage includes `src/**/*.ts` + `src/**/*.vue` but **excludes** `src/__tests__/**`, `src/main.ts`, `src/vue-main.ts`, `src/env.d.ts`, `src/types.ts` — these are exempt.

## TypeScript / ESLint conventions (enforced as errors)

- `strict`: true + `noImplicitAny`, `strictNullChecks`, `strictPropertyInitialization`, `noImplicitReturns`, `noFallthroughCasesInSwitch` (tsconfig.json). Function return types are NOT enforced.
- Error-level ESLint rules: `@typescript-eslint/no-explicit-any`, `prefer-const`, `no-var`. `no-console` = warn, only `console.warn`/`console.error` allowed.
- `no-undef` is **off** in ESLint (TypeScript handles it). Bare globals like `THREE` will not trip ESLint — don't be surprised; `THREE` is declared in `eslint.config.js` `languageOptions.globals` as `readonly`.
- Use `import type { ... }` for type-only imports (per `CONTRIBUTING.md`).
- Vue: `<script setup>` + Composition API, PascalCase names, TS-typed props. `vue/multi-word-component-names` is off.

## Style conventions (not tool-enforced)

- All user-facing strings are Simplified Chinese. Match existing tone when adding UI text.
- Assets are procedural-first — textures, terrain, creatures, audio, names are all generated at runtime from seeds (see `utils.ts` `U.mulberry32`, `U.seedFromString`, `PALETTES` in `config.ts`). The only prebuilt assets shipped are optional CC0 glTF models under `public/models/cc0/` (see `src/cc0-models.ts`, `CLAUDE.md`); do not add other image/audio files to the repo without matching that pattern.

## Git workflow

- Conventional Commits: `<type>(<scope>): <description>` where type ∈ `feat|fix|docs|style|refactor|test|chore`.
- Branch prefixes: `feat/*`, `fix/*`, `docs/*`, `test/*`.
- Not enforced by automation — enforced at review time only.
