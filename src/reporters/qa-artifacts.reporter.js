import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { markdownTable } from '../utils/metrics.js';

/**
 * Turns test attachments into run-level deliverables:
 *
 *   `perf`               -> perf-results/perf-summary.{json,md}
 *   `observed-behaviour` -> docs/observed-behaviour.generated.md
 *   every test result     -> the GitHub Actions job summary, when running in CI
 *
 * The observed-behaviour file closes the plan's "record actual, then tighten"
 * approach to undocumented error codes: after a run, it states exactly what Trello
 * returned for every input where the reference is silent.
 */
export default class QaArtifactsReporter {
  constructor(options = {}) {
    this.perfDir = options.perfDir ?? 'perf-results';
    this.docsFile = options.docsFile ?? 'docs/observed-behaviour.generated.md';
    /** @type {any[]} */
    this.perf = [];
    /** @type {any[]} */
    this.observed = [];
    /** Outcome tallies and failure details for the job summary. */
    this.tally = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    /** @type {{ title: string, project: string, error: string }[]} */
    this.failures = [];
    /** @type {Set<string>} */
    this.projects = new Set();
    this.startedAt = new Date();
  }

  onBegin(config, suite) {
    // Kept so the summary can walk every test exactly once in onEnd. Tallying in
    // onTestEnd would double-count: that hook fires once per *attempt*, so with
    // retries enabled a single failing test reports itself twice.
    this.suite = suite;
  }

  onTestEnd(test, result) {
    for (const attachment of result.attachments) {
      if (!attachment.body) continue;
      let payload;
      try {
        payload = JSON.parse(attachment.body.toString('utf8'));
      } catch {
        continue;
      }
      if (attachment.name === 'perf') {
        this.perf.push({ test: test.title, ...payload });
      } else if (attachment.name === 'observed-behaviour') {
        this.observed.push(payload);
      }
    }
  }

  onEnd(result) {
    if (this.perf.length > 0) this.#writePerf(result);
    if (this.observed.length > 0) this.#writeObserved();
    this.#writeJobSummary(result);
  }

  /**
   * Append a run summary to the GitHub Actions job summary panel.
   *
   * `GITHUB_STEP_SUMMARY` is only set inside Actions, so this is a no-op locally.
   * It is appended, not overwritten, because several steps in a job may contribute
   * — the perf job also pipes its latency table in.
   */
  #writeJobSummary(result) {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file) return;

    // `outcome()` collapses retries: a test that passed on retry is "flaky", not a
    // failure. Walking allTests() counts each test once regardless of attempts.
    for (const test of this.suite?.allTests() ?? []) {
      const project = test.parent?.project()?.name ?? 'unknown';
      this.projects.add(project);

      const outcome = test.outcome();
      if (outcome === 'expected') this.tally.passed += 1;
      else if (outcome === 'flaky') this.tally.flaky += 1;
      else if (outcome === 'skipped') this.tally.skipped += 1;
      else {
        this.tally.failed += 1;
        this.failures.push({
          title: test.titlePath().slice(3).filter(Boolean).join(' › ') || test.title,
          project,
          error: (test.results.at(-1)?.error?.message ?? 'no error message')
            .replace(/\[[0-9;]*m/g, '') // strip ANSI colour
            .split('\n')[0]
            .slice(0, 160),
        });
      }
    }

    const { passed, failed, flaky, skipped } = this.tally;
    const icon = result.status === 'passed' ? '✅' : result.status === 'timedout' ? '⏱️' : '❌';
    const projects = [...this.projects].sort().join(', ') || 'none';
    const seconds = ((Date.now() - this.startedAt.getTime()) / 1000).toFixed(1);

    const lines = [
      `## ${icon} ${projects} — ${result.status}`,
      '',
      '| Passed | Failed | Flaky | Skipped | Duration |',
      '| ---: | ---: | ---: | ---: | ---: |',
      `| ${passed} | ${failed} | ${flaky} | ${skipped} | ${seconds}s |`,
      '',
    ];

    if (this.failures.length > 0) {
      lines.push('### Failures', '', '| Test | Project | Error |', '| --- | --- | --- |');
      for (const failure of this.failures.slice(0, 25)) {
        lines.push(`| ${escapeCell(failure.title)} | ${failure.project} | ${escapeCell(failure.error)} |`);
      }
      if (this.failures.length > 25) {
        lines.push('', `_…and ${this.failures.length - 25} more. See the uploaded HTML report._`);
      }
      lines.push('');
    }

    if (flaky > 0) {
      lines.push(
        `> ⚠️ ${flaky} test(s) passed only on retry. Both suites hit third-party systems, ` +
          'so a flake here is usually the network rather than a defect — but a test that ' +
          'flakes repeatedly is worth pinning down.',
        '',
      );
    }

    try {
      appendFileSync(file, `${lines.join('\n')}\n`, 'utf8');
    } catch {
      // A summary that cannot be written must never fail the run.
    }
  }

  #write(file, contents) {
    const path = resolve(process.cwd(), file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, 'utf8');
    return path;
  }

  #writePerf(result) {
    const rows = this.perf.flatMap((entry) => entry.summaries ?? []);
    const failures = rows.filter((row) => row.status === 'FAIL');

    this.#write(
      `${this.perfDir}/perf-summary.json`,
      JSON.stringify(
        { startedAt: this.startedAt.toISOString(), status: result.status, entries: this.perf },
        null,
        2,
      ),
    );

    const md = [
      '# Performance summary',
      '',
      `Run started ${this.startedAt.toISOString()} · overall status **${result.status}**`,
      '',
      'All figures are client-observed latency in milliseconds. The first sample of each',
      'series is excluded as cold start and reported in its own column. Verdicts are taken',
      'on p95 against the budgets in `src/data/perfBudgets.js`.',
      '',
      rows.length > 0 ? markdownTable(rows) : '_No latency series recorded._',
      '',
      failures.length > 0
        ? `## Budget breaches (${failures.length})\n\n` +
          failures.map((row) => `- **${row.label}** — ${row.reasons.join('; ')}`).join('\n')
        : '## Budget breaches\n\nNone.',
      '',
    ].join('\n');

    const path = this.#write(`${this.perfDir}/perf-summary.md`, md);
    // eslint-disable-next-line no-console
    console.log(`\n  Performance summary written to ${path}`);
  }

  #writeObserved() {
    const byCase = new Map();
    for (const record of this.observed) {
      // Keep one row per case; a retried test would otherwise duplicate itself.
      byCase.set(`${record.caseId}::${record.endpoint}`, record);
    }
    const records = [...byCase.values()].sort((a, b) => a.caseId.localeCompare(b.caseId));

    const md = [
      '# Observed behaviour',
      '',
      '> Generated by `src/reporters/qa-artifacts.reporter.js`. Do not edit by hand.',
      '',
      'Trello does not publish an exact rejection code for every invalid input. These',
      'specs assert the class of the response (a 4xx client error) and record what the',
      'API actually returned. Use this table to tighten each assertion to an exact',
      'status, and to raise a documentation defect wherever the two disagree.',
      '',
      '| Case | Endpoint | Expected | Observed | Response body (truncated) |',
      '| --- | --- | --- | ---: | --- |',
      ...records.map(
        (r) =>
          `| ${r.caseId} | \`${r.endpoint}\` | ${r.expectation} | **${r.observedStatus}** | ` +
          `\`${String(r.observedBody).replace(/\|/g, '\\|').slice(0, 160)}\` |`,
      ),
      '',
      `_${records.length} input(s) recorded at ${new Date().toISOString()}._`,
      '',
    ].join('\n');

    const path = this.#write(this.docsFile, md);
    // eslint-disable-next-line no-console
    console.log(`  Observed-behaviour notes written to ${path}`);
  }
}

/** Pipes and newlines would break out of a markdown table cell. */
function escapeCell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
