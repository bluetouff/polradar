import { testOrigin, testPort } from './tests/browser/origin';
import { defineConfig } from '@playwright/test';
import process from 'node:process';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: testOrigin,
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: `npm run preview -- --port ${testPort} --ignore-lock`,
    url: testOrigin,
    reuseExistingServer: false,
  },
});
