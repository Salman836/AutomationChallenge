import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class HomePage extends BasePage {
  constructor(page) {
    super(page);
    this.mainNav = page.locator('[aria-label="Huvudmeny"]');
    this.submenuDropDown = page.locator('[aria-label="Undermeny"]');
  }

  async open() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveTitle(/Telenor/);
    await this.acceptCookiesIfVisible();
  }

  async validateHomePage() {
    await expect(this.mainNav).toBeVisible();
  }

  async clickToMenu(label) {
    const menu = this.page.locator(`[data-test="${label}"]:visible`).first();
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(this.submenuDropDown).toBeVisible();
  }

  async navigateToSubmenuPage(label) {
    const submenu = this.page.locator(`[title="${label}"]:visible`).first();
    await expect(submenu).toBeVisible();
    await submenu.click();
    await expect(this.page).toHaveURL('/handla/bredband/', { timeout: 40000 });
  }
}
