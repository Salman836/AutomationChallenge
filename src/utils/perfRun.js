import { expect } from '@playwright/test';
import { summarize, judge, markdownTable, attachPerf } from './metrics.js';
import { BUDGETS } from '../data/perfBudgets.js';

export class PerfRun {
  /**
   * @param {import('@playwright/test').TestInfo} testInfo
   * @param {number} defaultSamples per-series sample count (`PERF_SAMPLES`)
   */
  constructor(testInfo, defaultSamples) {
    this.testInfo = testInfo;
    this.defaultSamples = defaultSamples;
    /** @type {any[]} */
    this.rows = [];
  }

  /** One timed call. */
  static async time(call) {
    const started = performance.now();
    const response = await call();
    return { response, ms: performance.now() - started };
  }

  /** Turn raw latencies into a judged row and keep it for the report. */
  add(label, samples, { errors = 0, budget = BUDGETS[label], dropColdStart = true } = {}) {
    const summary = summarize(label, samples, { errors, dropColdStart });
    const { status, reasons } = judge(summary, budget);
    const row = { ...summary, budget: budget ?? null, status, reasons };
    this.rows.push(row);
    return row;
  }

  /**
   * A non-2xx is counted rather than thrown: the error rate is part of the
   * measurement, and one blip should not discard the whole series.
   */
  async series(label, call, { samples = this.defaultSamples, ...options } = {}) {
    const latencies = [];
    let errors = 0;

    for (let i = 0; i < samples; i += 1) {
      const { response, ms } = await PerfRun.time(() => call(i));
      latencies.push(ms);
      if (!response.ok()) errors += 1;
    }
    return this.add(label, latencies, { errors, ...options });
  }

  /**
   * Measure a create and its matching delete together.
   * Taking 20 samples of a create without deleting would leave 20 entities behind,
   * and a Trello Free workspace caps open boards — the measurement would start
   * failing for a reason that has nothing to do with latency. Pairing keeps at most
   * one alive at a time and yields the delete series for free.
   */
  async pairedSeries({ create, remove }, createLabel, removeLabel, { samples = this.defaultSamples } = {}) {
    const creates = [];
    const removes = [];
    let createErrors = 0;
    let removeErrors = 0;

    for (let i = 0; i < samples; i += 1) {
      const created = await PerfRun.time(() => create(i));
      creates.push(created.ms);
      if (!created.response.ok()) {
        createErrors += 1;
        continue;
      }

      const { id } = await created.response.json();
      const removed = await PerfRun.time(() => remove(id));
      removes.push(removed.ms);
      if (!removed.response.ok()) removeErrors += 1;
    }

    this.add(createLabel, creates, { errors: createErrors });
    this.add(removeLabel, removes, { errors: removeErrors });
  }

  /**
   * Time a whole multi-call flow, repeated.
   * Unlike `series` this lets a failure throw: a workflow that cannot complete is a
   * broken test, not a slow one, and recording it as "20% error rate" would bury it.
   * There is no cold start to drop — global setup already warmed the connection.
   */
  async flow(label, run, { repetitions = 5, ...options } = {}) {
    const latencies = [];
    for (let i = 0; i < repetitions; i += 1) {
      const started = performance.now();
      await run(i);
      latencies.push(performance.now() - started);
    }
    return this.add(label, latencies, { dropColdStart: false, ...options });
  }

  /** Attach the run's measurements, then fail on every breached budget at once. */
  async publish() {
    await attachPerf(this.testInfo, { summaries: this.rows });
    await this.testInfo.attach('perf-table', {
      contentType: 'text/markdown',
      body: Buffer.from(markdownTable(this.rows))
    });

    const breaches = this.rows.filter((row) => row.status === 'FAIL');
    expect(
      breaches.map((row) => `${row.label}: ${row.reasons.join('; ')}`),
      'latency budget breached'
    ).toEqual([]);
  }
}
