# Mini Checkout + Browser Test Suite

Submission for the Fynd Hiring Hackathon, SDET Intern challenge: **"Mini Checkout and Browser Test Suite"**.

A single-page checkout with two synthetic products, plus a Playwright browser test suite, a test plan and the test results.

| What | Where |
| ---- | ----- |
| Checkout page (HTML/CSS/vanilla JS, no build step) | [`src/`](src) |
| Checkout rules (pure functions: totals, validation, reference) | [`src/cart.js`](src/cart.js) |
| Required browser checks (TC-01..03) | [`tests/checkout.spec.js`](tests/checkout.spec.js) |
| Extra regression checks (TC-04..13) | [`tests/regression.spec.js`](tests/regression.spec.js) |
| Test plan (risks, cases, manual tests) | [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) |
| Test results, manual findings, defect report | [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) |
| Screenshots used as evidence | [`docs/evidence/`](docs/evidence) |

## What the page does

* Two products: **Canvas Tote Bag ₹499.00** and **Ceramic Mug ₹249.50**.
* Add to cart, remove, change quantity with − / + or by typing (whole numbers 1–10). Line totals, item count and the order total update right away. Money is computed in integer paise, so there are no floating-point errors.
* One required field: **Full name**.
* **Place order** is blocked, with a clear message, when the cart is empty, the name is blank (or only spaces), or a quantity is invalid. Everything the customer entered stays in place.
* On success there's a short "Placing order…" step (simulated 800 ms), then one **Order confirmed** panel with a reference like `ORD-7KQ2M9XA`, the items and the total.
* Double submits are blocked: the button is disabled in the same click handler that starts the order, and a state guard (`idle → placing → confirmed`) ignores any further submits. The cart is also locked while the order is processing.

No backend, database, payments or external services. Nothing is stored, so every page load starts clean.

## Requirements

* Node.js 18 or newer (developed on Node 24)
* Internet access once, to download Playwright's Chromium

## Run the page

```powershell
npm install
```

```powershell
npm start
```

Open http://127.0.0.1:4173. The server is a ~40-line dependency-free script ([`server.js`](server.js)). Any static server pointed at `src/` also works. Opening `index.html` straight from disk does not, because browsers block ES modules on `file://`.

## Run the browser tests

One-time browser download:

```powershell
npx playwright install chromium
```

Run all checks (Playwright starts the server for you):

```powershell
npm test
```

Other options:

```powershell
npx playwright test tests/checkout.spec.js
```

```powershell
npm run test:headed
```

```powershell
npm run test:report
```

* The first runs only the three required checks. The second watches the tests run in a visible browser. The third opens the HTML report from the last run.
* On failure Playwright keeps a screenshot and a trace in `test-results/`. Open a trace with `npx playwright show-trace <path-to-trace.zip>`.
* `npm run evidence` regenerates the screenshots in `docs/evidence/`.

### How the tests stay reliable

* **Clean state:** every test gets a fresh browser context and first asserts the empty starting state.
* **Customer-visible assertions:** locators use roles and labels ("Add Ceramic Mug to cart", "Quantity for Ceramic Mug"), and assertions check the exact text the customer sees (`₹1,247.50`).
* **No fixed waits:** Playwright's auto-retrying `expect` waits for the UI. The double-submit tests use Playwright's fake clock to control the 800 ms processing step precisely.
* **Retries are off,** so a flaky check fails instead of being hidden.

## Manual tests

The steps for the two manual tests the brief asks for (empty cart, rapid double-click) are in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md#43-manual-tests). What happened is recorded in [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

## Project layout

```
src/
  index.html      page markup
  styles.css      plain styling, phone layout
  cart.js         products, money maths, validation, order reference
  app.js          DOM wiring, state machine, double-submit guard
server.js         static file server for src/
playwright.config.js
tests/
  support/checkout-page.js   small page object
  checkout.spec.js           TC-01..03 (required)
  regression.spec.js         TC-04..13
  evidence.spec.js           screenshot capture (npm run evidence)
docs/
  TEST_PLAN.md
  TEST_RESULTS.md
  evidence/
```
