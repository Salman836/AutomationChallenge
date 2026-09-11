import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';

/** Prescribed step 5 — cleanup, asserted rather than assumed. */
test.describe('Cleanup', () => {
  test('tear down the entire setup', { tag: ['@cleanup'] }, async ({ boards, lists, cards, board, list, card }) => {
    await cards.remove(card.id);
    await lists.archive(list.id);
    await boards.remove(board.id);

    await cards.assertGone(card.id);
    await lists.assertGone(list.id);
    await boards.assertGone(board.id);
  });

  test('deleting a card removes it from its list', { tag: ['@cleanup'] }, async ({ lists, cards, list, card }) => {
    await lists.assertContainsCard(list.id, card.id);

    await cards.remove(card.id);

    await lists.assertDoesNotContainCard(list.id, card.id);
  });

  test('deleting a board cascades to its lists and cards', { tag: ['@cleanup'] }, async ({ boards, lists, cards, board, list, card }) => {
    await boards.remove(board.id);

    await lists.assertGone(list.id);
    await cards.assertGone(card.id);
  });

  test("deleted board is gone from the member's boards", { tag: ['@cleanup'] }, async ({ boards, members, board }) => {
    await boards.remove(board.id);

    await members.assertBoardAbsent(board.id);
  });

  test('created data is identifiable and fully removable', { tag: ['@cleanup'] }, async ({ boards, members }) => {
    const board = await boards.create({ name: scopedName('sweepable') });

    members.assertRecognisableAsTestData(board);

    await boards.remove(board.id);
    await members.assertBoardAbsent(board.id);
  });
});
