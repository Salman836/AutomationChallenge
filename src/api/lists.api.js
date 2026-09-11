import { expect } from '@playwright/test';
import { BaseApi, TRELLO_ID } from './base.api.js';
import { scopedName } from '../utils/runContext.js';

/**
 * The Lists object.
 */
export class ListsApi extends BaseApi {
  async create(params = {}) {
    const response = await this.attemptCreate({ name: scopedName('list'), ...params });
    return this.okJson(response, 'could not create a list');
  }

  async attemptCreate(params = {}) {
    return this.send('post', '/1/lists', { params });
  }

  async get(id, params) {
    const response = await this.send('get', `/1/lists/${id}`, { params });
    return this.okJson(response, `could not read list ${id}`);
  }

  async update(id, params) {
    const response = await this.send('put', `/1/lists/${id}`, { params });
    return this.okJson(response, `could not update list ${id}`);
  }

  async rename(id, name) {
    return this.update(id, { name });
  }

  async archive(id, value = true) {
    const response = await this.send('put', `/1/lists/${id}/closed`, { params: { value } });
    return this.okJson(response, `could not archive list ${id}`);
  }

  async cards(id, params) {
    const response = await this.send('get', `/1/lists/${id}/cards`, { params });
    return this.okJson(response, `could not read the cards of list ${id}`);
  }

  async board(id) {
    const response = await this.send('get', `/1/lists/${id}/board`);
    return this.okJson(response, `could not read the parent board of list ${id}`);
  }

  assertNewList(list, { name, idBoard } = {}) {
    expect(list.id).toMatch(TRELLO_ID);
    expect(list.closed, 'a new list must not be archived').toBe(false);
    expect(list.pos, 'a list must have a position').toBeGreaterThan(0);
    if (name !== undefined) expect(list.name).toBe(name);
    if (idBoard !== undefined) expect(list.idBoard).toBe(idBoard);
  }

  async assertPersisted(id, expected) {
    const list = await this.get(id);
    for (const [field, value] of Object.entries(expected)) {
      expect(list[field], `list.${field} did not persist`).toBe(value);
    }
    return list;
  }

  async assertMatches(id, expected) {
    return this.assertPersisted(id, { id: expected.id, name: expected.name, idBoard: expected.idBoard });
  }

  async assertRenamedInPlace(id, name, idBoard) {
    return this.assertPersisted(id, { name, idBoard });
  }

  assertOrderedByPosition(first, second) {
    expect(first.pos, `${first.name} should sort before ${second.name}`).toBeLessThan(second.pos);
  }

  async assertCardsAre(id, expectedIds) {
    const cards = await this.cards(id);
    expect(cards).toHaveLength(expectedIds.length);
    expect(cards.map((card) => card.id).sort()).toEqual([...expectedIds].sort());
    for (const card of cards) {
      expect(card.idList, 'every card in a list must name that list as its parent').toBe(id);
    }
  }

  async assertEmpty(id, what = 'the list should contain no cards') {
    expect(await this.cards(id), what).toEqual([]);
  }

  async assertContainsCard(id, cardId) {
    expect((await this.cards(id)).map((card) => card.id)).toContain(cardId);
  }

  async assertDoesNotContainCard(id, cardId, params) {
    expect((await this.cards(id, params)).map((card) => card.id)).not.toContain(cardId);
  }

  async assertFirstCardIs(id, cardId, what = 'pos=top should place the card first') {
    const cards = await this.cards(id);
    expect(cards[0].id, what).toBe(cardId);
    expect(cards[0].pos).toBe(Math.min(...cards.map((card) => card.pos)));
  }

  async assertArchived(id, boardId, boards) {
    expect((await this.get(id)).closed).toBe(true);

    const open = await boards.lists(boardId, { filter: 'open' });
    expect(open.map((list) => list.id)).not.toContain(id);

    const all = await boards.lists(boardId, { filter: 'all' });
    expect(
      all.map((list) => list.id),
      'archived is not deleted'
    ).toContain(id);
  }

  async assertGone(id) {
    const response = await this.send('get', `/1/lists/${id}`);
    this.assertNotFound(response, `list ${id} should be gone`);
  }

  async assertStillExists(id, what = 'the list must be intact') {
    expect((await this.get(id)).id, what).toBe(id);
  }

  async assertCreateRejected(params, testInfo, options) {
    const response = await this.attemptCreate(params);
    await this.assertClientError(response, testInfo, options);
    return response;
  }

  async assertReadRejected(id, testInfo, options) {
    const response = await this.send('get', `/1/lists/${id}`);
    await this.assertClientError(response, testInfo, options);
    return response;
  }

  async assertDeleteIsUnsupported(id, testInfo) {
    const response = await this.send('delete', `/1/lists/${id}`);
    await this.assertClientError(response, testInfo, { likely: 404 });
    await this.assertStillExists(id, 'an unsupported DELETE must leave the list intact');
  }
}
