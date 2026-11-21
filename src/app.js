import {
  PRODUCTS,
  MIN_QTY,
  MAX_QTY,
  MESSAGES,
  findProduct,
  formatINR,
  lineTotalPaise,
  orderTotalPaise,
  itemCount,
  parseQuantity,
  validateCheckout,
  makeOrderReference,
} from './cart.js';

// Simulated order-processing time. It makes the "Placing order…" state visible and gives a
// realistic window in which a customer could double-click Place order.
const PROCESSING_MS = 800;

const state = {
  /** @type {{id: string, qty: number}[]} in the order items were added */
  lines: [],
  /** product id -> raw text, for quantity boxes that currently hold an invalid value */
  invalidQty: new Map(),
  /** 'idle' | 'placing' | 'confirmed' */
  status: 'idle',
  /** which validation errors are currently shown (keys of validateCheckout's result) */
  shownErrors: new Set(),
  ordersPlaced: 0,
};

const $ = (sel) => document.querySelector(sel);
const el = {
  main: $('#app'),
  productsSection: $('#products'),
  cartSection: $('#cart'),
  checkoutSection: $('#checkout'),
  productList: $('[data-testid="product-list"]'),
  cartEmpty: $('[data-testid="cart-empty"]'),
  cartTable: $('[data-testid="cart-table"]'),
  cartLines: $('[data-testid="cart-lines"]'),
  cartNotice: $('[data-testid="cart-notice"]'),
  itemCount: $('[data-testid="item-count"]'),
  orderTotal: $('[data-testid="order-total"]'),
  form: $('#checkout-form'),
  nameInput: $('#customer-name'),
  nameError: $('[data-testid="name-error"]'),
  errorSummary: $('[data-testid="error-summary"]'),
  errorList: $('[data-testid="error-list"]'),
  placeOrder: $('[data-testid="place-order"]'),
  confirmation: $('[data-testid="confirmation"]'),
  confirmationName: $('[data-testid="confirmation-name"]'),
  orderReference: $('[data-testid="order-reference"]'),
  confirmationLines: $('[data-testid="confirmation-lines"]'),
  confirmationTotal: $('[data-testid="confirmation-total"]'),
  newOrder: $('[data-testid="new-order"]'),
};

/** product id -> references to that cart row's elements */
const rows = new Map();

// ---------- Products ----------

function renderProducts() {
  for (const product of PRODUCTS) {
    const li = document.createElement('li');
    li.className = 'product';
    li.dataset.testid = `product-${product.id}`;
    li.innerHTML = `
      <span class="product-name"></span>
      <span class="product-price"></span>
      <button type="button" class="add"></button>`;
    li.querySelector('.product-name').textContent = product.name;
    li.querySelector('.product-price').textContent = formatINR(product.pricePaise);
    const button = li.querySelector('.add');
    button.textContent = 'Add to cart';
    button.setAttribute('aria-label', `Add ${product.name} to cart`);
    button.addEventListener('click', () => addItem(product.id));
    el.productList.append(li);
  }
}

// ---------- Cart mutations ----------

function findLine(id) {
  return state.lines.find((line) => line.id === id);
}

function addItem(id) {
  if (state.status !== 'idle') return;
  const product = findProduct(id);
  const line = findLine(id);
  if (!line) {
    state.lines.push({ id, qty: 1 });
    rebuildCartRows();
    notice(`${product.name} added to cart.`);
  } else if (line.qty >= MAX_QTY) {
    notice(MESSAGES.maxReached);
  } else {
    setQuantity(id, line.qty + 1);
    notice(`${product.name} quantity is now ${line.qty}.`);
  }
  afterCartChange();
}

function setQuantity(id, qty) {
  const line = findLine(id);
  if (!line) return;
  line.qty = qty;
  state.invalidQty.delete(id);
  updateRow(id, { syncInput: true });
}

function removeItem(id) {
  if (state.status !== 'idle') return;
  const product = findProduct(id);
  state.lines = state.lines.filter((line) => line.id !== id);
  state.invalidQty.delete(id);
  rebuildCartRows();
  notice(`${product.name} removed from cart.`);
  afterCartChange();
}

function onQuantityTyped(id, raw) {
  const parsed = parseQuantity(raw);
  if (parsed.ok) {
    // Don't rewrite the box while the customer is typing (e.g. keep "03" as typed).
    findLine(id).qty = parsed.value;
    state.invalidQty.delete(id);
    updateRow(id, { syncInput: false });
  } else {
    // Keep the last valid quantity in the totals and flag the box until it is fixed.
    state.invalidQty.set(id, raw);
    updateRow(id, { syncInput: false });
  }
  afterCartChange();
}

function afterCartChange() {
  updateSummary();
  refreshShownErrors();
}

// ---------- Cart rendering ----------

function rebuildCartRows() {
  rows.clear();
  el.cartLines.replaceChildren();
  for (const line of state.lines) {
    const product = findProduct(line.id);
    const tr = document.createElement('tr');
    tr.dataset.testid = `cart-line-${product.id}`;
    tr.innerHTML = `
      <th scope="row" class="item-name"></th>
      <td class="num unit-price"></td>
      <td>
        <div class="qty">
          <button type="button" class="qty-btn minus">−</button>
          <input type="text" inputmode="numeric" class="qty-input" />
          <button type="button" class="qty-btn plus">+</button>
        </div>
        <p class="field-error qty-error" hidden></p>
      </td>
      <td class="num line-total"></td>
      <td><button type="button" class="link remove">Remove</button></td>`;

    const ref = {
      row: tr,
      input: tr.querySelector('.qty-input'),
      minus: tr.querySelector('.minus'),
      plus: tr.querySelector('.plus'),
      lineTotal: tr.querySelector('.line-total'),
      error: tr.querySelector('.qty-error'),
      remove: tr.querySelector('.remove'),
    };
    tr.querySelector('.item-name').textContent = product.name;
    tr.querySelector('.unit-price').textContent = formatINR(product.pricePaise);

    const errorId = `qty-error-${product.id}`;
    ref.error.id = errorId;
    ref.error.dataset.testid = `qty-error-${product.id}`;
    ref.input.setAttribute('aria-label', `Quantity for ${product.name}`);
    ref.input.setAttribute('aria-describedby', errorId);
    ref.input.dataset.testid = `qty-${product.id}`;
    ref.minus.setAttribute('aria-label', `Decrease quantity of ${product.name}`);
    ref.plus.setAttribute('aria-label', `Increase quantity of ${product.name}`);
    ref.remove.setAttribute('aria-label', `Remove ${product.name} from cart`);
    ref.lineTotal.dataset.testid = `line-total-${product.id}`;

    ref.minus.addEventListener('click', () => {
      const current = findLine(product.id).qty;
      if (current > MIN_QTY) setQuantity(product.id, current - 1);
      afterCartChange();
    });
    ref.plus.addEventListener('click', () => {
      const current = findLine(product.id).qty;
      if (current < MAX_QTY) setQuantity(product.id, current + 1);
      else notice(MESSAGES.maxReached);
      afterCartChange();
    });
    ref.input.addEventListener('input', () => onQuantityTyped(product.id, ref.input.value));
    ref.remove.addEventListener('click', () => removeItem(product.id));

    rows.set(product.id, ref);
    el.cartLines.append(tr);
    updateRow(product.id, { syncInput: true });
  }
  const empty = state.lines.length === 0;
  el.cartTable.hidden = empty;
  el.cartEmpty.hidden = !empty;
}

function updateRow(id, { syncInput }) {
  const ref = rows.get(id);
  const line = findLine(id);
  if (!ref || !line) return;
  const invalid = state.invalidQty.has(id);
  if (syncInput) ref.input.value = String(line.qty);
  ref.input.setAttribute('aria-invalid', String(invalid));
  ref.error.hidden = !invalid;
  ref.error.textContent = invalid ? MESSAGES.quantityInvalid : '';
  // While the box is invalid, the +/- buttons work from the last valid quantity.
  ref.minus.disabled = line.qty <= MIN_QTY;
  ref.plus.disabled = line.qty >= MAX_QTY;
  ref.lineTotal.textContent = formatINR(lineTotalPaise(id, line.qty));
}

function updateSummary() {
  el.itemCount.textContent = String(itemCount(state.lines));
  el.orderTotal.textContent = formatINR(orderTotalPaise(state.lines));
}

function notice(text) {
  el.cartNotice.textContent = text;
}

// ---------- Validation display ----------

function currentErrors() {
  return validateCheckout({
    lines: state.lines,
    name: el.nameInput.value,
    invalidQuantityIds: [...state.invalidQty.keys()],
  });
}

function showErrors(errors) {
  state.shownErrors = new Set(Object.keys(errors));
  el.errorList.replaceChildren();
  for (const key of ['cart', 'quantity', 'name']) {
    if (!errors[key]) continue;
    const li = document.createElement('li');
    li.dataset.testid = `error-${key}`;
    li.textContent = errors[key];
    el.errorList.append(li);
  }
  el.errorSummary.hidden = state.shownErrors.size === 0;

  const nameInvalid = Boolean(errors.name);
  el.nameInput.setAttribute('aria-invalid', String(nameInvalid));
  el.nameError.hidden = !nameInvalid;
  el.nameError.textContent = nameInvalid ? errors.name : '';
}

/** After an error is shown, clear it as soon as the customer fixes it (never add new ones). */
function refreshShownErrors() {
  if (state.shownErrors.size === 0) return;
  const now = currentErrors();
  const stillShown = {};
  for (const key of state.shownErrors) if (now[key]) stillShown[key] = now[key];
  showErrors(stillShown);
}

// ---------- Place order ----------

function placeOrder() {
  // Guard against double submits: a second click, Enter key repeat, or a click that lands
  // while the first order is still processing must not create a second order.
  if (state.status !== 'idle') return;

  const errors = currentErrors();
  showErrors(errors);
  if (Object.keys(errors).length > 0) {
    if (Object.keys(errors).length === 1 && errors.name) el.nameInput.focus();
    else el.errorSummary.focus();
    return;
  }

  state.status = 'placing';
  const order = {
    reference: makeOrderReference(),
    name: el.nameInput.value.trim(),
    lines: state.lines.map((line) => ({ ...line })),
    totalPaise: orderTotalPaise(state.lines),
  };
  setLocked(true);
  el.placeOrder.textContent = 'Placing order…';
  el.form.setAttribute('aria-busy', 'true');

  setTimeout(() => showConfirmation(order), PROCESSING_MS);
}

function setLocked(locked) {
  el.placeOrder.disabled = locked;
  el.nameInput.readOnly = locked;
  for (const button of document.querySelectorAll('#products button, #cart button')) {
    button.disabled = locked;
  }
  for (const input of document.querySelectorAll('.qty-input')) input.readOnly = locked;
  if (!locked) for (const id of rows.keys()) updateRow(id, { syncInput: false });
}

function showConfirmation(order) {
  state.status = 'confirmed';
  // Observable count of orders placed in this page session; lets tests prove that a
  // double-click produced exactly one order, not one order shown twice.
  state.ordersPlaced += 1;
  el.main.dataset.ordersPlaced = String(state.ordersPlaced);
  el.confirmationName.textContent = order.name;
  el.orderReference.textContent = order.reference;
  el.confirmationLines.replaceChildren();
  for (const line of order.lines) {
    const product = findProduct(line.id);
    const li = document.createElement('li');
    li.textContent = `${product.name} × ${line.qty} — ${formatINR(lineTotalPaise(line.id, line.qty))}`;
    el.confirmationLines.append(li);
  }
  el.confirmationTotal.textContent = formatINR(order.totalPaise);

  el.productsSection.hidden = true;
  el.cartSection.hidden = true;
  el.checkoutSection.hidden = true;
  el.confirmation.hidden = false;
  el.confirmation.focus();
}

function startNewOrder() {
  state.lines = [];
  state.invalidQty.clear();
  state.status = 'idle';
  el.nameInput.value = '';
  showErrors({});
  notice('');
  rebuildCartRows();
  updateSummary();
  setLocked(false);
  el.placeOrder.textContent = 'Place order';
  el.form.removeAttribute('aria-busy');

  el.confirmation.hidden = true;
  el.productsSection.hidden = false;
  el.cartSection.hidden = false;
  el.checkoutSection.hidden = false;
  el.productList.querySelector('button')?.focus();
}

// ---------- Wire up ----------

el.errorSummary.tabIndex = -1;
el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  placeOrder();
});
el.nameInput.addEventListener('input', refreshShownErrors);
el.newOrder.addEventListener('click', startNewOrder);

renderProducts();
rebuildCartRows();
updateSummary();
el.main.dataset.ordersPlaced = '0';
el.main.dataset.ready = 'true';
