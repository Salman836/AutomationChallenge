import { expect } from '@playwright/test';
import { BaseApi } from './base.api.js';
import { env } from '../config/env.js';
import { looksLikeTestData, runPrefix } from '../utils/runContext.js';

/**
 * The Members object — the account-level view.
 */
export class MembersApi extends BaseApi {
  // ------------------------------------------------------------------ actions

  async me(params) {
    const response = await this.send('get', '/1/members/me', { params });
    return this.okJson(response, 'could not read the authenticated member');
  }

  /** Every board on the account under test, as `{ id, name }`. */
  async boards(filter = 'all') {
    const response = await this.send('get', `/1/members/${env.trello.memberId}/boards`, {
      params: { fields: 'id,name', filter }
    });
    return this.okJson(response, "could not list the member's boards");
  }

  async boardIds(filter = 'all') {
    return (await this.boards(filter)).map((board) => board.id);
  }

  async assertBoardAbsent(id, what = 'a deleted board must not remain on the account') {
    expect(await this.boardIds(), what).not.toContain(id);
  }

  async assertNoUntrackedBoardAppeared(before) {
    const after = await this.boards();
    const appeared = after.filter((board) => !before.some((existing) => existing.id === board.id));
    const untracked = appeared.filter((board) => !looksLikeTestData(board.name));
    expect(untracked, 'a 4xx create must not leave a board behind').toEqual([]);
  }

  async assertNoBoardNamed(name) {
    const names = (await this.boards()).map((board) => board.name);
    expect(names, `an unauthorised write must not create the board "${name}"`).not.toContain(name);
  }

  assertRecognisableAsTestData(board) {
    expect(board.name.startsWith(runPrefix()), "names must carry this run's prefix").toBe(true);
    expect(looksLikeTestData(board.name), 'the sweep must be able to recognise this name').toBe(true);
  }
}
