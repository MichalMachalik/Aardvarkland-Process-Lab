import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { book, describeProduct, estimateBooking, parseRequest, products, requests,
  resolveSupport, reviewRequest, runAttempt, sendQuote } from '../src/core.js';

const fixture = name => readFileSync(new URL('../public/fixtures/' + name, import.meta.url), 'utf8');

test('email and CSV produce a quote with integer totals and reject malformed items', () => {
  const quote = parseRequest(fixture('request.eml'), fixture('items.csv'));
  assert.equal(quote.id, 'PO-DEMO-241');
  assert.equal(quote.items.length, 2);
  assert.equal(quote.total, 8660);
  assert.throws(() => parseRequest(fixture('request.eml'), fixture('items.csv') + '\nREG-DEMO-J;3'));
  assert.throws(() => parseRequest(fixture('request.eml'), 'kod;pocet\nREG-DEMO-J;0'));
});

test('CRM confirmation after an interrupted send preserves the original quote key', () => {
  const quote = parseRequest(fixture('request.eml'), fixture('items.csv'));
  assert.throws(() => sendQuote({}, quote, false));
  const pending = sendQuote({ approved: quote.id }, quote, true);
  const confirmed = sendQuote(pending, quote, false);
  assert.equal(pending.receipt.id, confirmed.receipt.id);
  assert.deepEqual(confirmed.events, ['pending', 'confirmed']);
  assert.equal(sendQuote(confirmed, quote, false), confirmed);
});

test('catalog proposals reject missing, inaccurate and invalid widths', () => {
  assert.equal(describeProduct(products[0], '420').errors.length, 1);
  assert.deepEqual(describeProduct(products[0], '').errors, []);
  assert.equal(describeProduct(products[1], '420').errors.length, 1);
  assert.equal(describeProduct(products[1], '-1').errors.length, 1);
  assert.deepEqual(describeProduct(products[1], '380').errors, []);
});

test('support needs every required source and cannot answer absent availability', () => {
  assert.equal(resolveSupport('price', ['CEN-01']).outcome, 'missing');
  assert.equal(resolveSupport('price', ['CEN-01', 'CEN-02']).outcome, 'verified');
  assert.match(resolveSupport('price', ['CEN-01', 'CEN-02']).answer, /3\s+850 Kč/);
  assert.equal(resolveSupport('weekend', ['CEN-03']).outcome, 'missing');
});

test('approval enforces role and documents with a return-and-approval audit trail', () => {
  const request = requests[0];
  assert.throws(() => reviewRequest({}, requests[2], 'coordinator', 'forward'));
  assert.throws(() => reviewRequest({}, request, 'reviewer', 'approve'));
  let state = reviewRequest({}, request, 'coordinator', 'forward');
  assert.throws(() => reviewRequest(state, request, 'coordinator', 'approve'));
  state = reviewRequest(state, request, 'reviewer', 'return');
  state = reviewRequest(state, request, 'coordinator', 'forward');
  state = reviewRequest(state, request, 'reviewer', 'approve');
  assert.deepEqual(state[request.id].entries.map(event => event.status), ['review', 'returned', 'review', 'approved']);
});

test('booking protects overlapping intervals, with idempotent confirmation and same-time different rooms', () => {
  const request = { slot: 'atelier', client: 'javor', hours: 4, equipment: true };
  assert.equal(estimateBooking(request).total, 7000);
  const created = book([], request);
  assert.equal(book(created.list, request).duplicate, true);
  assert.throws(() => book(created.list, { ...request, client: 'lipa' }), /překrývá/);
  assert.throws(() => book(created.list, { ...request, slot: 'studio' }), /překrývá/);
  assert.equal(book(created.list, { ...request, slot: 'hall' }).list.length, 2);
  assert.equal(book(book([], { ...request, hours: 3 }).list, { ...request, slot: 'studio' }).list.length, 2);
});

test('retry after provider outage keeps one run and stops after success', () => {
  const failed = runAttempt(null, false);
  const completed = runAttempt(failed, true);
  assert.equal(failed.id, completed.id);
  assert.deepEqual(completed.events.map(entry => entry.code), ['PROVIDER_UNAVAILABLE', 'PROVIDER_OK']);
  assert.equal(runAttempt(completed, true), completed);
});
