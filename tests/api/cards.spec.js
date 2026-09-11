import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';
import { isoInDays } from '../../src/data/testData.js';

test.describe('Cards-> creation', () => {
  test('It should create a card with a name and description', { tag: ['@cards'] }, async ({ cards, board, list }) => {
    const name = scopedName('task');
    const card = await cards.create({ idList: list.id, name, desc: 'Write tests' });

    cards.assertNewCard(card, { name, desc: 'Write tests', idList: list.id, idBoard: board.id });
    cards.assertHasNoDueDate(card);
  });

  test('It should create a card with a due date and position', { tag: ['@cards'] }, async ({ cards, lists, list }) => {
    await cards.create({ idList: list.id, name: scopedName('existing') });

    const due = isoInDays(7);
    const card = await cards.create({ idList: list.id, name: scopedName('due'), due, pos: 'top' });

    cards.assertDueDateIs(card, due);
    await lists.assertFirstCardIs(list.id, card.id);
  });

  test('It should read a card by id', { tag: ['@cards'] }, async ({ cards, card }) => {
    await cards.assertMatches(card.id, card);
  });

  test('It should show the card in its list and on its board', { tag: ['@cards'] }, async ({ boards, lists, board, list, card }) => {
    await lists.assertContainsCard(list.id, card.id);
    await boards.assertContainsCard(board.id, card.id);
  });

  test('It should create a card with only a list', { tag: ['@cards'] }, async ({ cards, list }) => {
    const card = await cards.createWithListOnly(list.id);

    cards.assertNewCard(card, { idList: list.id });
    cards.assertNameIsString(card);
  });

  test('It should add a comment to a card', { tag: ['@cards'] }, async ({ cards, card }) => {
    const text = 'Automated comment';
    const action = await cards.addComment(card.id, text);

    cards.assertComment(action, { cardId: card.id, text });
  });

  test("Comment should shows up in the card's actions", { tag: ['@cards'] }, async ({ cards, card }) => {
    const text = 'Comment visible in the action log';
    await cards.addComment(card.id, text);

    await cards.assertCommentInActionLog(card.id, text);
  });
});
