import { defineConfig, devices } from '@playwright/test';
import { ENV, ADMIN_STATE } from './src/config/env';

/**
 * OrangeHRM OS 5.9 — Authentication + Admin/User Management suite.
 *
 * Viewport is pinned to 1280x720 on purpose: below ~1000px the System Users list
 * switches to a "--mobile" card layout that re-orders the row cells (Employee Name
 * moves first, Delete/Edit move into the card header). Every positional cell
 * locator in SystemUsersPage assumes the desktop layout.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Shared public demo: retries are a diagnostic only, never a fix (see healing-log.md).
  retries: process.env.CI ? 1 : 0,
  // The demo is a shared, rate-sensitive instance — keep concurrency modest.
  workers: Number(process.env.WORKERS ?? 3),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['dot'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['junit', { outputFile: 'results/junit.xml' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: ENV.baseURL,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    {
      name: 'auth-ui',
      testMatch: /ui\/auth\/.*\.spec\.ts/,
      dependencies: ['setup'],
      // Login specs start with NO session; Admin state is only used through API fixtures.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'admin-ui',
      testMatch: /ui\/admin\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, storageState: ADMIN_STATE },
    },
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
