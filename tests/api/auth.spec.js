import { test } from '../../src/fixtures/trello.fixtures.js';
import { PAYLOADS } from '../../src/data/testData.js';
import { scopedName } from '../../src/utils/runContext.js';

/**
Authentication and authorisation.
 */
test.describe('Authentication and authorisation', () => {
  test('Should reject requests with no credentials', { tag: ['@security'] }, async ({ auth }, testInfo) => {
    await auth.assertUnauthenticatedReadIsRejected(testInfo);
  });

  test('Should reject requests with an invalid token', { tag: ['@security'] }, async ({ auth }) => {
    await auth.assertInvalidTokenIsRejected();
  });

  test(' Should reject requests with an invalid key', { tag: ['@security'] }, async ({ auth }, testInfo) => {
    await auth.assertInvalidKeyIsRejected(testInfo);
  });

  test('Should reject writes with no token', { tag: ['@security'] }, async ({ auth, members }) => {
    await auth.assertUnauthenticatedWriteIsRejected(members);
  });

  test("Should not expose another member's board", { tag: ['@security'] }, async ({ boards }, testInfo) => {
    await boards.assertForeignBoardExposesNothing('4d5ea62fd76aa1136000000c', testInfo);
  });

  test('SQL-style payload is literal text', { tag: ['@security'] }, async ({ boards, lists, board }) => {
    const name = `${scopedName('sql')} ${PAYLOADS.sql}`;
    const list = await lists.create({ name, idBoard: board.id });

    lists.assertNewList(list, { name, idBoard: board.id });
    boards.assertShape(await boards.get(board.id));
  });

  test('Credentials are never sent over cleartext HTTP', { tag: ['@security'] }, async ({ auth }) => {
    await auth.assertCleartextHttpIsNotUsable();
  });
});
