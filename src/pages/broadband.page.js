import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class BroadbandPage extends BasePage {
  constructor(page) {
    super(page);
    this.searchInput = page.locator('[data-test="address-search-input"] input');
    this.addressList = page.locator('[data-test="address-list"]');
    this.addressSearchSubmitButton = page.locator('[data-test="address-search-submit-button"]');
    this.productGrid = page.locator('[data-test="product-grid"]');
    this.products = this.productGrid.locator('[data-test="grid-container"] > li');
  }

  async searchAddress(address) {
    await expect(this.searchInput).toBeVisible();
    await expect(this.searchInput).toBeEnabled();
    await this.searchInput.fill(address);
  }

  async verifyAddressList() {
    await expect(this.addressList).toBeVisible();
  }

  async submitAddress() {
    await expect(this.addressSearchSubmitButton).toBeVisible();
    await expect(this.addressSearchSubmitButton).toBeEnabled();
    const offersByAddress_request = this.page.waitForResponse('**/api/online-sales/address-search/get-offers-by-address*', { timeout: 40000 });
    await this.addressSearchSubmitButton.click();
    this.offersByAddress_response = await offersByAddress_request;
    return this.offersByAddress_response;
  }

  async verifyProductGridNotEmpty() {
    await expect(this.offersByAddress_response.status()).toBe(200);
    await expect(this.productGrid).toBeVisible();
    const productCount = await this.products.count();
    await expect(productCount, 'Product grid should contain at least one product').toBeGreaterThan(0);
  }
}
