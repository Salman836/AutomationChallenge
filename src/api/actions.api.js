import { expect } from '@playwright/test';
import { BaseApi, TRELLO_ID } from './base.api.js';

/**
 * The Actions object — the workflow's audit trail.
 */
export class ActionsApi extends BaseApi {
  async get(id, params) {
    const response = await this.send('get', `/1/actions/${id}`, { params });
    return this.okJson(response, `could not read action ${id}`);
  }

  async board(id) {
    const response = await this.send('get', `/1/actions/${id}/board`);
    return this.okJson(response, `could not read the board of action ${id}`);
  }

  async card(id) {
    const response = await this.send('get', `/1/actions/${id}/card`);
    return this.okJson(response, `could not read the card of action ${id}`);
  }

  async createCardActionFor(boards, boardId, cardId) {
    const actions = await boards.actions(boardId, { filter: 'createCard' });
    const action = actions.find((entry) => entry.data?.card?.id === cardId);
    expect(action, 'the createCard action for this card should exist').toBeDefined();
    return action;
  }

  async assertWellFormed(actions) {
    for (const action of actions) {
      expect(action.id).toMatch(TRELLO_ID);
      expect(action.idMemberCreator).toMatch(TRELLO_ID);
      expect(Number.isNaN(Date.parse(action.date)), `${action.type} has an unparseable date`).toBe(false);
    }
  }

  async assertNewestFirst(actions) {
    const dates = actions.map((action) => Date.parse(action.date));
    expect(dates, 'actions should be returned newest first').toEqual([...dates].sort((a, b) => b - a));
  }

  async assertReferencesList(actions, listId) {
    const createList = actions.find((action) => action.type === 'createList');
    expect(createList.data.list.id).toBe(listId);
  }

  async assertReferencesCard(actions, cardId) {
    const createCard = actions.find((action) => action.type === 'createCard');
    expect(createCard.data.card.id).toBe(cardId);
  }

  async assertIsCreateCardFor(actionId, { cardId, boardId }) {
    const action = await this.get(actionId);
    expect(action.type).toBe('createCard');
    expect(action.data.card.id).toBe(cardId);
    expect(action.data.board.id).toBe(boardId);
  }

  async assertParentBoardIs(actionId, boardId) {
    expect((await this.board(actionId)).id).toBe(boardId);
  }

  async assertParentCardIs(actionId, cardId) {
    expect((await this.card(actionId)).id).toBe(cardId);
  }
}
