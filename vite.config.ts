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
    // Three's WebGPU runtime is a single, non-splittable module (about 568 kB
    // minified). Keep the warning limit just above that measured runtime size.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/]three[\\/]/,
              maxSize: 280000,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              maxSize: 280000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    open: true,
    proxy: {
      // Local multiplayer Worker (wrangler dev --port 8787)
      '/mp': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/mp/, ''),
      },
    },
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
