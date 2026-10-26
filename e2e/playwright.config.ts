import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the real production builds: a TV screen and several phones,
 * each in its own browser context, talking to a real API over WebSockets.
 *
 * Run `npm run build` first. The production builds look for the API on the page's
 * host at port 3000, so the API is started there.
 */
export const TV_URL = 'http://localhost:4173';
export const PHONE_URL = 'http://localhost:4174';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

export default defineConfig({
  testDir: './tests',
  // Every test opens its own room, but they share one API process: keep it simple
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: TV_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'API',
      command: 'node apps/api/dist/main.js',
      cwd: root,
      url: 'http://localhost:3000/health',
      reuseExistingServer: false,
      env: {
        PORT: '3000',
        // Fast games: a "10 second" question lasts 3s, 3 questions, short reveals
        TRIVIA_MS_PER_SECOND: '300',
        TRIVIA_REVEAL_MS: '1500',
        TRIVIA_MAX_QUESTIONS: '3',
        RECONNECT_GRACE_MS: '3000',
        SCREEN_GRACE_MS: '10000',
      },
    },
    {
      name: 'TV',
      command: 'npx vite preview --port 4173 --strictPort',
      cwd: `${root}/apps/host`,
      url: TV_URL,
      reuseExistingServer: false,
    },
    {
      name: 'Phone',
      command: 'npx vite preview --outDir dist --port 4174 --strictPort',
      cwd: `${root}/apps/controller`,
      url: PHONE_URL,
      reuseExistingServer: false,
    },
  ],
});
