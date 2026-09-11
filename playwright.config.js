import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env.js';

/** Shared context for every browser project. */
const webUse = {
  baseURL: env.telenor.baseUrl,
  trace: 'retain-on-failure',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
  actionTimeout: 15_000,
  navigationTimeout: 30_000
};

const apiUse = {
  baseURL: env.trello.baseUrl,
  extraHTTPHeaders: {
    Accept: 'application/json',
    ...(env.trello.isConfigured ? { Authorization: env.trello.authHeader } : {})
  },
  trace: 'off',
  video: 'off',
  screenshot: 'off'
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  workers: process.env.CI ? 4 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './src/hooks/global.setup.js',
  globalTeardown: './src/hooks/global.teardown.js',
  outputDir: './test-results',

  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }], ['./src/reporters/qa-artifacts.reporter.js'], ...(process.env.CI ? [['github']] : [])],

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: apiUse
    },
    {
      name: 'web-chromium',
      testDir: './tests/web',
      use: { ...devices['Desktop Chrome'], ...webUse, viewport: { width: 1920, height: 1080 } }
    },
    {
      name: 'web-firefox',
      testDir: './tests/web',
      use: { ...devices['Desktop Firefox'], ...webUse, viewport: { width: 1920, height: 1080 } }
    },
    {
      name: 'web-webkit',
      testDir: './tests/web',
      use: { ...devices['Desktop Safari'], ...webUse, viewport: { width: 1920, height: 1080 } }
    },
    {
      name: 'web-mobile',
      testDir: './tests/web',
      // TEL-C-004. iPhone 13 already sets viewport, UA, touch and deviceScaleFactor;
      // webUse must not re-set viewport here or the device profile is broken.
      use: { ...devices['iPhone 13'], ...webUse, viewport: devices['iPhone 13'].viewport }
    },
    {
      name: 'perf-api',
      testDir: './tests/perf',
      testMatch: /trello\.perf\.spec\.js/,
      // A retried latency test hides the failure it exists to catch.
      retries: 0,
      // Parallel tests inside the project would contaminate each other's timings.
      fullyParallel: false,
      timeout: 300_000,
      use: apiUse
    }
  ]
});
