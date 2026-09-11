/**
 * Static test data. values and invalid identifiers belong here so the whole suite agrees on what"malformed" and "at the limit" mean.
 */

export const IDS = {
  malformed: 'not-a-valid-id',
  absent: '5f5f5f5f5f5f5f5f5f5f5f5f',
  empty: ''
};

export const PAYLOADS = {
  html: '<script>alert("xss")</script>',
  sql: "'; DROP TABLE boards;--"
};

export const INVALID_DATES = ['not-a-date', '2026-13-45', '31/02/2026'];

/** ISO instant `days` from now, to the second — Trello normalises milliseconds. */
export function isoInDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCMilliseconds(0);
  return date.toISOString();
}

/** Trello returns due dates as ISO strings; compare instants, not formatting. */
export function sameInstant(a, b, toleranceMs = 1000) {
  if (!a || !b) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= toleranceMs;
}
