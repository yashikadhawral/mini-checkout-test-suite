// Extra regression checks for the risks covered manually in docs/TEST_PLAN.md
// (empty cart, double submit, bad quantities, remove). Not part of the required three,
// but cheap to keep so the manual findings stay fixed.
import { test, expect } from '@playwright/test';
import { CheckoutPage, REFERENCE_PATTERN } from './support/checkout-page.js';

test.describe('Checkout: regression checks', () => {
  /** @type {CheckoutPage} */
  let checkout;

  test.beforeEach(async ({ page }) => {
    // Fake clock: the order "processing" timer only advances when a test says so, which lets
    // the double-submit tests act inside that window and then flush it with no fixed sleeps.
    await page.clock.install();
    checkout = new CheckoutPage(page);
    await checkout.openClean();
  });

  test('TC-04 empty cart blocks checkout and keeps the entered name', async ({ page }) => {
    await checkout.nameInput.fill('Asha Verma');
    await checkout.placeOrderButton.click();

    await expect(checkout.errorSummary).toContainText(
      'Your cart is empty. Add at least one item to place an order.',
    );
    await expect(checkout.errorSummary).toBeFocused();
    await expect(checkout.nameInput).toHaveValue('Asha Verma');
    await expect(checkout.nameError).toBeHidden();
    await page.clock.runFor(5_000);
    await checkout.expectNoOrderPlaced();

    // Adding an item clears the cart error.
    await checkout.add('Ceramic Mug');
    await expect(checkout.errorSummary).toBeHidden();
  });

  test('TC-05 empty cart and blank name report both problems at once', async () => {
    await checkout.placeOrderButton.click();
    await expect(checkout.errorSummary.getByRole('listitem')).toHaveText([
      'Your cart is empty. Add at least one item to place an order.',
      'Enter your full name to place the order.',
    ]);
    await checkout.expectNoOrderPlaced();
  });

  test('TC-06 double-clicking Place order creates exactly one order', async ({ page }) => {
    await checkout.add('Canvas Tote Bag');
    await checkout.nameInput.fill('Asha Verma');

    await checkout.placeOrderButton.dblclick();

    // Inside the processing window: locked, nothing confirmed yet.
    await expect(checkout.placeOrderButton).toBeDisabled();
    await expect(checkout.placeOrderButton).toHaveText('Placing order…');
    await expect(checkout.app).toHaveAttribute('data-orders-placed', '0');

    await page.clock.runFor(5_000);

    await expect(checkout.confirmationHeading).toBeVisible();
    await expect(checkout.confirmation).toHaveCount(1);
    await expect(checkout.app).toHaveAttribute('data-orders-placed', '1');
    const reference = await checkout.orderReference.textContent();
    expect(reference).toMatch(REFERENCE_PATTERN);

    // Let any stray timers run; the reference must not change and no second order appears.
    await page.clock.runFor(5_000);
    await expect(checkout.orderReference).toHaveText(reference);
    await expect(checkout.app).toHaveAttribute('data-orders-placed', '1');
  });

  test('TC-07 two clicks in the same tick and repeated Enter still create one order', async ({ page }) => {
    await checkout.add('Ceramic Mug');
    await checkout.nameInput.fill('Asha Verma');

    // Faster than any human: two synchronous clicks, then Enter on the name field twice.
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="place-order"]');
      button.click();
      button.click();
    });
    await checkout.nameInput.press('Enter');
    await checkout.nameInput.press('Enter');

    await page.clock.runFor(5_000);
    await expect(checkout.confirmationHeading).toBeVisible();
    await expect(checkout.app).toHaveAttribute('data-orders-placed', '1');
  });

  test('TC-08 cart cannot be edited while the order is processing', async ({ page }) => {
    await checkout.add('Ceramic Mug');
    await checkout.nameInput.fill('Asha Verma');
    await checkout.placeOrderButton.click();

    await expect(page.getByRole('button', { name: 'Add Canvas Tote Bag to cart' })).toBeDisabled();
    await expect(checkout.increase('Ceramic Mug')).toBeDisabled();
    await expect(checkout.remove('Ceramic Mug')).toBeDisabled();

    await page.clock.runFor(5_000);
    await expect(checkout.confirmationTotal).toHaveText('₹249.50');
  });

  for (const bad of ['0', '-1', '1.5', '11', 'abc', '']) {
    test(`TC-09 invalid quantity "${bad}" is flagged and blocks checkout`, async () => {
      await checkout.add('Ceramic Mug');
      await checkout.add('Ceramic Mug'); // qty 2, ₹499.00
      await checkout.nameInput.fill('Asha Verma');

      await checkout.quantityInput('Ceramic Mug').fill(bad);
      await expect(checkout.page.getByTestId('qty-error-mug')).toHaveText(
        'Quantity must be a whole number from 1 to 10.',
      );
      await expect(checkout.quantityInput('Ceramic Mug')).toHaveAttribute('aria-invalid', 'true');
      // Totals keep the last valid quantity rather than showing a wrong number.
      await expect(checkout.orderTotal).toHaveText('₹499.00');

      await checkout.placeOrderButton.click();
      await expect(checkout.errorSummary).toContainText(
        'Fix the highlighted quantity before placing your order.',
      );
      await checkout.expectNoOrderPlaced();
      await expect(checkout.quantityInput('Ceramic Mug')).toHaveValue(bad);

      // Correcting it clears the error.
      await checkout.quantityInput('Ceramic Mug').fill('4');
      await expect(checkout.errorSummary).toBeHidden();
      await expect(checkout.orderTotal).toHaveText('₹998.00');
    });
  }

  test('TC-10 removing items updates totals and returns to the empty state', async () => {
    await checkout.add('Canvas Tote Bag');
    await checkout.add('Ceramic Mug');
    await expect(checkout.orderTotal).toHaveText('₹748.50');

    await checkout.remove('Canvas Tote Bag').click();
    await expect(checkout.lineTotal('tote')).toHaveCount(0);
    await expect(checkout.orderTotal).toHaveText('₹249.50');

    await checkout.remove('Ceramic Mug').click();
    await expect(checkout.cartEmpty).toBeVisible();
    await expect(checkout.orderTotal).toHaveText('₹0.00');
    await expect(checkout.itemCount).toHaveText('0');
  });

  test('TC-11 quantity stops at 10 and minus stops at 1', async () => {
    await checkout.add('Ceramic Mug');
    await expect(checkout.decrease('Ceramic Mug')).toBeDisabled();

    await checkout.quantityInput('Ceramic Mug').fill('10');
    await expect(checkout.increase('Ceramic Mug')).toBeDisabled();
    await checkout.add('Ceramic Mug');
    await expect(checkout.cartNotice).toHaveText('You can order up to 10 of each item.');
    await expect(checkout.quantityInput('Ceramic Mug')).toHaveValue('10');
    await expect(checkout.orderTotal).toHaveText('₹2,495.00');
  });

  test('TC-13 (D-01) on a 375px phone the whole cart line fits without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await checkout.add('Ceramic Mug');

    await expect(checkout.lineTotal('mug')).toBeInViewport({ ratio: 1 });
    await expect(checkout.remove('Ceramic Mug')).toBeInViewport({ ratio: 1 });
    const overflow = await page
      .locator('.cart-table-wrap')
      .evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('TC-12 starting a new order resets to a clean state', async ({ page }) => {
    await checkout.add('Ceramic Mug');
    await checkout.nameInput.fill('Asha Verma');
    await checkout.placeOrderButton.click();
    await page.clock.runFor(5_000);
    await expect(checkout.confirmationHeading).toBeVisible();

    await page.getByRole('button', { name: 'Start a new order' }).click();
    await expect(checkout.confirmation).toBeHidden();
    await expect(checkout.cartEmpty).toBeVisible();
    await expect(checkout.orderTotal).toHaveText('₹0.00');
    await expect(checkout.nameInput).toHaveValue('');
    await expect(checkout.placeOrderButton).toBeEnabled();
    await expect(checkout.placeOrderButton).toHaveText('Place order');
  });
});
