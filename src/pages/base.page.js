import { expect } from '@playwright/test';

export class BasePage {
  constructor(page) {
    this.page = page;
    this.cookieDialog = page.getByRole('dialog').filter({ hasText: /cookie/i });
    this.acceptAllCookiesButton = page.locator('#onetrust-accept-btn-handler');
    this.rejectAllCookiesButton = page.locator('#onetrust-reject-all-handler');
  }

  async #dismissConsent(button) {
    try {
      await button.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return false; // consent already stored for this context — nothing to dismiss
    }
    await button.click();
    await expect(this.page.locator('#onetrust-banner-sdk')).toBeHidden();
    return true;
  }

  async acceptCookiesIfVisible() {
    return this.#dismissConsent(this.acceptAllCookiesButton);
  }

  async rejectCookiesIfVisible() {
    return this.#dismissConsent(this.rejectAllCookiesButton);
  }

  /** Assert a modal/dialog is open. */
  async verifyDialogVisible() {
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }
}
