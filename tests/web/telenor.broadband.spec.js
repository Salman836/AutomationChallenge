import { test, expect } from '@playwright/test';
import { HomePage, BroadbandPage } from '../../src/pages/index.js';

var page, home, broadband;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  home = new HomePage(page);
  broadband = new BroadbandPage(page);
  await home.open();
});
test.describe('Telenor · broadband journey', () => {
  test('End to End Flow telenor.se -> shop nav -> Bredband -> address -> product grid', { tag: ['@smoke', '@e2e'] }, async () => {
    await home.clickToMenu('Bredband');
    await home.navigateToSubmenuPage('Bredband via fiber  ');
    await broadband.searchAddress('Kungsgatan 103, Uppsala');
    await broadband.verifyAddressList();
    await broadband.submitAddress();
    await broadband.verifyProductGridNotEmpty();
  });
});
