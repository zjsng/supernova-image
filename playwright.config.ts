import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173/supernova-image/',
    headless: true,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bunx vite --config vite.config.ts --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/supernova-image/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
