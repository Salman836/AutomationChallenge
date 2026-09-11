import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';

test.describe('Lists -> functional', () => {
  test('It should create a list on a board', { tag: ['@lists'] }, async ({ lists, board }) => {
    const name = scopedName('todo');
    const list = await lists.create({ name, idBoard: board.id });

    lists.assertNewList(list, { name, idBoard: board.id });
  });

  test('It should order the lists', { tag: ['@lists'] }, async ({ boards, lists, board }) => {
    const bottom = await lists.create({ name: scopedName('bottom'), idBoard: board.id, pos: 'bottom' });
    const top = await lists.create({ name: scopedName('top'), idBoard: board.id, pos: 'top' });

    lists.assertOrderedByPosition(top, bottom);
    await boards.assertListsAre(board.id, [top.id, bottom.id]);
  });

  test('It should read a list by id', { tag: ['@lists'] }, async ({ lists, list }) => {
    await lists.assertMatches(list.id, list);
  });

  test('It should rename a list', { tag: ['@lists'] }, async ({ lists, list }) => {
    const name = scopedName('inprogress');
    await lists.rename(list.id, name);

    await lists.assertRenamedInPlace(list.id, name, list.idBoard);
  });

  test('It should archive a list', { tag: ['@lists'] }, async ({ boards, lists, board, list }) => {
    await lists.archive(list.id);

    await lists.assertArchived(list.id, board.id, boards);
  });

  test('It should read the cards in a list', { tag: ['@lists'] }, async ({ cards, lists, list }) => {
    const first = await cards.create({ idList: list.id, name: scopedName('c1') });
    const second = await cards.create({ idList: list.id, name: scopedName('c2') });

    await lists.assertCardsAre(list.id, [first.id, second.id]);
  });
});
