# Test Results: Mini Checkout

**Date:** 2026-11-21
**Build:** working tree of this repository
**Environment:** Windows 11, Node.js 24.15, Playwright 1.65.1, Chrome for Testing 159 (Chromium), page served by `server.js` at `http://127.0.0.1:4173`

## 1. Summary

| Area | Result |
| ---- | ------ |
| Required automated checks (TC-01..03) | **3 / 3 passed** |
| Extra regression checks (TC-04..13) | **15 / 15 passed** |
| Stability | full suite run 4 times (3 in parallel, 1 serial): **18 / 18 passed every time**, no retries |
| Manual: empty cart (M-01) | **Pass**: checkout blocked, clear message, name kept |
| Manual: rapid double-click (M-02) | **Pass**: one confirmation, one reference, one order |
| Exploratory: phone width (M-03) | **Fail → fixed**: defect **D-01**, regression test TC-13 added |
| Open defects | **None** |

The raw output of the final run is in [`test-run-output.txt`](test-run-output.txt). Run `npm test` to reproduce it.

## 2. Automated checks

```
npm test
```

| ID | Check | Result |
| -- | ----- | ------ |
| TC-01 | Successful checkout → one confirmation, reference `ORD-XXXXXXXX`, correct items and total ₹748.50 | Pass |
| TC-02 | Blank / whitespace-only name blocks checkout, message shown, cart and input kept | Pass |
| TC-03 | Quantity changes → exact totals ₹1,247.50 → ₹1,746.50 → ₹1,497.00 | Pass |
| TC-04 | Empty cart blocks checkout, name kept | Pass |
| TC-05 | Empty cart + blank name → both messages | Pass |
| TC-06 | Double-click → exactly one order | Pass |
| TC-07 | Two same-tick clicks + Enter twice → one order | Pass |
| TC-08 | Cart locked during processing | Pass |
| TC-09 | Invalid quantities `0`, `-1`, `1.5`, `11`, `abc`, empty → flagged and blocked (6 cases) | Pass |
| TC-10 | Remove items → totals update, empty state | Pass |
| TC-11 | Quantity limits 1..10 | Pass |
| TC-12 | Start a new order → clean state | Pass |
| TC-13 | 375 px phone: cart line fully visible (regression for D-01) | Pass |

### 2.1 Do the tests actually catch bugs?

A passing suite only means something if it fails when the app is wrong. I injected four bugs one at a time, ran the suite, and restored the original code after each one:

| Injected bug | Tests that failed | Caught? |
| ------------ | ----------------- | ------- |
| Removed the double-submit guard and the button disable | TC-01, TC-06, TC-07 | Yes |
| Line total computed from the price rounded down to whole rupees (₹249.50 → ₹249) | TC-01, TC-03, TC-08, TC-09 ×6, TC-10, TC-11 (11 tests) | Yes |
| Name validation no longer trims spaces (so `"   "` is accepted) | TC-02 | Yes |
| Reverted the D-01 mobile layout fix | TC-13 | Yes |

### 2.2 Problem found in the test code itself

On the first run TC-11 failed with a Playwright *strict mode violation*: `getByRole('status')` matched two elements. Besides the cart notice, the `<output>` element that shows the order total also has the ARIA role `status`. This was a mistake in the test locator, not an app defect. I fixed it by locating the notice through its `data-testid`, with a comment explaining why.

## 3. Manual tests

Run in Chromium on a fresh page load each time, at a desktop window size unless stated otherwise.

### M-01: Empty cart. Result: Pass

| Step | What happened |
| ---- | ------------- |
| 1. Open `http://127.0.0.1:4173` fresh | Cart shows "Your cart is empty.", items 0, total ₹0.00 |
| 2. Type "Asha Verma" in Full name | Text entered |
| 3. Click **Place order** | Red box "We couldn't place your order:" with "Your cart is empty. Add at least one item to place an order." No confirmation. The name "Asha Verma" was still in the field. No name error was shown, because the name was valid |
| 4. Click **Add to cart** for Canvas Tote Bag | The cart error went away by itself; total ₹499.00 |

Evidence: [`evidence/02-empty-cart-blocked.png`](evidence/02-empty-cart-blocked.png)

### M-02: Rapid double-click on Place order. Result: Pass

| Step | What happened |
| ---- | ------------- |
| 1. Add Canvas Tote Bag, enter name "Asha Verma" | Total ₹499.00 |
| 2. Double-click **Place order** as fast as possible | Button changed at once to greyed-out "Placing order…". The Add to cart, −/+ and Remove buttons were also greyed out |
| 3. Wait for processing (~0.8 s) | One "Order confirmed" panel: reference `ORD-TVJFH9CH`, "Canvas Tote Bag × 1 — ₹499.00", total ₹499.00 |
| 4. DevTools console: `document.querySelector('#app').dataset.ordersPlaced` | `"1"`. Only one order was created, not two with the second overwriting the first |
| 5. DevTools console: `document.querySelectorAll('[data-testid="confirmation"]:not([hidden])').length` | `1` |

Evidence: [`evidence/06-double-click-processing.png`](evidence/06-double-click-processing.png), [`evidence/07-single-confirmation.png`](evidence/07-single-confirmation.png). The automated versions are TC-06 (double-click) and TC-07 (two clicks in one JS tick, which is faster than any human, plus a repeated Enter key).

### M-03: Exploratory, phone width (375 × 812). Result: Fail, defect D-01, now fixed

See D-01 below.

## 4. Defects

### D-01: On a phone, the cart cuts off the line total and the Remove button

| Field | Detail |
| ----- | ------ |
| **Status** | Fixed (`src/styles.css`, phone layout); regression test **TC-13** |
| **Severity** | Medium. Totals and the order total stay correct, but the customer can't see each line's total or the Remove button without scrolling sideways inside the cart, and nothing suggests they should |
| **Found by** | Exploratory test M-03 |
| **Environment** | Chromium, viewport 375 × 812 (mobile emulation) |

**Steps to reproduce** (on the build before the fix):

1. Open `http://127.0.0.1:4173` in Chrome and open DevTools → device toolbar → set the size to 375 × 812.
2. Click **Add to cart** for Ceramic Mug.
3. Look at the cart row.

**Expected:** item name, price, quantity controls, line total and Remove are all visible without horizontal scrolling.

**Actual:** the 5-column table is wider than the screen. The "Line total" heading and value are cut off ("Line tc", "₹249."), the **Remove** button is off-screen, and a horizontal scrollbar appears under the table.

**Evidence:**
before: [`evidence/D-01-before-mobile-cart-clipped.jpg`](evidence/D-01-before-mobile-cart-clipped.jpg),
after: [`evidence/D-01-after-mobile-cart-stacked.jpg`](evidence/D-01-after-mobile-cart-stacked.jpg)

**Fix:** below 520 px each cart line is shown as a small stacked card (name and "Each ₹…" on the first row, quantity and "Total ₹…" on the second, Remove underneath). The table headers stay available to screen readers.

**Regression test:** TC-13 sets a 375 × 812 viewport, adds an item, and asserts that the line total and Remove are fully in the viewport and that the cart has no horizontal overflow. With the fix reverted, TC-13 fails (see 2.1).

## 5. Observations (not defects)

These are deliberate behaviours or minor points, recorded so a reviewer doesn't have to rediscover them:

* **Reloading the page empties the cart.** The brief asks for no backend or storage. This is also what gives every test a clean starting state.
* **A quantity typed as `05` is accepted as 5** and stays as typed ("05") until the next + / − click. The totals are correct.
* **While an order is processing, the quantity boxes are read-only but not greyed out** like the buttons. Typing does nothing, which is correct, but the visual cue is weaker. A possible polish item.
* **The name field has `maxlength="60"`,** so the browser silently stops input at 60 characters.
* **The 800 ms processing step is simulated** with a timer to stand in for a network call. It's what makes the double-click window real enough to test.
