import { test as base } from '@playwright/test';
import { BoardsApi } from '../api/boards.api.js';
import { ListsApi } from '../api/lists.api.js';
import { CardsApi } from '../api/cards.api.js';
import { ActionsApi } from '../api/actions.api.js';
import { MembersApi } from '../api/members.api.js';
import { AuthApi } from '../api/auth.api.js';
import { PerfRun } from '../utils/perfRun.js';
import { env } from '../config/env.js';
import { scopedName } from '../utils/runContext.js';

/**
 * Trello fixtures.
 
 */
export const test = base.extend({
  /**
   * Auto-used, so an API spec fails with an actionable message rather than an
   * opaque 401 when the environment is not set up.
   */
  credentials: [
    async ({}, use) => {
      if (!env.trello.isConfigured) {
        throw new Error('Trello credentials are not configured.\n' + '  Copy .env.example to .env and set TRELLO_KEY and TRELLO_TOKEN.\n' + '  Run `npm run test:web` if you only want the browser suite.');
      }
      await use();
    },
    { scope: 'worker', auto: true }
  ],

  /**
   * The Boards object also owns cleanup: everything it created is deleted in
  
   */
  boards: async ({ request }, use, testInfo) => {
    const boards = new BoardsApi(request);
    await use(boards);
    await boards.cleanup(testInfo);
  },

  lists: async ({ request }, use) => {
    await use(new ListsApi(request));
  },

  cards: async ({ request }, use) => {
    await use(new CardsApi(request));
  },

  actions: async ({ request }, use) => {
    await use(new ActionsApi(request));
  },

  members: async ({ request }, use) => {
    await use(new MembersApi(request));
  },

  auth: async ({ request, playwright }, use) => {
    await use(new AuthApi(request, playwright));
  },

  /** Measurement recorder for the performance suite. */
  perf: async ({}, use, testInfo) => {
    await use(new PerfRun(testInfo, env.perf.samples));
  },

  board: async ({ boards }, use) => {
    await use(await boards.create({ desc: 'Created by the automated suite' }));
  },

  list: async ({ lists, board }, use) => {
    await use(await lists.create({ name: scopedName('list'), idBoard: board.id }));
  },

  card: async ({ cards, list }, use) => {
    await use(await cards.create({ idList: list.id, name: scopedName('card'), desc: 'original description' }));
  }
});

export { expect } from '@playwright/test';
