/** Linear-interpolated percentile. Internal — `summarize` is the public entry point. */
function percentile(sortedAscending, p) {
  if (sortedAscending.length === 0) return Number.NaN;
  if (sortedAscending.length === 1) return sortedAscending[0];
  const rank = (p / 100) * (sortedAscending.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedAscending[low];
  return sortedAscending[low] + (rank - low) * (sortedAscending[high] - sortedAscending[low]);
}

const round = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

/**
 * @param {string} label      human name, e.g. "POST /1/boards/"
 * @param {number[]} samples  every latency in ms, in the order observed
 * @param {{ dropColdStart?: boolean, errors?: number }} [options]
 */
export function summarize(label, samples, options = {}) {
  const { dropColdStart = true, errors = 0 } = options;
  const coldStartMs = dropColdStart && samples.length > 1 ? samples[0] : null;
  const measured = dropColdStart && samples.length > 1 ? samples.slice(1) : [...samples];
  const sorted = [...measured].sort((a, b) => a - b);
  const mean = measured.reduce((sum, n) => sum + n, 0) / (measured.length || 1);
  const variance = measured.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (measured.length || 1);

  return {
    label,
    n: measured.length,
    coldStartMs: round(coldStartMs),
    p50: round(percentile(sorted, 50)),
    p90: round(percentile(sorted, 90)),
    p95: round(percentile(sorted, 95)),
    max: round(sorted[sorted.length - 1]),
    mean: round(mean),
    stdev: round(Math.sqrt(variance)),
    errors,
    errorRate: round((errors / Math.max(1, measured.length + errors)) * 100)
  };
}

/** @returns {{ status: 'PASS'|'FAIL', reasons: string[] }} */
export function judge(summary, budget) {
  const reasons = [];
  if (budget?.p95 != null && summary.p95 > budget.p95) {
    reasons.push(`p95 ${summary.p95} ms exceeds the ${budget.p95} ms budget`);
  }
  if (budget?.ceiling != null && summary.max > budget.ceiling) {
    reasons.push(`max ${summary.max} ms exceeds the ${budget.ceiling} ms hard ceiling`);
  }
  if (summary.errors > 0) {
    reasons.push(`${summary.errors} non-2xx response(s) — the error-rate budget is 0%`);
  }
  return { status: reasons.length === 0 ? 'PASS' : 'FAIL', reasons };
}

export function markdownTable(rows) {
  const header = '| Endpoint | N | p50 | p90 | p95 | max | budget | cold | err% | status |\n' + '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |';
  const body = rows.map((r) => `| ${r.label} | ${r.n} | ${r.p50} | ${r.p90} | ${r.p95} | ${r.max} | ` + `${r.budget?.p95 ?? '—'} | ${r.coldStartMs ?? '—'} | ${r.errorRate} | ${r.status} |`).join('\n');
  return `${header}\n${body}`;
}

/**
 * Attach a measurement series to the test. The qa-artifacts reporter collects every
 * attachment named `perf` and writes the combined run report.
 */
export async function attachPerf(testInfo, payload) {
  await testInfo.attach('perf', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(payload, null, 2))
  });
}
