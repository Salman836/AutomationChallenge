import { randomBytes } from 'node:crypto';

/**
 * Run-scoped naming (test plan §4.5).
 
 * Every entity the suite creates is prefixed with a value unique to this run, which
 * is what makes the orphan sweep in global teardown deterministic: "delete every
 * board whose name starts with this run's prefix" can never touch a board created
 * by a parallel run, another engineer's laptop, or a human.
 */

export function generateRunPrefix() {
  return `pw-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export function runPrefix() {
  if (!process.env.RUN_PREFIX) {
    process.env.RUN_PREFIX = generateRunPrefix();
  }
  return process.env.RUN_PREFIX;
}

/** `pw-mfk2p1x-a3f9c1-board-smoke` — traceable back to one run and one test. */
export function scopedName(...parts) {
  return [runPrefix(), ...parts.filter(Boolean)].join('-');
}

/** True for any run's test data — the sweep uses this to catch leaks from crashed runs. */
export function looksLikeTestData(name) {
  return typeof name === 'string' && /^pw-[a-z0-9]+-[a-f0-9]{6}-/.test(name);
}
