// ============================================================
// Vue 3 + Pinia entry point — bootstraps Vue and game engine
// ============================================================

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.mount('#vue-app');

// Initialize game engine after Vue mounts
import { Game } from './main';
const game = new Game();
(window as unknown as Record<string, unknown>).game = game;

// Save on page unload (fire-and-forget, auto-save covers most cases)
import { Save } from './save';
addEventListener('beforeunload', () => {
  if (game.state === 'play') Save.save(game).catch(() => {});
});
