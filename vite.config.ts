import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' : fonctionne sur GitHub Pages (sous-dossier), Netlify et Capacitor.
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'icons/icon.svg'],
      manifest: {
        name: 'Casse-Brique',
        short_name: 'Casse-Brique',
        description: 'Casse-briques réaliste : verre, bois, métal, pierre.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#07080c',
        theme_color: '#07080c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
