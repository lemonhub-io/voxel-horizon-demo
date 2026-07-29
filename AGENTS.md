# AGENTS.md

Compact guidance for AI agents working in `voxel-horizon-demo`.
For game-design / systems detail, see `CLAUDE.md` and `README.md`.

## Project shape

- Single package (not a monorepo). TS + Vite + Vue 3 + Pinia + Three.js r185 (WebGPU build).
- Engine (`src/main.ts`) and Vue UI (`src/App.vue`, `src/components/`) are split; `src/stores/` Pinia stores are the bridge.
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

- The renderer is imported from **`three/webgpu`** (not `three`) in `src/three-setup.ts`, which attaches it to **`window.THREE`** as a global. Engine code everywhere reads the bare global `THREE`.
- `src/vue-main.ts` imports `'./three-setup'` FIRST, before Vue/Pinia/`./main`. **Do not reorder** this import — engine code will fail with cryptic "THREE is not defined" errors at runtime.
- `@types/three` is pinned at `^0.128` (old) intentionally; type declarations for `three/webgpu`, `three/tsl`, `Mesh*NodeMaterial`, and TSL functions live as ambient `declare module` blocks in **`src/three-webgpu.d.ts`** and **`src/env.d.ts`**. These ambient files are the source of truth — do **not** install `@types/three/webgpu`, `@types/three/tsl`, or try to match `@types/three` to r185.
- `window.game` is the runtime `Game` singleton, set in `vue-main.ts`.

## Engine ↔ UI data flow

- `main.ts` is the engine only — **no DOM UI**. All screens are Vue components.
- Engine writes to Pinia via `this.stores.*`. `Game._stores` is lazily initialized inside `_getStores()`. Accessing `this.stores` before Pinia is installed throws — keep Pinia init order in `vue-main.ts`.
- `Inventory` (`src/inventory.ts`) and `Ship` (`src/ship.ts`) expose explicit `syncStore()` methods. Call these after mutating engine-side state so the Vue UI reflects it; existing call sites in `player.ts`/`missions.ts` show the pattern.
- Vue components read stores and route user actions back to the engine via `(window as unknown as { game }).game`.
- `App.vue` is the screen router keyed on `game.state`. Adding a screen = new component + `v-if` block in `App.vue`.

## Tests

- 193 tests across 25 files (verified). Files live in `src/__tests__/`, plus `src/__tests__/components/` (10) and `src/__tests__/stores/` (7).
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
- Zero external assets — textures, terrain, creatures, audio, names are all procedurally generated from seeds (see `utils.ts` `U.mulberry32`, `U.seedFromString`, `PALETTES` in `config.ts`). Don't add image/audio files to the repo.

## Git workflow

- Conventional Commits: `<type>(<scope>): <description>` where type ∈ `feat|fix|docs|style|refactor|test|chore`.
- Branch prefixes: `feat/*`, `fix/*`, `docs/*`, `test/*`.
- Not enforced by automation — enforced at review time only.