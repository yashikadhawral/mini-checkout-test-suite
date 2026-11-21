import { expect } from '@playwright/test';

/**
 * Thin page object. Locators prefer what the customer sees (roles, labels, button text);
 * data-testid is used only for values that have no accessible name of their own
 * (totals, the order reference).
 */
export class CheckoutPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.orderTotal = page.getByTestId('order-total');
    this.itemCount = page.getByTestId('item-count');
    this.cartEmpty = page.getByTestId('cart-empty');
    // role="status" live region. Not located by role: <output> (the order total) is also a status.
    this.cartNotice = page.getByTestId('cart-notice');
    this.nameInput = page.getByLabel('Full name');
    this.placeOrderButton = page.getByRole('button', { name: /place order|placing order/i });
    this.errorSummary = page.getByRole('alert');
    this.nameError = page.getByTestId('name-error');
    this.confirmation = page.getByTestId('confirmation');
    this.confirmationHeading = page.getByRole('heading', { name: 'Order confirmed' });
    this.orderReference = page.getByTestId('order-reference');
    this.confirmationName = page.getByTestId('confirmation-name');
    this.confirmationTotal = page.getByTestId('confirmation-total');
    this.app = page.locator('#app');
  }

  /** Open the page and assert it is in a clean, empty starting state. */
  async openClean() {
    await this.page.goto('/');
    await expect(this.app).toHaveAttribute('data-ready', 'true');
    await expect(this.cartEmpty).toBeVisible();
    await expect(this.orderTotal).toHaveText('₹0.00');
    await expect(this.nameInput).toHaveValue('');
    await expect(this.confirmation).toBeHidden();
  }

  async add(productName) {
    await this.page.getByRole('button', { name: `Add ${productName} to cart` }).click();
  }

  quantityInput(productName) {
    return this.page.getByRole('textbox', { name: `Quantity for ${productName}` });
  }

  lineTotal(productId) {
    return this.page.getByTestId(`line-total-${productId}`);
  }

  increase(productName) {
    return this.page.getByRole('button', { name: `Increase quantity of ${productName}` });
  }

  decrease(productName) {
    return this.page.getByRole('button', { name: `Decrease quantity of ${productName}` });
  }

  remove(productName) {
    return this.page.getByRole('button', { name: `Remove ${productName} from cart` });
  }

  async expectNoOrderPlaced() {
    await expect(this.confirmation).toBeHidden();
    await expect(this.app).toHaveAttribute('data-orders-placed', '0');
  }
}

export const REFERENCE_PATTERN = /^ORD-[A-Z0-9]{8}$/;
