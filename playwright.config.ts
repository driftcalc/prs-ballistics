// Field tests: open the real built app in a hidden Chrome and measure what is
// actually drawn (tap target sizes, contrast, Night colours, overflow, offline).
// Run with `npm run test:field`. The unit tests (`npm test`) are separate.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/prs-ballistics/',
    browserName: 'chromium',
    // The real app, offline-capable, exactly as published.
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/prs-ballistics/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
