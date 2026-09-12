# Trello API & Telenor E2E — Playwright Test Suite

End-to-end and API automation for two independent targets, delivered from one Playwright
project: the **Trello REST API v1** and the **telenor.se** broadband purchase journey.

**Stack** — Playwright Test · JavaScript (ESM) · Node 22+ · GitHub Actions · Allure

```bash
npm ci && npx playwright install chromium
cp .env.example .env        # add TRELLO_KEY / TRELLO_TOKEN
npm test                    # api + web-chromium — 65 tests, ~1 min
```

---

## Scope

| Suite | Tests | Target | Technique |
| --- | ---: | --- | --- |
| `api` | 64 | Trello REST v1 | Lifecycle, contract, negative/boundary, auth & data integrity |
| `web-chromium` · `web-firefox` · `web-webkit` | 1 each | telenor.se | Page-object-driven purchase journey, same spec across all three engines |
| `perf-api` | 2 | Trello REST v1 | Client-observed latency against p95 budgets |

CI runs all three browser engines on every push — 67 tests, ~90s. A `web-mobile` project
(iPhone 13 viewport) shares the same page objects and can be added with
`--project=web-mobile`.

**Trello lifecycle under test** — `board → list → card → update → teardown`, with every
write verified by an independent re-read and confirmed a second time against the
`/actions` audit trail. A suite that only asserted `200` would pass even if Trello
attached the card to the wrong board.

**Telenor journey** — home → consent → Bredband menu → *Bredband via fiber* →
address `Kungsgatan 103, Uppsala` → suggestion → assert a non-empty product grid.

---

## Architecture

The organising rule: **specs declare intent; objects own mechanics and assertions.**
A spec never contains a selector, an endpoint path, or an `expect`.

```
tests/
  api/    boards · lists · cards · cards.update · actions · negative · auth · cleanup · workflow
  web/    telenor.broadband.spec.js
  perf/   trello.perf.spec.js

src/
  api/         BaseApi + Boards/Lists/Cards/Actions/Members/Auth — endpoints *and* assertions
  pages/       BasePage + HomePage/BroadbandPage — selectors and page assertions
  fixtures/    trello.fixtures.js (API objects, test data, teardown) · web.fixtures.js
  utils/       perfRun · metrics · observed · runContext · logger · redact
  data/        testData.js · perfBudgets.js
  hooks/       global.setup.js (credential preflight, quota guard) · global.teardown.js (sweep)
  reporters/   qa-artifacts.reporter.js — job summary, perf report, observed-behaviour doc
```

The API objects are the API-side analogue of the page objects:

```js
// tests/api/cards.update.spec.js — zero expect() in any api spec
test('It should move a card to another list', async ({ cards, lists, board, list, card }) => {
  const target = await lists.create({ name: scopedName('done'), idBoard: board.id });
  const moved  = await cards.move(card.id, target.id);

  cards.assertMovedWithinBoard(moved, { idList: target.id, idBoard: board.id });
  await lists.assertDoesNotContainCard(list.id, card.id);
  await lists.assertContainsCard(target.id, card.id);
});
```

---

## Design decisions

| Decision | Rationale |
| --- | --- |
| **Auth as one `extraHTTPHeaders` entry** on the `api` project | The only place in the suite touching a credential. Playwright's `request` fixture arrives authenticated, so no key or token appears in any spec. The OAuth header form keeps secrets out of URLs — verified live that Trello honours a valid header over any query credential. |
| **Fixtures own creation *and* teardown** | A spec deleting its own board leaks it the moment an assertion fails mid-test. `BoardsApi` tracks what it creates and removes it in teardown, which Playwright runs regardless of outcome. Deleting a board cascades to its lists and cards. |
| **Run-scoped names** (`pw-<base36>-<hex>-…`) | Makes the orphan sweep deterministic under `fullyParallel`: "delete every board carrying *this* run's prefix" can never touch a parallel run's data. |
| **Three cleanup layers** | Fixture teardown (normal path) → `track`/`forget` for entities created outside the factory → a global-teardown sweep that catches leaks from a killed process, and reports loudly when it finds any. |
| **Assert the 4xx *class*, record the actual code** | Trello doesn't publish a rejection code for every invalid input. Guessing one produces either a false failure or a test that silently documents the wrong contract. `expectClientError` asserts 4xx-not-5xx and emits `docs/observed-behaviour.generated.md` so assertions can be tightened from evidence. |
| **p95 and hard ceiling are the entire perf contract** | Max over the public internet is network noise. A p50 target used to sit in the budget table and was never asserted, which made the contract read stricter than it was — removed. |
| **Paired create/delete in perf series** | 20 samples of `POST /1/boards/` without deleting leaves 20 open boards; a Free workspace caps them, and the measurement starts failing for reasons unrelated to latency. |

---

## Negative & boundary coverage

Beyond the happy path the `api` suite asserts that a rejected request **rejects and leaves
nothing behind** — a 400 returned *after* writing the row would pass a status-only check.

- Missing required fields (`name`, `idList`, `idBoard`), malformed vs. well-formed-but-absent IDs
- Boundary values on name/description length, invalid date formats
- Double-delete, writes to children of a deleted board, cross-board card moves
- Unauthenticated reads and writes, invalid key, invalid token, cleartext-HTTP reachability
- Payload round-tripping: Unicode/emoji, HTML and SQL-shaped strings stored as inert text

Where Trello's behaviour is undocumented, the observed status is captured:

| Case | Endpoint | Expected | Observed | Body |
| --- | --- | --- | ---: | --- |
| TRL-N-022 | `/1/lists` | 4xx (404 expected) | **401** | `unauthorized board list requested` |
| DELETE for lists | `/1/lists/{id}` | 4xx (404 expected) | **400** | `Cannot delete open list` |
| Cross-board card move | `/1/cards/{id}` | 4xx (400 expected) | **404** | `List … does not exist on board …` |

Rows are keyed by case ID where a spec carries one, otherwise by test name.

---

## Performance

`PerfRun` (`src/utils/perfRun.js`) owns sampling, timing, error counting, percentiles,
budget lookup and the run report, so a perf spec is a list of *what to measure*:

```js
await perf.series('GET /1/boards/{id}', () => request.get(`/1/boards/${board.id}`));
await perf.pairedSeries({ create, remove }, 'POST /1/boards/', 'DELETE /1/boards/{id}');
await perf.flow('WORKFLOW /five-steps', async (i) => { /* 5-step lifecycle */ });
await perf.publish();          // attaches the table, fails on every breach at once
```

The first sample of each series is dropped as cold start and reported separately.
Budgets live in `src/data/perfBudgets.js`; the series label *is* the budget key.

> **Current state:** the budgets are the provisional pre-implementation numbers and have
> not been calibrated against a clean baseline. Several endpoints breach p95, which is why
> the CI stage is non-blocking. Recalibration is the outstanding task here.

---

## CI

`.github/workflows/ci.yml` — runs on every push and pull request.

| Job | Command | Gating |
| --- | --- | --- |
| `functional` | `playwright test --project=api --project=web-{chromium,firefox,webkit}` | Blocking |
| `performance (non-blocking)` | `playwright test --project=perf-api --workers=1` | `continue-on-error` |
| `allure report` | Publishes to the `allure` branch | Non-blocking, skipped on PRs |

Two details worth calling out:

**`needs: functional` + `if: ${{ !cancelled() }}`.** `needs` alone gates on *success*, so a
single flaky functional test would skip the perf job entirely. Keeping `needs` preserves the
ordering that matters — perf must never run alongside the functional suite, since concurrent
traffic both contaminates latency and multiplies rate-limit pressure on one token — while
`!cancelled()` drops the success gate.

**`concurrency: e2e-${{ github.head_ref || github.ref_name }}`.** Keyed on the branch, not the
ref: pushing to a branch with an open PR fires both `push` and `pull_request`, which carry
different refs, so a ref-keyed group would let two runs hit the same Trello token at once.

All three browser engines run on every trigger, so the workflow takes no inputs — there is
nothing left to toggle.

---

## Reporting

| Artifact | Produced by | Contents |
| --- | --- | --- |
| GitHub job summary | `qa-artifacts.reporter.js` | Passed/failed/**flaky**/skipped tally, failure table, flake note |
| Allure report | `allure-playwright` | Browsable history, published per run |
| `perf-results/perf-summary.{md,json}` | custom reporter | Latency table, budget verdicts, breach list |
| `docs/observed-behaviour.generated.md` | custom reporter | Undocumented Trello responses, for tightening assertions |
| HTML + JUnit | Playwright | Local debugging, CI ingestion |

The flaky column is deliberate: both suites hit third-party production systems, so
distinguishing "failed then passed on retry" from "broken" is what keeps the signal usable.

---

## Known trade-offs

- **Live third-party targets.** telenor.se copy and markup change without notice; the site
  is pinned to `sv-SE`, so locators must match Swedish text. Trello latency varies enough to
  move p95 across a budget line between runs.
- **Perf budgets uncalibrated** — see above. The stage reports rather than blocks.
- **Web negative coverage is not currently wired up.** The journey spec is the single web
  test; invalid-address and premature-lookup cases are the obvious next addition.
- **`Cleanup › tear down the entire setup`** fails roughly 1 full run in 3 under parallel
  load and passes in isolation — consistent with Trello latency rather than a defect.
  CI `retries: 1` absorbs it; a targeted retry on that teardown call would be the real fix.
