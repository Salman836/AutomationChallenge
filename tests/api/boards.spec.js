import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';
import { FUNCTIONAL_CEILING_MS } from '../../src/data/perfBudgets.js';

test.describe('Boards · functional', () => {
  test('It should create a board with a name only', { tag: ['@boards'] }, async ({ boards }) => {
    const name = scopedName('b010');
    const board = await boards.create({ name });

    boards.assertNewBoard(board, { name });
    boards.assertLastCallWithin(FUNCTIONAL_CEILING_MS);
  });

  test('It should create a board with a description and no default lists', { tag: ['@boards'] }, async ({ boards }) => {
    const board = await boards.create({ desc: 'Automation board', defaultLists: false });

    boards.assertNewBoard(board, { desc: 'Automation board' });
    await boards.assertHasNoLists(board.id);
  });

  test('It should read a board by id', { tag: ['@boards'] }, async ({ boards, board }) => {
    await boards.assertMatches(board.id, board);
  });

  test('It should return only the requested fields', { tag: ['@boards'] }, async ({ boards, board }) => {
    await boards.assertFieldsLimitedTo(board.id, 'name,closed', ['closed', 'id', 'name']);
  });

  test('It should update a board name and description', { tag: ['@boards'] }, async ({ boards, board }) => {
    const name = scopedName('renamed');
    await boards.update(board.id, { name, desc: 'new desc' });

    await boards.assertPersisted(board.id, { id: board.id, name, desc: 'new desc' });
  });

  test('It should archive a board', { tag: ['@boards'] }, async ({ boards, board }) => {
    await boards.archive(board.id);
    await boards.assertArchived(board.id);
  });

  test('It should get every list on a board', { tag: ['@boards'] }, async ({ boards, lists, board }) => {
    const first = await lists.create({ name: scopedName('l1'), idBoard: board.id });
    const second = await lists.create({ name: scopedName('l2'), idBoard: board.id });

    await boards.assertListsAre(board.id, [first.id, second.id]);
  });

  test('It should get every card on a board', { tag: ['@boards'] }, async ({ boards, cards, board, list }) => {
    const created = [];
    for (const card of ['c1', 'c2', 'c3']) {
      created.push(await cards.create({ idList: list.id, name: scopedName(card) }));
    }

    await boards.assertCardsAre(
      board.id,
      created.map((card) => card.id)
    );
  });
});
