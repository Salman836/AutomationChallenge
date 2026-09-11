import { expect } from '@playwright/test';
import { expectClientError } from '../utils/observed.js';

/**
 * Shared behaviour for the Trello API objects.
 *
 * These are the API-side equivalent of the page objects in `src/pages`: a spec says
 * *what* it is checking, and the object owns the request, the response parsing and
 * the expectation. Endpoint paths and assertion wording live here so no spec ever
 * restates them — the same reason selectors never appear inline in a browser spec.
 *
 * Authentication is deliberately absent. `playwright.config.js` sets the
 * Authorization header on the `api` project, so the injected `request` context is
 * already authenticated and no object here handles a credential.
 */
export class BaseApi {
  /** @param {import('@playwright/test').APIRequestContext} request */
  constructor(request) {
    this.request = request;
    /** The most recent response, for assertions about headers or content type. */
    this.lastResponse = null;
    /** Latency of the most recent call, for the functional ceiling checks. */
    this.lastCallMs = 0;
  }

  /**
   * Issue a request, remembering the response and how long it took.
   * @param {'get'|'post'|'put'|'delete'} method
   */
  async send(method, path, options) {
    const started = performance.now();
    const response = await this.request[method](path, options);
    this.lastCallMs = performance.now() - started;
    this.lastResponse = response;
    return response;
  }

  /** Assert a 2xx and return the parsed body. */
  async okJson(response, what) {
    expect(response, what).toBeOK();
    return response.json();
  }

  /** Assert the resource is absent. */
  assertNotFound(response, what = 'expected the resource to be gone') {
    expect(response.status(), what).toBe(404);
  }

  /**
   * A 4xx client error — never a 2xx, never a 5xx — with the real status recorded.
   * See `utils/observed.js` for why the class is asserted rather than an exact code.
   */
  assertClientError(response, testInfo, options) {
    return expectClientError(response, testInfo, options);
  }

  /**
   * Trello answers errors with plain text, so a JSON `id` in the body would mean the
   * resource was written despite the rejection.
   */
  async assertNothingCreated(response, what = 'a rejected request must not create a resource') {
    expect(await response.text(), what).not.toContain('"id"');
  }

  assertLastCallWithin(ceilingMs, what) {
    expect(Math.round(this.lastCallMs), what ?? `the call took ${Math.round(this.lastCallMs)} ms, over the ${ceilingMs} ms ceiling`).toBeLessThan(ceilingMs);
  }

  assertLastResponseWasJson() {
    expect(this.lastResponse.headers()['content-type']).toContain('application/json');
  }

  /** Trello sends these on every authenticated call. */
  assertRateLimitHeaders(response = this.lastResponse) {
    const headers = response.headers();
    for (const header of ['x-rate-limit-api-key-max', 'x-rate-limit-api-key-remaining', 'x-rate-limit-api-token-max', 'x-rate-limit-api-token-remaining']) {
      expect(headers, `Missing rate-limit header ${header}`).toHaveProperty(header);
    }
    const tokenMax = Number(headers['x-rate-limit-api-token-max']);
    const tokenRemaining = Number(headers['x-rate-limit-api-token-remaining']);
    expect(tokenMax).toBeGreaterThan(0);
    expect(tokenRemaining).toBeLessThanOrEqual(tokenMax);
    return { tokenMax, tokenRemaining };
  }
}

/** A 24-character hexadecimal Trello id. */
export const TRELLO_ID = /^[0-9a-f]{24}$/;
