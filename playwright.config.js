import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env.js';

/**
 * Projects are deliberately explicit rather than a browser matrix over one testDir:
 * the API, browser and performance suites need materially different timeouts,
 * parallelism and tracing, and mixing them under one project hides those differences.
 *
 * `npm test` selects api + web-chromium. The perf-api project exists but is never
 * part of a default run — see README "Running the suites".
 */

/** Shared context for every browser project. */
const webUse = {
  baseURL: env.telenor.baseUrl,
  // telenor.se is a Swedish, geo-aware site. Pinning locale, timezone and position
  // keeps a CI runner in another region from being served a different page (Risk R-08).

  trace: 'retain-on-failure',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
  actionTimeout: 15_000,
  navigationTimeout: 30_000
};

/**
 * Authentication for every API spec, applied once.
 *
 * This is the only place in the suite that touches a Trello credential. Because it
 * is an `extraHTTPHeaders` entry on the project, Playwright's built-in `request`
 * fixture is already authenticated in every spec — so the specs are plain
 * `request.post(...)` calls with no auth plumbing, and a key or token never appears
 * in a test file.
 *
 * The header form is used rather than `?key=&token=` so credentials stay out of
 * URLs, and therefore out of access logs and report artifacts (Risk R-05).
 * The spread keeps `--list` and browser-only runs working on a machine that has no
 * Trello credentials at all; the `credentials` fixture raises the actionable error
 * if an API spec then actually runs.
 *
 * Tracing stays off here regardless: a trace records request headers, which is the
 * other way a credential reaches a shared CI artifact. TRL-S-010 asserts the result.
 */
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
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
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
