// The three required browser checks (TC-01, TC-02, TC-03 in docs/TEST_PLAN.md).
// Each test gets a fresh browser context (no cookies/storage) and opens the page from scratch,
// then asserts the clean starting state before doing anything.
import { test, expect } from '@playwright/test';
import { CheckoutPage, REFERENCE_PATTERN } from './support/checkout-page.js';

test.describe('Checkout: required checks', () => {
  /** @type {CheckoutPage} */
  let checkout;

  test.beforeEach(async ({ page }) => {
    checkout = new CheckoutPage(page);
    await checkout.openClean();
  });

  test('TC-01 successful checkout shows one confirmation with a reference', async () => {
    await checkout.add('Canvas Tote Bag');
    await checkout.add('Ceramic Mug');
    await expect(checkout.orderTotal).toHaveText('₹748.50');

    await checkout.nameInput.fill('Asha Verma');
    await checkout.placeOrderButton.click();

    // While processing, the button is visibly locked.
    await expect(checkout.placeOrderButton).toBeDisabled();

    await expect(checkout.confirmationHeading).toBeVisible();
    await expect(checkout.confirmation).toHaveCount(1);
    await expect(checkout.orderReference).toHaveText(REFERENCE_PATTERN);
    await expect(checkout.confirmationName).toHaveText('Asha Verma');
    await expect(checkout.confirmationTotal).toHaveText('₹748.50');
    await expect(checkout.confirmation.getByRole('listitem')).toHaveText([
      'Canvas Tote Bag × 1 — ₹499.00',
      'Ceramic Mug × 1 — ₹249.50',
    ]);
    // The checkout form is gone, so the customer cannot submit again from this screen.
    await expect(checkout.nameInput).toBeHidden();
    await expect(checkout.app).toHaveAttribute('data-orders-placed', '1');
  });

  test('TC-02 blank name blocks checkout, shows a message and keeps the cart', async () => {
    await checkout.add('Canvas Tote Bag');
    await checkout.add('Canvas Tote Bag');
    await expect(checkout.quantityInput('Canvas Tote Bag')).toHaveValue('2');

    // Blank name.
    await checkout.placeOrderButton.click();
    await expect(checkout.errorSummary).toContainText('Enter your full name to place the order.');
    await expect(checkout.nameError).toHaveText('Enter your full name to place the order.');
    await expect(checkout.nameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(checkout.nameInput).toBeFocused();
    await checkout.expectNoOrderPlaced();

    // Whitespace only is still blank; what the customer typed is left as is.
    await checkout.nameInput.fill('   ');
    await checkout.placeOrderButton.click();
    await expect(checkout.nameError).toHaveText('Enter your full name to place the order.');
    await expect(checkout.nameInput).toHaveValue('   ');
    await checkout.expectNoOrderPlaced();

    // The cart the customer built is preserved.
    await expect(checkout.quantityInput('Canvas Tote Bag')).toHaveValue('2');
    await expect(checkout.lineTotal('tote')).toHaveText('₹998.00');
    await expect(checkout.orderTotal).toHaveText('₹998.00');

    // Fixing the field clears the error and the order can then go through.
    await checkout.nameInput.fill('Ravi Kumar');
    await expect(checkout.nameError).toBeHidden();
    await expect(checkout.errorSummary).toBeHidden();
    await checkout.placeOrderButton.click();
    await expect(checkout.confirmationHeading).toBeVisible();
    await expect(checkout.confirmationTotal).toHaveText('₹998.00');
  });

  test('TC-03 changing a quantity updates line totals and the exact order total', async () => {
    await checkout.add('Canvas Tote Bag'); // ₹499.00
    await checkout.add('Ceramic Mug'); // ₹249.50
    await expect(checkout.orderTotal).toHaveText('₹748.50');

    // Type a new quantity.
    await checkout.quantityInput('Ceramic Mug').fill('3');
    await expect(checkout.lineTotal('mug')).toHaveText('₹748.50'); // 3 × 249.50
    await expect(checkout.lineTotal('tote')).toHaveText('₹499.00');
    await expect(checkout.orderTotal).toHaveText('₹1,247.50'); // 499.00 + 748.50
    await expect(checkout.itemCount).toHaveText('4');

    // Use the + and − buttons.
    await checkout.increase('Canvas Tote Bag').click();
    await expect(checkout.lineTotal('tote')).toHaveText('₹998.00');
    await expect(checkout.orderTotal).toHaveText('₹1,746.50');

    await checkout.decrease('Ceramic Mug').click();
    await expect(checkout.quantityInput('Ceramic Mug')).toHaveValue('2');
    await expect(checkout.lineTotal('mug')).toHaveText('₹499.00');
    await expect(checkout.orderTotal).toHaveText('₹1,497.00');
    await expect(checkout.itemCount).toHaveText('4');
  });
});
