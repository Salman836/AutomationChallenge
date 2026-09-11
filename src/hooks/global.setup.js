import { request as playwrightRequest } from '@playwright/test';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { generateRunPrefix } from '../utils/runContext.js';

const log = createLogger('setup');

/**
 * Runs once in the main process before any worker starts.
 *
 * Assigning RUN_PREFIX here is what lets workers and global teardown agree on which
 * entities belong to this run: process.env set in global setup is inherited by every
 * worker Playwright spawns afterwards.
 *
 * The Trello checks are skipped rather than fatal when credentials are absent, so a
 * browser-only run works on a machine that has never had a Trello key. The API
 * fixture raises its own actionable error if a spec then needs one.
 */
export default async function globalSetup() {
  const runPrefix = process.env.RUN_PREFIX || generateRunPrefix();
  process.env.RUN_PREFIX = runPrefix;
  log.info(`Run prefix: ${runPrefix}`);

  if (!env.trello.isConfigured) {
    log.warn('TRELLO_KEY / TRELLO_TOKEN not set — skipping API preflight. Browser suites are unaffected.');
    return;
  }

  const context = await playwrightRequest.newContext({
    baseURL: env.trello.baseUrl,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: env.trello.authHeader }
  });
  try {
    const me = await context.get('/1/members/me', {
      params: { fields: 'id,username' },
      failOnStatusCode: false
    });

    if (me.status() !== 200) {
      throw new Error(`Trello credential check failed: GET /1/members/me returned ${me.status()}.\n` + '  Verify TRELLO_KEY and TRELLO_TOKEN, and that the token has read+write scope.');
    }
    const identity = await me.json();
    log.info(`Authenticated as @${identity.username} (${identity.id})`);

    const boards = await context.get(`/1/members/${env.trello.memberId}/boards`, {
      params: { fields: 'id,name', filter: 'open' },
      failOnStatusCode: false
    });
    if (boards.status() === 200) {
      const open = await boards.json();
      const leaked = open.filter((board) => /^pw-[a-z0-9]+-[a-f0-9]{6}-/.test(board.name ?? ''));
      log.info(`Open boards on the account: ${open.length} (${leaked.length} left over from earlier runs)`);
      if (leaked.length > 0) {
        log.warn(`${leaked.length} board(s) from a previous run were not cleaned up — teardown will sweep them.`);
      }
      if (open.length > 5) {
        log.warn(`${open.length} open boards. A Free workspace caps open boards; creation may start failing.`);
      }
    }
  } finally {
    await context.dispose();
  }
}
