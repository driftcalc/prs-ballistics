/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // The site lives at https://<user>.github.io/prs-ballistics/
  base: '/prs-ballistics/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    VitePWA({
      // New versions install quietly in the background; the next launch uses them.
      registerType: 'autoUpdate',
      // Builds the PNG app icons from public/icon.svg.
      pwaAssets: {
        image: 'public/icon.svg',
        preset: 'minimal-2023',
      },
      manifest: {
        name: 'Spin Drift',
        short_name: 'Spin Drift',
        description: 'Offline ballistic calculator for PRS, NRL and rimfire shooters.',
        theme_color: '#1b2a1f',
        background_color: '#1b2a1f',
        display: 'standalone',
        orientation: 'portrait',
      },
      workbox: {
        // Everything the app needs is saved on the phone so it works with no signal.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,wasm}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
