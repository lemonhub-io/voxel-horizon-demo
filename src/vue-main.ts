// ============================================================
// Vue 3 + Pinia entry point — bootstraps Vue and game engine
// ============================================================

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { registerServiceWorker } from './pwa';
import { getActiveGame } from './runtime/game-runtime';

const pinia = createPinia();
const app = createApp(App);
// The engine is lazy-loaded, but it publishes state into Pinia as soon as it
// exists, so the store must be installed before any gameplay can be requested.
app.use(pinia);
app.mount('#vue-app');

// Touch class before engine load so title-screen Help uses mobile manual.
// Input.init() re-applies the same probe once the game starts.
{
  const isTouch =
    window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('touch-device', isTouch);
}

// Dev HMR and a caching service worker would otherwise serve different module
// versions, so registration is delegated to the production-aware helper.
void registerServiceWorker();

// This is only a last chance: browsers may cancel async work during unload, so
// normal progress relies on the engine's earlier autosaves.
import { Save } from './save';
addEventListener('beforeunload', () => {
  const game = getActiveGame();
  if (game?.state === 'play') Save.save(game).catch(() => {});
});
