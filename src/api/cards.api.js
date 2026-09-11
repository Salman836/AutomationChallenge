import { expect } from '@playwright/test';
import { BaseApi, TRELLO_ID } from './base.api.js';
import { scopedName } from '../utils/runContext.js';
import { sameInstant } from '../data/testData.js';

/**
 The Cards object.
 */
export class CardsApi extends BaseApi {
  async create(params = {}) {
    const response = await this.attemptCreate({ name: scopedName('card'), ...params });
    return this.okJson(response, 'could not create a card');
  }

  async createWithListOnly(idList) {
    const response = await this.attemptCreate({ idList });
    return this.okJson(response, 'could not create a card');
  }

  async attemptCreate(params = {}) {
    return this.send('post', '/1/cards', { params });
  }

  async attemptCreateWithBody(data) {
    return this.send('post', '/1/cards', { data });
  }

  async get(id, params) {
    const response = await this.send('get', `/1/cards/${id}`, { params });
    return this.okJson(response, `could not read card ${id}`);
  }

  async update(id, params) {
    const response = await this.send('put', `/1/cards/${id}`, { params });
    return this.okJson(response, `could not update card ${id}`);
  }

  async move(id, idList) {
    return this.update(id, { idList });
  }

  async attemptMove(id, idList) {
    return this.send('put', `/1/cards/${id}`, { params: { idList } });
  }

  async archive(id, closed = true) {
    return this.update(id, { closed });
  }

  async remove(id) {
    const response = await this.send('delete', `/1/cards/${id}`);
    expect(response, `could not delete card ${id}`).toBeOK();
  }

  async addComment(id, text) {
    const response = await this.send('post', `/1/cards/${id}/actions/comments`, { params: { text } });
    return this.okJson(response, `could not comment on card ${id}`);
  }

  async actions(id, params) {
    const response = await this.send('get', `/1/cards/${id}/actions`, { params });
    return this.okJson(response, `could not read the actions of card ${id}`);
  }

  assertNewCard(card, { name, desc, idList, idBoard } = {}) {
    expect(card.id).toMatch(TRELLO_ID);
    expect(card.closed, 'a new card must not be archived').toBe(false);
    expect(card.dueComplete, 'a new card must not be marked complete').toBe(false);
    if (name !== undefined) expect(card.name).toBe(name);
    if (desc !== undefined) expect(card.desc).toBe(desc);
    if (idList !== undefined) expect(card.idList).toBe(idList);
    if (idBoard !== undefined) {
      expect(card.idBoard, 'the card must belong to the board that owns its list').toBe(idBoard);
    }
  }

  assertHasNoDueDate(card) {
    expect(card.due).toBeNull();
    expect(card.dueComplete).toBe(false);
  }

  assertNameIsString(card) {
    expect(typeof card.name, 'a nameless card still has a string name').toBe('string');
  }

  assertDueDateIs(card, due) {
    expect(sameInstant(card.due, due), `due was ${card.due}, expected ${due}`).toBe(true);
  }

  async assertPersisted(id, expected) {
    const card = await this.get(id);
    for (const [field, value] of Object.entries(expected)) {
      if (field === 'due') {
        this.assertDueDateIs(card, value);
        continue;
      }
      expect(card[field], `card.${field} did not persist`).toBe(value);
    }
    return card;
  }

  async assertMatches(id, expected) {
    return this.assertPersisted(id, {
      id: expected.id,
      name: expected.name,
      desc: expected.desc,
      idList: expected.idList
    });
  }

  assertUpdateKeptIdentity(updated, { id, idList }) {
    expect(updated.id, 'an update must not re-identify the card').toBe(id);
    expect(updated.idList, 'an update to name/desc must not move the card').toBe(idList);
  }

  assertActivityAdvanced(after, before) {
    expect(new Date(after.dateLastActivity).getTime()).toBeGreaterThanOrEqual(new Date(before.dateLastActivity).getTime());
  }

  assertMovedWithinBoard(moved, { idList, idBoard }) {
    expect(moved.idList).toBe(idList);
    expect(moved.idBoard, 'moving within a board must not change the board').toBe(idBoard);
  }

  async assertArchived(id) {
    expect((await this.get(id)).closed).toBe(true);
  }

  async assertRestored(id) {
    expect((await this.get(id)).closed).toBe(false);
  }

  assertHasLabel(card, labelId) {
    expect(card.idLabels).toContain(labelId);
  }

  async assertLabelPersisted(id, labelId) {
    expect((await this.get(id)).labels?.[0]?.id).toBe(labelId);
  }

  assertComment(action, { cardId, text }) {
    expect(action.type).toBe('commentCard');
    expect(action.data.text).toBe(text);
    expect(action.data.card.id).toBe(cardId);
    expect(action.idMemberCreator).toMatch(TRELLO_ID);
  }

  async assertCommentInActionLog(id, text) {
    const actions = await this.actions(id);
    const comment = actions.find((action) => action.type === 'commentCard');
    expect(comment, 'the card action log should contain the comment').toBeDefined();
    expect(comment.data.text).toBe(text);
  }

  async assertGone(id) {
    const response = await this.send('get', `/1/cards/${id}`);
    this.assertNotFound(response, `card ${id} should be gone`);
  }

  async assertRemoveIsNotRepeatable(id) {
    await this.remove(id);
    const response = await this.send('delete', `/1/cards/${id}`);
    this.assertNotFound(response, 'deleting the same card twice must 404');
  }

  async assertCreateRejected(params, testInfo, options) {
    const response = await this.attemptCreate(params);
    await this.assertClientError(response, testInfo, options);
    return response;
  }

  async assertCreateRejectedMentioning(params, needle, testInfo, options) {
    const response = await this.assertCreateRejected(params, testInfo, options);
    expect((await response.text()).toLowerCase()).toContain(needle);
  }

  async assertUpdateNotFound(id, params) {
    const response = await this.send('put', `/1/cards/${id}`, { params });
    this.assertNotFound(response, `updating absent card ${id} must 404`);
  }

  async assertUnknownParameterIgnored(card, { name, bogusField }) {
    const updated = await this.update(card.id, { bogusField, name });
    expect(updated.name).toBe(name);
    expect(updated).not.toHaveProperty('bogusField');
    expect(updated.desc, 'an unknown parameter must not disturb other fields').toBe(card.desc);
  }

  async assertCrossBoardMoveIsCoherent(card, { listId, boardId }, testInfo) {
    const response = await this.attemptMove(card.id, listId);

    if (response.ok()) {
      const moved = await response.json();
      expect(moved.idList).toBe(listId);
      expect(moved.idBoard, 'the card moved lists across boards but idBoard was not updated — stale parent reference').toBe(boardId);
      testInfo.annotations.push({
        type: 'observed',
        description: 'Cross-board move accepted; Trello re-parents the card automatically.'
      });
      return;
    }

    await this.assertClientError(response, testInfo, { likely: 400 });
    const unchanged = await this.get(card.id);
    expect(unchanged.idList, 'a rejected move must leave the card where it was').toBe(card.idList);
  }
}
