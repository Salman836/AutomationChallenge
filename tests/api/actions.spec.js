import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';

test.describe('Actions-> audit trail', () => {
  test('The board action log records the whole workflow', { tag: ['@actions'] }, async ({ boards, cards, actions, board, list, card }) => {
    await cards.update(card.id, { name: scopedName('audited') });

    const recorded = await boards.assertActionTypesRecorded(board.id, ['createBoard', 'createList', 'createCard', 'updateCard']);

    actions.assertWellFormed(recorded);
    actions.assertNewestFirst(recorded);
    actions.assertReferencesList(recorded, list.id);
  });

  test('It Should Read a single action by id', { tag: ['@actions'] }, async ({ boards, actions, board, card }) => {
    const createCard = await actions.createCardActionFor(boards, board.id, card.id);
    await actions.assertIsCreateCardFor(createCard.id, { cardId: card.id, boardId: board.id });
  });

  test("It should read an action's board", { tag: ['@actions'] }, async ({ boards, actions, board, card }) => {
    const createCard = await actions.createCardActionFor(boards, board.id, card.id);
    await actions.assertParentBoardIs(createCard.id, board.id);
  });

  test("It should read an action's card", { tag: ['@actions'] }, async ({ boards, actions, board, card }) => {
    const createCard = await actions.createCardActionFor(boards, board.id, card.id);
    await actions.assertParentCardIs(createCard.id, card.id);
  });
});
