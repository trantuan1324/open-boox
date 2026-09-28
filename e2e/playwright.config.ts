import { defineConfig, devices } from '@playwright/test';
import { API_URL, ROOT, WEB_URL } from './env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: WEB_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Both inherit the process.env that env.ts overrode.
  webServer: [
    {
      command: 'pnpm --filter api exec node dist/main.js',
      cwd: ROOT,
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter web exec next start --port 3100',
      cwd: ROOT,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
