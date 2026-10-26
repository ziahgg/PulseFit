import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a real Supabase stack (local `supabase start` + seed).
 * Set E2E_BASE_URL to reuse a running dev server; otherwise one is started on port 3100.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL, ...devices['Pixel 7'], trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run dev -- -p 3100', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
