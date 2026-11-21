// Pure checkout logic: no DOM access, so every rule here is easy to reason about.
// Money is stored as integer paise (1 INR = 100 paise) to avoid floating-point drift.

export const PRODUCTS = Object.freeze([
  Object.freeze({ id: 'tote', name: 'Canvas Tote Bag', pricePaise: 49900 }), // ₹499.00
  Object.freeze({ id: 'mug', name: 'Ceramic Mug', pricePaise: 24950 }), // ₹249.50
]);

export const MIN_QTY = 1;
export const MAX_QTY = 10;

export const MESSAGES = Object.freeze({
  emptyCart: 'Your cart is empty. Add at least one item to place an order.',
  nameRequired: 'Enter your full name to place the order.',
  quantityInvalid: `Quantity must be a whole number from ${MIN_QTY} to ${MAX_QTY}.`,
  quantityFix: 'Fix the highlighted quantity before placing your order.',
  maxReached: `You can order up to ${MAX_QTY} of each item.`,
});

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export function findProduct(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

export function formatINR(paise) {
  return inr.format(paise / 100);
}

export function lineTotalPaise(productId, qty) {
  return findProduct(productId).pricePaise * qty;
}

/** @param {{id: string, qty: number}[]} lines */
export function orderTotalPaise(lines) {
  return lines.reduce((sum, line) => sum + lineTotalPaise(line.id, line.qty), 0);
}

export function itemCount(lines) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

/**
 * Parse what the customer typed in a quantity box.
 * Accepts only whole numbers within [MIN_QTY, MAX_QTY]; everything else is an error
 * (empty, 0, negatives, decimals, exponents like "1e1", text).
 */
export function parseQuantity(raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: MESSAGES.quantityInvalid };
  const value = Number(text);
  if (value < MIN_QTY || value > MAX_QTY) return { ok: false, error: MESSAGES.quantityInvalid };
  return { ok: true, value };
}

/**
 * @param {{lines: {id: string, qty: number}[], name: string, invalidQuantityIds: string[]}} input
 * @returns {{cart?: string, name?: string, quantity?: string}} empty object when valid
 */
export function validateCheckout({ lines, name, invalidQuantityIds = [] }) {
  const errors = {};
  if (lines.length === 0) errors.cart = MESSAGES.emptyCart;
  if (invalidQuantityIds.length > 0) errors.quantity = MESSAGES.quantityFix;
  if (String(name ?? '').trim() === '') errors.name = MESSAGES.nameRequired;
  return errors;
}

// No 0/O/1/I to keep references easy to read out over the phone.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeOrderReference(randomValues = crypto.getRandomValues(new Uint8Array(8))) {
  let ref = 'ORD-';
  for (const byte of randomValues) ref += REF_ALPHABET[byte % REF_ALPHABET.length];
  return ref;
}
