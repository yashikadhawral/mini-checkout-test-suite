# Test Plan: Mini Checkout

## 1. Scope

**In scope:** the single-page checkout in `src/`: product list, cart (add, remove, change quantity), line and order totals, the required **Full name** field, validation messages, Place order, and the order confirmation.

**Out of scope:** payments, a backend or database, stock levels, tax, shipping, discounts, and saving the cart across page reloads. None of these are in the brief, and the app has no persistence on purpose, so every page load starts clean.

**Test data (synthetic, fixed):**

| Product         | Unit price | Notes                                       |
| --------------- | ---------- | ------------------------------------------- |
| Canvas Tote Bag | ₹499.00    | whole-rupee price                           |
| Ceramic Mug     | ₹249.50    | has paise, to catch rounding/float errors   |

Quantity rule: whole numbers from 1 to 10 per item.

## 2. Risks, in priority order

| #  | Risk | Impact if it fails | Priority | Covered by |
| -- | ---- | ------------------ | -------- | ---------- |
| R1 | **Wrong total** (bad arithmetic, float rounding, stale total after a quantity change) | Customer is charged the wrong amount; loss of trust | **P1** | TC-03, TC-01, TC-09, TC-10, TC-11 |
| R2 | **Duplicate order** from a double-click, a repeated Enter key, or a click during processing | Customer is charged or shipped twice | **P1** | TC-06, TC-07, M-02 |
| R3 | **Order placed with missing data** (blank or whitespace-only name, empty cart) | Order can't be fulfilled; junk orders | **P1** | TC-02, TC-04, TC-05, M-01 |
| R4 | **No clear confirmation** (no reference, wrong items or total shown, more than one confirmation) | Customer doesn't know whether the order went through and retries, which leads back to R2 | **P1** | TC-01, TC-06 |
| R5 | **Customer input lost** after a validation error (cart emptied, name cleared) | Frustration, abandoned checkout | P2 | TC-02, TC-04, TC-09 |
| R6 | **Invalid quantity accepted** (0, negative, decimal, >10, text, empty) | Wrong total or a nonsense order | P2 | TC-09, TC-11 |
| R7 | **Cart changed while the order is processing**, so the confirmation doesn't match the cart | Confirmation shows a different total from what was charged | P2 | TC-08 |
| R8 | **Unclear error messages** (generic, or not next to the field, or not announced) | Customer can't fix the problem | P2 | TC-02, TC-04 (exact message text, `role="alert"`, focus) |
| R9 | **Layout breaks on a phone** (totals or controls cut off) | Customer can't see what they pay | P3 | M-03, TC-13 |
| R10 | State leaks into the next order after "Start a new order" | Old items or name carried over | P3 | TC-12 |

## 3. Approach

* **Automated browser checks (Playwright, Chromium).** Each test opens the page in a **fresh browser context** (no cookies or storage) and first asserts the clean starting state: cart empty, total ₹0.00, name blank, no confirmation.
* **Assertions on what the customer sees:** visible text of totals, messages and the confirmation, enabled/disabled state, focus. `data-testid` is used only for values that have no accessible name (totals, the reference).
* **No fixed waits.** Playwright's auto-retrying `expect` waits for the UI. For the 800 ms simulated processing step, the regression tests install Playwright's **fake clock** and advance it explicitly (`page.clock.runFor`). That makes the double-submit window deterministic instead of timing-dependent.
* **Proof that only one order was placed:** besides checking that one confirmation is visible, the page exposes `data-orders-placed` (a counter of orders confirmed in this page session). Without it, a second order that overwrote the first confirmation would look like one confirmation.
* **Manual and exploratory testing** for the empty cart and the rapid double-click (required by the brief), plus a phone-width pass.

## 4. Test cases

### 4.1 Required automated checks (`tests/checkout.spec.js`)

| ID | Title | Steps | Expected result |
| -- | ----- | ----- | --------------- |
| **TC-01** | Successful checkout produces a confirmation | Add Tote, add Mug, enter name "Asha Verma", click Place order | Button turns disabled ("Placing order…"); then **one** "Order confirmed" section with reference matching `ORD-XXXXXXXX`, the name, the items "Canvas Tote Bag × 1 — ₹499.00" and "Ceramic Mug × 1 — ₹249.50", and total ₹748.50; form is gone; orders placed = 1 |
| **TC-02** | Missing name blocks checkout | Add Tote ×2, leave name blank, click Place order; then enter "   " (spaces) and retry; then enter a real name | Blank and whitespace-only names are both blocked with "Enter your full name to place the order." in the alert and under the field; field is marked invalid and focused; the spaces typed are kept; cart (qty 2, ₹998.00) is kept; no order placed. After entering a name the error clears and the order succeeds |
| **TC-03** | Quantity change updates the exact total | Add Tote and Mug; type 3 in Mug quantity; click + on Tote; click − on Mug | Mug line ₹748.50, total **₹1,247.50**, items 4 → Tote line ₹998.00, total **₹1,746.50** → Mug qty 2, line ₹499.00, total **₹1,497.00** |

### 4.2 Extra regression checks (`tests/regression.spec.js`)

| ID | Title | Expected result |
| -- | ----- | --------------- |
| TC-04 | Empty cart blocks checkout | "Your cart is empty. Add at least one item to place an order." shown and focused; entered name kept; no order; error clears once an item is added |
| TC-05 | Empty cart and blank name together | Both messages listed, in order |
| TC-06 | Double-click Place order | Button locked during processing; after processing exactly one confirmation, orders placed = 1, reference unchanged after extra time |
| TC-07 | Two clicks in the same JS tick, then Enter twice | Exactly one order |
| TC-08 | Cart locked during processing | Add / + / Remove disabled; confirmation total matches the cart at submit |
| TC-09 | Invalid quantities: `0`, `-1`, `1.5`, `11`, `abc`, empty | Inline error "Quantity must be a whole number from 1 to 10."; total keeps the last valid quantity; Place order blocked with "Fix the highlighted quantity…"; typed value kept; fixing it clears the error |
| TC-10 | Remove items | Totals update; empty state returns at ₹0.00 |
| TC-11 | Quantity limits | − disabled at 1; + disabled at 10; Add at 10 shows "You can order up to 10 of each item." |
| TC-12 | Start a new order | Clean state again: empty cart, ₹0.00, blank name, button enabled |
| TC-13 | Phone width 375 px (regression for D-01) | Line total and Remove fully visible; no sideways scrolling in the cart |

### 4.3 Manual tests

| ID | Title | Steps | Expected result |
| -- | ----- | ----- | --------------- |
| **M-01** | Empty cart | Open page fresh. Type a name. Click Place order without adding anything | Checkout blocked; clear message that the cart is empty; name still in the field; no confirmation |
| **M-02** | Rapid double-click | Add one item, enter a name, double-click Place order as fast as possible. Afterwards also try repeated fast clicks | Button switches to "Placing order…" and is disabled immediately; one confirmation with one reference; DevTools console `document.querySelector('#app').dataset.ordersPlaced` returns `"1"` |
| M-03 | Exploratory: phone width | DevTools device toolbar → 375 × 812. Add an item | All cart information visible without sideways scrolling |

## 5. Entry and exit criteria

* **Entry:** `npm install` and `npx playwright install chromium` done; `npm start` serves the page.
* **Exit:** all P1 and P2 cases pass; every defect found is either fixed with a regression test or written up as open with steps and evidence.

## 6. Environment

Windows 11, Node.js 24, Playwright 1.65 (Chromium). The page is plain HTML/CSS/ES modules with no build step, served by `server.js` on `http://127.0.0.1:4173`.
