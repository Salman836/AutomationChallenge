import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env.js';
/**
 @typedef {import("@estruyf/github-actions-reporter").GitHubActionOptions} GitHubActionOptions
 */
/** Shared context for every browser project. */
const webUse = {
  baseURL: env.telenor.baseUrl,
  trace: 'retain-on-failure',
  video: 'on',
  screenshot: 'on',
  actionTimeout: 15_000,
  navigationTimeout: 30_000
};

const apiUse = {
  baseURL: env.trello.baseUrl,
  extraHTTPHeaders: {
    Accept: 'application/json',
    ...(env.trello.isConfigured ? { Authorization: env.trello.authHeader } : {})
  },
  trace: 'retain-on-failure',
  video: 'off',
  screenshot: 'off'
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  workers: process.env.CI ? 2 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './src/hooks/global.setup.js',
  globalTeardown: './src/hooks/global.teardown.js',
  outputDir: './test-results',

  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }], ['./src/reporters/qa-artifacts.reporter.js'], ['@estruyf/github-actions-reporter'], ['allure-playwright', { outputFolder: 'allure-results' }]],

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
