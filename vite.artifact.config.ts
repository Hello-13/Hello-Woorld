import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Single-page build for sharing as one HTML file: Preact comes from a pinned CDN copy instead of
// being bundled, and the app compiles to a classic script that reads it from globals.
export default defineConfig({
  base: './',
  plugins: [preact({ prerender: { enabled: false } })],
  define: { __ARTIFACT__: 'true' },
  // The single page inlines everything; manifest, icons and service worker are for the hosted site.
  publicDir: false,
  build: {
    outDir: 'dist-artifact',
    target: 'es2022',
    assetsInlineLimit: 0,
    // Emit the stylesheet as a file (iife builds would otherwise inject it from the script).
    cssCodeSplit: false,
    rollupOptions: {
      external: ['preact', 'preact/hooks', 'preact/jsx-runtime'],
      output: {
        format: 'iife',
        globals: { preact: 'preact', 'preact/hooks': 'preactHooks', 'preact/jsx-runtime': 'jsxRuntime' },
      },
    },
  },
});
