// Captures screenshots used as evidence in docs/TEST_RESULTS.md.
// Run with: npm run evidence   (excluded from `npm test`)
import { test, expect } from '@playwright/test';
import { CheckoutPage } from './support/checkout-page.js';

const shot = (page, name) =>
  page.screenshot({ path: `docs/evidence/${name}.png`, fullPage: true });

test.describe('@evidence screenshots', () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test('@evidence capture key states', async ({ page }) => {
    await page.clock.install();
    const checkout = new CheckoutPage(page);
    await checkout.openClean();
    await shot(page, '01-clean-state');

    // Empty cart blocked (name entered, kept).
    await checkout.nameInput.fill('Asha Verma');
    await checkout.placeOrderButton.click();
    await expect(checkout.errorSummary).toBeVisible();
    await shot(page, '02-empty-cart-blocked');

    // Blank name blocked, cart kept.
    await checkout.nameInput.fill('');
    await checkout.add('Canvas Tote Bag');
    await checkout.add('Ceramic Mug');
    await checkout.placeOrderButton.click();
    await expect(checkout.nameError).toBeVisible();
    await shot(page, '03-blank-name-blocked');

    // Quantity change.
    await checkout.quantityInput('Ceramic Mug').fill('3');
    await expect(checkout.orderTotal).toHaveText('₹1,247.50');
    await shot(page, '04-quantity-updated-total');

    // Invalid quantity.
    await checkout.quantityInput('Ceramic Mug').fill('0');
    await expect(page.getByTestId('qty-error-mug')).toBeVisible();
    await shot(page, '05-invalid-quantity');
    await checkout.quantityInput('Ceramic Mug').fill('3');

    // Double-click: processing state, then one confirmation.
    await checkout.nameInput.fill('Asha Verma');
    await checkout.placeOrderButton.dblclick();
    await expect(checkout.placeOrderButton).toHaveText('Placing order…');
    await shot(page, '06-double-click-processing');
    await page.clock.runFor(5_000);
    await expect(checkout.confirmationHeading).toBeVisible();
    await expect(checkout.app).toHaveAttribute('data-orders-placed', '1');
    await shot(page, '07-single-confirmation');
  });
});
