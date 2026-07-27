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

// Save on page unload (fire-and-forget, auto-save covers most cases)
import { Save } from './save';
addEventListener('beforeunload', () => {
  const game = (window as unknown as { game?: { state: string } }).game;
  if (game?.state === 'play') Save.save(game as Parameters<typeof Save.save>[0]).catch(() => {});
});
