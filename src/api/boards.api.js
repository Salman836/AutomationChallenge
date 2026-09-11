import { expect } from '@playwright/test';
import { BaseApi, TRELLO_ID } from './base.api.js';
import { scopedName } from '../utils/runContext.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('boards');

/**
 The Boards object.
 */
export class BoardsApi extends BaseApi {
  constructor(request) {
    super(request);
    /** @type {string[]} */
    this.created = [];
  }

  // ---------------------------------------------------------------- lifecycle

  /** Register a board created outside this object, so teardown still removes it. */
  track(id) {
    if (id) this.created.push(id);
    return id;
  }

  /** Forget a board the test deleted itself, so teardown does not chase a 404. */
  forget(id) {
    const index = this.created.indexOf(id);
    if (index !== -1) this.created.splice(index, 1);
  }

  async cleanup(testInfo) {
    for (const id of [...this.created].reverse()) {
      const response = await this.send('delete', `/1/boards/${id}`);
      if (!response.ok() && response.status() !== 404) {
        log.warn(`Teardown could not delete board ${id}: ${response.status()}`);
        testInfo.annotations.push({ type: 'cleanup-warning', description: `board ${id} -> ${response.status()}` });
      }
    }
    this.created = [];
  }

  async create(params = {}) {
    const response = await this.attemptCreate({ name: scopedName('board'), defaultLists: false, ...params });
    return this.okJson(response, 'could not create a board');
  }

  async attemptCreate(params = {}) {
    const response = await this.send('post', '/1/boards/', { params });
    if (response.ok()) this.track((await response.json()).id);
    return response;
  }

  async attemptCreateWithBody(data) {
    const response = await this.send('post', '/1/boards/', { data });
    if (response.ok()) this.track((await response.json()).id);
    return response;
  }

  async get(id, params) {
    const response = await this.send('get', `/1/boards/${id}`, { params });
    return this.okJson(response, `could not read board ${id}`);
  }

  async update(id, params) {
    const response = await this.send('put', `/1/boards/${id}`, { params });
    return this.okJson(response, `could not update board ${id}`);
  }

  async archive(id) {
    return this.update(id, { closed: true });
  }

  async remove(id) {
    const response = await this.send('delete', `/1/boards/${id}`);
    expect(response, `could not delete board ${id}`).toBeOK();
    this.forget(id);
  }

  async lists(id, params) {
    const response = await this.send('get', `/1/boards/${id}/lists`, { params });
    return this.okJson(response, `could not read the lists of board ${id}`);
  }

  async cards(id, params) {
    const response = await this.send('get', `/1/boards/${id}/cards`, { params });
    return this.okJson(response, `could not read the cards of board ${id}`);
  }

  async actions(id, params) {
    const response = await this.send('get', `/1/boards/${id}/actions`, { params });
    return this.okJson(response, `could not read the actions of board ${id}`);
  }

  async labels(id) {
    const response = await this.send('get', `/1/boards/${id}/labels`);
    return this.okJson(response, `could not read the labels of board ${id}`);
  }

  async firstLabel(id) {
    const labels = await this.labels(id);
    expect(labels.length, 'a new board should come with default labels').toBeGreaterThan(0);
    return labels[0];
  }

  assertNewBoard(board, { name, desc } = {}) {
    expect(board.id, 'a board id must be 24 hex characters').toMatch(TRELLO_ID);
    expect(board.closed, 'a new board must not be archived').toBe(false);
    expect(board.url).toMatch(/^https:\/\/trello\.com\/b\//);
    expect(board.shortUrl).toMatch(/^https:\/\/trello\.com\//);
    if (name !== undefined) expect(board.name).toBe(name);
    if (desc !== undefined) expect(board.desc).toBe(desc);
  }

  assertShape(board) {
    expect(board).toMatchObject({
      id: expect.stringMatching(TRELLO_ID),
      name: expect.any(String),
      desc: expect.any(String),
      closed: expect.any(Boolean),
      url: expect.stringContaining('https://trello.com/')
    });
  }

  async assertPersisted(id, expected) {
    const board = await this.get(id);
    for (const [field, value] of Object.entries(expected)) {
      expect(board[field], `board.${field} did not persist`).toBe(value);
    }
    return board;
  }

  async assertMatches(id, expected) {
    return this.assertPersisted(id, {
      id: expected.id,
      name: expected.name,
      desc: expected.desc,
      closed: expected.closed
    });
  }

  async assertFieldsLimitedTo(id, fields, expectedKeys) {
    const board = await this.get(id, { fields });
    expect(Object.keys(board).sort()).toEqual([...expectedKeys].sort());
  }

  async assertArchived(id) {
    const board = await this.get(id);
    expect(board.closed, 'archived is not deleted — the board must still be readable').toBe(true);
  }

  async assertHasNoLists(id) {
    expect(await this.lists(id), 'the board should have no lists').toEqual([]);
  }

  async assertListsAre(id, expectedIds) {
    const lists = await this.lists(id);
    expect(lists).toHaveLength(expectedIds.length);
    expect(lists.map((list) => list.id).sort()).toEqual([...expectedIds].sort());
  }

  async assertCardsAre(id, expectedIds) {
    const cards = await this.cards(id);
    expect(cards).toHaveLength(expectedIds.length);
    expect(cards.map((card) => card.id).sort()).toEqual([...expectedIds].sort());
    for (const card of cards) {
      expect(card.idBoard, 'every card on a board must name that board as its parent').toBe(id);
    }
  }

  async assertContainsCard(id, cardId) {
    const cards = await this.cards(id);
    expect(cards.map((card) => card.id)).toContain(cardId);
  }

  async assertActionTypesRecorded(id, types) {
    const actions = await this.actions(id, { filter: types.join(',') });
    const recorded = actions.map((action) => action.type);
    for (const type of types) {
      expect(recorded, `the board log should contain a ${type} action`).toContain(type);
    }
    return actions;
  }

  async assertGone(id) {
    const response = await this.send('get', `/1/boards/${id}`);
    this.assertNotFound(response, `board ${id} should be gone`);
  }

  async assertRemoveIsNotRepeatable(id) {
    await this.remove(id);
    const response = await this.send('delete', `/1/boards/${id}`);
    this.assertNotFound(response, 'deleting the same board twice must 404');
  }

  async assertCreateRejected(params, testInfo, options) {
    const response = await this.attemptCreate(params);
    await this.assertClientError(response, testInfo, options);
    return response;
  }

  async assertReadRejected(id, testInfo, options) {
    const response = await this.send('get', `/1/boards/${id}`);
    await this.assertClientError(response, testInfo, options);
    return response;
  }

  async assertUpdateNotFound(id, params) {
    const response = await this.send('put', `/1/boards/${id}`, { params });
    this.assertNotFound(response, `updating absent board ${id} must 404`);
  }

  async assertForeignBoardExposesNothing(id, testInfo) {
    const response = await this.send('get', `/1/boards/${id}`);
    if (response.ok()) {
      testInfo.annotations.push({
        type: 'observed',
        description: 'The reference board is public; read access is expected and is not a leak.'
      });
      expect((await response.json()).id).toBe(id);
      return;
    }
    await this.assertClientError(response, testInfo, { likely: 401 });
    expect(await response.text(), 'a denied read must expose no board data').not.toContain('"name"');
  }
}
