import { request as playwrightRequest } from '@playwright/test';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { looksLikeTestData } from '../utils/runContext.js';

const log = createLogger('teardown');

/**
 * The third and last cleanup layer (test plan §4.6) and the check behind TRL-F-064.
 
 * Finding something is reported loudly. A leak means a fixture failed to do its job,
 * which is a defect in the harness even though the tests may all have passed.
 */
export default async function globalTeardown() {
  if (!env.trello.isConfigured) return;

  const context = await playwrightRequest.newContext({
    baseURL: env.trello.baseUrl,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: env.trello.authHeader }
  });

  try {
    const response = await context.get(`/1/members/${env.trello.memberId}/boards`, {
      params: { fields: 'id,name', filter: 'all' },
      failOnStatusCode: false
    });

    if (response.status() !== 200) {
      log.error(`Sweep could not list boards (${response.status()}). Test data may remain.`);
      return;
    }

    const orphans = (await response.json()).filter((board) => looksLikeTestData(board.name));
    if (orphans.length === 0) {
      log.info('Sweep clean — no test-created boards remain.');
      return;
    }

    log.warn(`Sweep found ${orphans.length} board(s) that fixture teardown missed:`);
    let removed = 0;
    for (const board of orphans) {
      const result = await context.delete(`/1/boards/${board.id}`, { failOnStatusCode: false });
      if (result.status() === 200 || result.status() === 404) {
        removed += 1;
        log.warn(`  swept ${board.name} (${board.id})`);
      } else {
        log.error(`  FAILED to delete ${board.name} (${board.id}): ${result.status()}`);
      }
    }
    log.warn(`Swept ${removed}/${orphans.length}. Investigate the fixture teardown path — ` + 'reaching this branch means a board outlived the test that created it.');
  } finally {
    await context.dispose();
  }
}
