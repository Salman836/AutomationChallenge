import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';
import { isoInDays } from '../../src/data/testData.js';

test.describe('Cards-> update', () => {
  test('It should update a card name and description', { tag: ['@cards'] }, async ({ cards, card }) => {
    const name = scopedName('updated');
    await cards.update(card.id, { name, desc: 'Updated' });

    const reread = await cards.assertPersisted(card.id, {
      id: card.id,
      name,
      desc: 'Updated',
      idList: card.idList,
      idBoard: card.idBoard
    });
    cards.assertActivityAdvanced(reread, card);
  });

  test('It should set a due date and mark it complete', { tag: ['@cards'] }, async ({ cards, card }) => {
    const due = isoInDays(3);
    const updated = await cards.update(card.id, { due, dueComplete: true });

    cards.assertDueDateIs(updated, due);
    await cards.assertPersisted(card.id, { dueComplete: true, due });
  });

  test('It should move a card to another list', { tag: ['@cards'] }, async ({ cards, lists, board, list, card }) => {
    const target = await lists.create({ name: scopedName('done'), idBoard: board.id });

    const moved = await cards.move(card.id, target.id);

    cards.assertMovedWithinBoard(moved, { idList: target.id, idBoard: board.id });
    await lists.assertDoesNotContainCard(list.id, card.id);
    await lists.assertContainsCard(target.id, card.id);
  });

  test('It should archive a card', { tag: ['@cards'] }, async ({ cards, lists, list, card }) => {
    await cards.archive(card.id);

    await cards.assertArchived(card.id);
    await lists.assertDoesNotContainCard(list.id, card.id, { filter: 'open' });
  });

  test('It should restore an archived card', { tag: ['@cards'] }, async ({ cards, lists, list, card }) => {
    await cards.archive(card.id);
    await cards.archive(card.id, false);

    await cards.assertRestored(card.id);
    await lists.assertContainsCard(list.id, card.id);
  });

  test('It should apply a label to a card', { tag: ['@cards'] }, async ({ boards, cards, board, card }) => {
    const label = await boards.firstLabel(board.id);

    const updated = await cards.update(card.id, { idLabels: label.id });

    cards.assertHasLabel(updated, label.id);
    await cards.assertLabelPersisted(card.id, label.id);
  });
});
