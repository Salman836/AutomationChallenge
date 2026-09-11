import { expect } from '@playwright/test';
import { BaseApi } from './base.api.js';
import { env } from '../config/env.js';
import { scopedName } from '../utils/runContext.js';

/**
 * The Authentication object.

 */
export class AuthApi extends BaseApi {
  /**
   * @param {import('@playwright/test').APIRequestContext} request the authenticated project context
   * @param {import('@playwright/test').Playwright} playwright used to build unauthenticated ones
   */
  constructor(request, playwright) {
    super(request);
    this.playwright = playwright;
  }

  static oauthHeader(key, token) {
    return `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`;
  }

  async #context(authorization) {
    return this.playwright.request.newContext({
      baseURL: env.trello.baseUrl,
      extraHTTPHeaders: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {})
      }
    });
  }

  async #withAuth(authorization, fn) {
    const context = await this.#context(authorization);
    try {
      return await fn(context);
    } finally {
      await context.dispose();
    }
  }

  async assertUnauthenticatedReadIsRejected(testInfo) {
    await this.#withAuth(null, async (context) => {
      const response = await context.get('/1/members/me');
      await this.assertClientError(response, testInfo, { likely: 401 });
      expect(await response.text(), 'an unauthenticated call must return no member data').not.toContain('"id"');
    });
  }

  async assertInvalidTokenIsRejected() {
    await this.#withAuth(AuthApi.oauthHeader(env.trello.key, 'invalid-token-value'), async (context) => {
      const response = await context.get('/1/members/me');
      expect(response.status()).toBe(401);
      expect((await response.text()).toLowerCase()).toContain('token');
    });
  }

  async assertInvalidKeyIsRejected(testInfo) {
    await this.#withAuth(AuthApi.oauthHeader('invalidkey', env.trello.token), async (context) => {
      const response = await context.get('/1/members/me');
      await this.assertClientError(response, testInfo, { likely: 401 });
    });
  }

  async assertUnauthenticatedWriteIsRejected(members) {
    const name = scopedName('unauthorised');

    await this.#withAuth(null, async (context) => {
      const response = await context.post('/1/boards/', { params: { name } });
      expect(response.status()).toBe(401);
      expect(await response.text(), 'a rejected create must not return a board id').not.toContain('"id"');
    });

    await members.assertNoBoardNamed(name);
  }

  async assertCleartextHttpIsNotUsable() {
    await this.#withAuth(null, async (context) => {
      const response = await context.get('http://api.trello.com/1/members/me', { timeout: 10_000 }).catch(() => null);

      const finalUrl = response?.url() ?? '';
      expect(response === null || finalUrl.startsWith('https://'), `plain HTTP was answered directly (url ${finalUrl})`).toBe(true);
    });
  }
}
