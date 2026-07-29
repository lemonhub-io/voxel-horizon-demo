// ============================================================
// Vue 3 + Pinia entry point — bootstraps Vue and game engine
// ============================================================

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { registerServiceWorker } from './pwa';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.mount('#vue-app');

// Touch class before engine load so title-screen Help uses mobile manual.
// Input.init() re-applies the same probe once the game starts.
{
  const isTouch =
    window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('touch-device', isTouch);
}

// Progressive Web App (production builds only)
void registerServiceWorker();

// Save on page unload (fire-and-forget, auto-save covers most cases)
import { Save } from './save';
addEventListener('beforeunload', () => {
  const game = window.game;
  if (game?.state === 'play') Save.save(game).catch(() => {});
});
