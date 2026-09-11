/**
 * Latency budgets (test plan §7.3).
 *
 * Provisional until calibrated from the first green CI run (baseline p95 × 1.5).
 * They are committed *before* implementation on purpose: a budget written after
 * seeing the numbers is not a budget, it is a description.
 *
 *   p95     — the assertion. Verdicts are taken here.
 *   ceiling — a generous hard maximum, to catch a hang rather than jitter.
 *
 * These two are the whole contract: `judge()` reads nothing else. A p50 target
 * used to sit alongside them and was never asserted, which made the table read
 * stricter than the suite actually was. Measured p50 is still reported for every
 * series — it is just not a pass/fail gate.
 */

export const BUDGETS = {
  'POST /1/boards/': { p95: 1500, ceiling: 3000 },
  'GET /1/boards/{id}': { p95: 900, ceiling: 2500 },
  'PUT /1/boards/{id}': { p95: 1200, ceiling: 3000 },
  'DELETE /1/boards/{id}': { p95: 1500, ceiling: 3000 },
  'GET /1/boards/{id}/lists': { p95: 1000, ceiling: 2500 },
  'GET /1/boards/{id}/actions': { p95: 1200, ceiling: 3000 },
  'POST /1/lists': { p95: 1200, ceiling: 3000 },
  'GET /1/lists/{id}': { p95: 900, ceiling: 2500 },
  'PUT /1/lists/{id}': { p95: 1100, ceiling: 3000 },
  'GET /1/lists/{id}/cards': { p95: 1000, ceiling: 2500 },
  'POST /1/cards': { p95: 1200, ceiling: 3000 },
  'GET /1/cards/{id}': { p95: 800, ceiling: 2500 },
  'PUT /1/cards/{id}': { p95: 1100, ceiling: 3000 },
  'DELETE /1/cards/{id}': { p95: 1100, ceiling: 3000 },
  'WORKFLOW /five-steps': { p95: 6000, ceiling: 12000 },
};

/** Generous per-request ceiling for functional specs, which are not perf tests. */
export const FUNCTIONAL_CEILING_MS = 5000;
