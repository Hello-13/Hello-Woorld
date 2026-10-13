import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base so the build works on GitHub Pages (/Hello-Woorld/) and anywhere else.
  base: './',
  plugins: [preact()],
  define: { __ARTIFACT__: 'false' },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
