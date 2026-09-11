import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';
import { isoInDays } from '../../src/data/testData.js';

test.describe('Trello workflow', () => {
  test('End to End flow  board -> list -> card -> update -> cleanup', { tag: ['@smoke', '@e2e'] }, async ({ boards, lists, cards, actions }) => {
    const due = isoInDays(3);
    let board;
    let list;
    let card;

    await test.step('Create a board', async () => {
      board = await boards.create({
        name: scopedName('board', 'e2e'),
        desc: 'E2E workflow',
        defaultLists: false
      });
      boards.assertNewBoard(board, { name: scopedName('board', 'e2e'), desc: 'E2E workflow' });
    });

    await test.step('Verfiy the new board has no lists', async () => {
      await boards.assertHasNoLists(board.id);
    });

    await test.step('create a list on the board', async () => {
      list = await lists.create({ name: scopedName('todo'), idBoard: board.id });
      lists.assertNewList(list, { name: scopedName('todo'), idBoard: board.id });
    });

    await test.step('verify the list is attached to the board', async () => {
      await boards.assertListsAre(board.id, [list.id]);
    });

    await test.step('create a card in the list', async () => {
      card = await cards.create({ idList: list.id, name: scopedName('task'), desc: 'original' });
      cards.assertNewCard(card, {
        name: scopedName('task'),
        desc: 'original',
        idList: list.id,
        idBoard: board.id
      });
    });

    await test.step('verify the card is in the list', async () => {
      await lists.assertCardsAre(list.id, [card.id]);
    });

    await test.step('update the card', async () => {
      const updated = await cards.update(card.id, {
        name: scopedName('task', 'updated'),
        desc: 'updated desc',
        due,
        dueComplete: true
      });

      cards.assertDueDateIs(updated, due);
      cards.assertUpdateKeptIdentity(updated, { id: card.id, idList: list.id });
      cards.assertActivityAdvanced(updated, card);
    });

    await test.step('verify the update persisted', async () => {
      await cards.assertPersisted(card.id, {
        name: scopedName('task', 'updated'),
        desc: 'updated desc',
        dueComplete: true,
        due
      });
    });

    await test.step('verify the the audit trail records the whole workflow', async () => {
      const recorded = await boards.assertActionTypesRecorded(board.id, ['createBoard', 'createList', 'createCard', 'updateCard']);
      await actions.assertReferencesCard(recorded, card.id);
    });

    await test.step('delete the card', async () => {
      await cards.remove(card.id);

      await cards.assertGone(card.id);
      await lists.assertEmpty(list.id);
    });

    await test.step('delete the board and confirm', async () => {
      await boards.remove(board.id);

      await boards.assertGone(board.id);
      await lists.assertGone(list.id);
    });
  });
});
