import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Keep asset URLs valid when the game is hosted below a repository path
  // (for example, GitHub Pages at /voxel-horizon-demo/).
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    open: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/__tests__/**', 'src/main.ts', 'src/vue-main.ts', 'src/env.d.ts', 'src/types.ts'],
    },
  },
});
