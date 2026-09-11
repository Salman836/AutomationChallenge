import { expect } from '@playwright/test';

/**
 *
 * @param {import('@playwright/test').APIResponse} response
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{ caseId: string, likely?: number }} options `likely` is the documented
 *   hypothesis; a mismatch is recorded as a finding, not failed as a defect.
 */
export async function expectClientError(response, testInfo, { caseId, likely } = {}) {
  const status = response.status();
  const body = await response.text();
  const label = caseId ?? testInfo.title;
  const context = `${label}: ${new URL(response.url()).pathname} -> ${status}\n  body: ${body.slice(0, 300)}`;

  expect(status, `Expected a 4xx client error${likely ? ` (${likely} expected)` : ''}\n  ${context}`).toBeGreaterThanOrEqual(400);
  expect(status, `A client error must not be a 5xx\n  ${context}`).toBeLessThan(500);

  await testInfo.attach('observed-behaviour', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        caseId: label,
        endpoint: new URL(response.url()).pathname,
        expectation: likely ? `4xx (${likely} expected)` : '4xx',
        observedStatus: status,
        observedBody: body.slice(0, 300),
        project: testInfo.project.name,
        at: new Date().toISOString()
      })
    )
  });

  if (likely && status !== likely) {
    console.log(`[note] ${label}: expected ${likely}, Trello returned ${status} — recorded.`);
  }
  return status;
}
