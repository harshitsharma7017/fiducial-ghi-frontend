import { defineConfig, devices } from '@playwright/test';

const PORT = 3102;
const ci = Boolean(process.env.CI);

/**
 * Smoke test against a production build in mock mode (USE_MOCK_API=true), so no API or
 * database is needed. Chromium only. Run with `npm run test:e2e`; it builds the app first.
 */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: 1,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: { USE_MOCK_API: 'true', NEXT_TELEMETRY_DISABLED: '1' },
    reuseExistingServer: !ci,
    timeout: 240_000,
  },
});
