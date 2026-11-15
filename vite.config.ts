/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { minimal2023Preset } from '@vite-pwa/assets-generator/config'
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
        // The standard set of sizes, but the round-crop (Android) and iPhone icons are
        // padded with the Dark background instead of the default white frame.
        preset: {
          ...minimal2023Preset,
          maskable: { sizes: [512], padding: 0.2, resizeOptions: { background: '#121814' } },
          apple: { sizes: [180], padding: 0.12, resizeOptions: { background: '#121814' } },
        },
      },
      manifest: {
        name: 'Spin Drift',
        short_name: 'Spin Drift',
        description: 'Offline ballistic calculator for PRS, NRL and rimfire shooters.',
        theme_color: '#121814', // Dark theme background, so start-up matches the app
        background_color: '#121814',
        display: 'standalone',
        orientation: 'portrait',
      },
      workbox: {
        // Everything the app needs is saved on the phone so it works with no signal.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,wasm,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
