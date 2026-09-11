import { test } from '../../src/fixtures/trello.fixtures.js';
import { IDS, INVALID_DATES } from '../../src/data/testData.js';
import { scopedName } from '../../src/utils/runContext.js';

test.describe('Boards -> negative Cases', () => {
  test('It should reject creating a board with no name', { tag: ['@negative'] }, async ({ boards, members }, testInfo) => {
    const before = await members.boards();

    await boards.assertCreateRejected({}, testInfo, { caseId: 'TRL-N-010', likely: 400 });

    await members.assertNoUntrackedBoardAppeared(before);
  });

  test('It should reject empty  board names', { tag: ['@negative'] }, async ({ boards }, testInfo) => {
    await boards.assertCreateRejected({ name: '' }, testInfo, { caseId: 'TRL-N-011 (empty)', likely: 400 });
  });

  test('It should reject reading a board with a invalid id', { tag: ['@negative'] }, async ({ boards }, testInfo) => {
    await boards.assertReadRejected(IDS.malformed, testInfo, { caseId: 'TRL-N-012', likely: 400 });
  });

  test('It should reject reading a board that does not exist', { tag: ['@negative'] }, async ({ boards }) => {
    await boards.assertGone(IDS.absent);
  });

  test('It should reject updating a board that does not exist', { tag: ['@negative'] }, async ({ boards }) => {
    await boards.assertUpdateNotFound(IDS.absent, { name: scopedName('nope') });
  });
});

test.describe('Lists ->  negative Cases', () => {
  test('It should reject creating a list with no name', { tag: ['@negative'] }, async ({ boards, lists, board }, testInfo) => {
    await lists.assertCreateRejected({ idBoard: board.id }, testInfo, { caseId: 'TRL-N-020', likely: 400 });

    await boards.assertHasNoLists(board.id);
  });

  test('It should reject creating a list with no idBoard', { tag: ['@negative'] }, async ({ lists }, testInfo) => {
    await lists.assertCreateRejected({ name: scopedName('orphan') }, testInfo, { caseId: 'TRL-N-021', likely: 400 });
  });

  test('It should reject creating a list on a board that does not exist', { tag: ['@negative'] }, async ({ lists }, testInfo) => {
    const response = await lists.assertCreateRejected({ name: scopedName('orphan'), idBoard: IDS.absent }, testInfo, { caseId: 'TRL-N-022', likely: 404 });

    await lists.assertNothingCreated(response, 'no orphan list may be created');
  });

  test('It should reject reading a list with a malformed id', { tag: ['@negative'] }, async ({ lists }, testInfo) => {
    await lists.assertReadRejected(IDS.malformed, testInfo, { caseId: 'TRL-N-023', likely: 400 });
  });

  test('It should reject DELETE for lists', { tag: ['@negative'] }, async ({ lists, list }, testInfo) => {
    await lists.assertDeleteIsUnsupported(list.id, testInfo);
  });
});

test.describe('Cards ->  negative Cases', () => {
  test('It should reject creating a card with no idList', { tag: ['@negative'] }, async ({ cards }, testInfo) => {
    await cards.assertCreateRejectedMentioning({ name: scopedName('no-list') }, 'idlist', testInfo, {
      caseId: 'TRL-N-030',
      likely: 400
    });
  });

  test('It should reject creating a card with a malformed idList', { tag: ['@negative'] }, async ({ cards }, testInfo) => {
    await cards.assertCreateRejected({ idList: IDS.malformed, name: scopedName('bad-list') }, testInfo, {
      caseId: 'TRL-N-031',
      likely: 400
    });
  });

  test('It should reject creating a card in a list that does not exist', { tag: ['@negative'] }, async ({ cards }, testInfo) => {
    await cards.assertCreateRejected({ idList: IDS.absent, name: scopedName('ghost') }, testInfo, {
      caseId: 'TRL-N-032',
      likely: 404
    });
  });

  test('It should reject reading a card that does not exist', { tag: ['@negative'] }, async ({ cards }) => {
    await cards.assertGone(IDS.absent);
  });

  test('It should reject creating a card with an invalid due date', { tag: ['@negative'] }, async ({ cards, lists, list }, testInfo) => {
    for (const due of INVALID_DATES) {
      await cards.assertCreateRejected({ idList: list.id, name: scopedName('bad-due'), due }, testInfo, {
        caseId: `TRL-N-034 (${due})`,
        likely: 400
      });
    }

    await lists.assertEmpty(list.id, 'no card should exist after three rejected creates');
  });
});

test.describe('Update and deletion -> negative Cases', () => {
  test('It should reject updating a card that does not exist', { tag: ['@negative'] }, async ({ cards }) => {
    await cards.assertUpdateNotFound(IDS.absent, { name: scopedName('nope') });
  });

  test('move a card to a list on a different board', { tag: ['@negative'] }, async ({ boards, lists, cards, card }, testInfo) => {
    const otherBoard = await boards.create({ name: scopedName('board-b') });
    const otherList = await lists.create({ name: scopedName('list-b'), idBoard: otherBoard.id });

    await cards.assertCrossBoardMoveIsCoherent(card, { listId: otherList.id, boardId: otherBoard.id }, testInfo);
  });

  test('It should ignore an unknown parameter', { tag: ['@negative'] }, async ({ cards, card }) => {
    await cards.assertUnknownParameterIgnored(card, { name: scopedName('known-field'), bogusField: '123' });
  });

  test('It should reject deleting the same card twice', { tag: ['@negative'] }, async ({ cards, card }) => {
    await cards.assertRemoveIsNotRepeatable(card.id);
  });

  test('It should reject deleting the same board twice', { tag: ['@negative'] }, async ({ boards, board }) => {
    await boards.assertRemoveIsNotRepeatable(board.id);
  });
});
