import { test } from '../../src/fixtures/trello.fixtures.js';
import { scopedName } from '../../src/utils/runContext.js';

/**
 * Performance suite.
 *
 * Ground rules, enforced by the `perf-api` project rather than by convention:
 * one worker, no parallelism, no retries. Everything here also stays inside
 * Trello's published limits — 300 req/10 s per key, 100 per token — because these
 * are someone else's production servers, not a load-test target.
 *
 * The `perf` fixture owns the measurement mechanics: sampling, timing, error
 * counting, percentiles, budget lookup and the run report. Setup goes through the
 * API objects, but the *measured* call stays as a literal `request` against the
 * endpoint under test — in a latency test the path is the subject, and it has to
 * match its key in `perfBudgets.js`.
 */
test.describe.configure({ mode: 'default' });

test.describe('Trello · performance', () => {
  test('TRL-P-001 · per-endpoint latency budgets', { tag: ['@perf'] }, async ({ request, boards, lists, cards, perf }) => {
    await perf.pairedSeries(
      {
        create: (i) =>
          request.post('/1/boards/', {
            params: { name: scopedName('perf', String(i)), defaultLists: false }
          }),
        remove: (id) => request.delete(`/1/boards/${id}`)
      },
      'POST /1/boards/',
      'DELETE /1/boards/{id}'
    );

    // One long-lived board carries the read and update series.
    const board = await boards.create({ name: scopedName('perf-host') });

    await perf.series('GET /1/boards/{id}', () => request.get(`/1/boards/${board.id}`));
    await perf.series('PUT /1/boards/{id}', (i) => request.put(`/1/boards/${board.id}`, { params: { desc: `perf ${i}` } }));
    await perf.series('POST /1/lists', (i) => request.post('/1/lists', { params: { name: scopedName('perf-list', String(i)), idBoard: board.id } }));
    await perf.series('GET /1/boards/{id}/lists', () => request.get(`/1/boards/${board.id}/lists`));

    const list = await lists.create({ name: scopedName('perf-cards'), idBoard: board.id });

    await perf.series('GET /1/lists/{id}', () => request.get(`/1/lists/${list.id}`));
    await perf.series('PUT /1/lists/{id}', (i) => request.put(`/1/lists/${list.id}`, { params: { name: scopedName('perf-list', String(i)) } }));
    await perf.series('GET /1/lists/{id}/cards', () => request.get(`/1/lists/${list.id}/cards`));

    await perf.pairedSeries(
      {
        create: (i) =>
          request.post('/1/cards', {
            params: { idList: list.id, name: scopedName('perf-card', String(i)) }
          }),
        remove: (id) => request.delete(`/1/cards/${id}`)
      },
      'POST /1/cards',
      'DELETE /1/cards/{id}'
    );

    const card = await cards.create({ idList: list.id, name: scopedName('perf-read') });

    await perf.series('GET /1/cards/{id}', () => request.get(`/1/cards/${card.id}`));
    await perf.series('PUT /1/cards/{id}', (i) => request.put(`/1/cards/${card.id}`, { params: { desc: `perf ${i}` } }));
    await perf.series('GET /1/boards/{id}/actions', () => request.get(`/1/boards/${board.id}/actions`, { params: { limit: 20 } }));

    await perf.publish();
  });

  test('TRL-P-002 · whole-workflow duration', { tag: ['@perf'] }, async ({ boards, lists, cards, perf }) => {
    await perf.flow('WORKFLOW /five-steps', async (i) => {
      const board = await boards.create({ name: scopedName('wf', String(i)) });
      const list = await lists.create({ name: scopedName('wf-list'), idBoard: board.id });
      const card = await cards.create({ idList: list.id, name: scopedName('wf-card') });
      await cards.update(card.id, { name: scopedName('wf-card', 'updated') });
      await boards.remove(board.id);
    });

    await perf.publish();
  });
});
