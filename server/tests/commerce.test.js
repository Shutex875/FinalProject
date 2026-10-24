import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient.js';
import cartRouter from '../routes/cart.js';
import orderRouter from '../routes/orders.js';
import { assertQuantity, changeCart, checkout, commerceTransaction, deactivateUser } from '../services/commerce.js';

for (const quantity of [-1, 0, '1', 1.5, 100, null, undefined, true, {}, []]) {
  test(`reject invalid quantity ${JSON.stringify(quantity)}`, () => {
    assert.throws(() => assertQuantity(quantity), error => error.status === 400);
  });
}
test('accept quantity boundaries', () => {
  assert.doesNotThrow(() => assertQuantity(1));
  assert.doesNotThrow(() => assertQuantity(99));
});

function fixture({ price = '19.99', quantity = 3, stock = 10 } = {}) {
  const state = { stock, orders: [], cart: [{ productId: 7, quantity, product: { price } }] };
  const tx = {
    user: { findUnique: async () => ({ id: 1, isBlocked: false }) },
    cartItem: {
      findMany: async () => state.cart,
      deleteMany: async () => { state.cart = []; }
    },
    product: { updateMany: async ({ where, data }) => {
      assert.equal(where.id, 7);
      if (state.stock < where.stock.gte) return { count: 0 };
      state.stock -= data.stock.decrement;
      return { count: 1 };
    } },
    order: { create: async ({ data }) => {
      const order = { ...data, id: state.orders.length + 1, items: data.items.create };
      state.orders.push(order);
      return order;
    } }
  };
  return { tx, state };
}

test('checkout ignores forged items, price and total; uses decimal arithmetic and delivery', async () => {
  const { tx, state } = fixture();
  const order = await checkout(tx, 1, { address: 'A', phone: 'P', total: 0,
    items: [{ productId: 999, quantity: 99, price: 0.01 }] });
  assert.equal(order.total.toString(), '64.97');
  assert.equal(order.items[0].productId, 7);
  assert.equal(order.items[0].quantity, 3);
  assert.equal(order.items[0].price.toString(), '19.99');
  assert.equal(state.stock, 7);
  assert.deepEqual(state.cart, []);
});
test('delivery is free at the existing 200 threshold', async () => {
  const { tx } = fixture({ price: '100', quantity: 2 });
  assert.equal((await checkout(tx, 1, { address: 'A', phone: 'P' })).total.toString(), '200');
});
test('insufficient stock creates no order and leaves cart intact', async () => {
  const { tx, state } = fixture({ stock: 2 });
  await assert.rejects(checkout(tx, 1, {}), error => error.status === 409);
  assert.equal(state.orders.length, 0);
  assert.equal(state.cart.length, 1);
  assert.equal(state.stock, 2);
});
test('empty cart cannot be checked out', async () => {
  const { tx, state } = fixture();
  state.cart = [];
  await assert.rejects(checkout(tx, 1, {}), error => error.status === 400);
});
test('cart add checks cumulative maximum before writing', async () => {
  let writes = 0;
  const tx = { cartItem: { findUnique: async () => ({ quantity: 99 }), upsert: async () => writes++ } };
  await assert.rejects(changeCart(tx, 1, 7, 1, true), error => error.status === 400);
  assert.equal(writes, 0);
});
test('cart mutation checks availability without deducting inventory', async () => {
  let quantity;
  const tx = {
    cartItem: { findUnique: async () => ({ quantity: 1 }), upsert: async ({ update }) => { quantity = update.quantity; } },
    product: { findUnique: async () => ({ stock: 3 }) }
  };
  await changeCart(tx, 1, 7, 2, true);
  assert.equal(quantity, 3);
  await assert.rejects(changeCart(tx, 1, 7, 3, true), error => error.status === 409);
});
test('serialization failure retries the entire interactive transaction', async () => {
  let attempts = 0;
  const { tx } = fixture();
  const db = { $transaction: async (operation, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    if (++attempts < 3) throw Object.assign(new Error('conflict'), { code: 'P2034' });
    return operation(tx);
  } };
  assert.equal(await commerceTransaction(db, 1, async () => 'ok'), 'ok');
  assert.equal(attempts, 3);
});
test('blocked account is rejected inside the transaction before mutations', async () => {
  const db = { $transaction: operation => operation({ user: { findUnique: async () => ({ isBlocked: true }) } }) };
  await assert.rejects(commerceTransaction(db, 1, () => assert.fail('must not mutate')), error => error.status === 403);
});
test('deactivation keeps identity and orders, clears credentials and cart', async () => {
  const calls = [];
  const tx = {
    user: { update: async args => calls.push(args) },
    cartItem: { deleteMany: async () => calls.push('cart') },
    like: { deleteMany: async () => {} }, review: { deleteMany: async () => {} }
  };
  await deactivateUser(tx, 1, 'deleted-test@deleted.invalid');
  assert.equal(calls[0].where.id, 1);
  assert.equal(calls[0].data.isBlocked, true);
  assert.equal(calls[0].data.passwordHash, null);
  assert.equal(calls[0].data.name, null);
  assert.equal(calls[0].data.email, 'deleted-test@deleted.invalid');
  assert.equal(calls[1], 'cart');
});

test('HTTP: all invalid quantities return 400 before any authentication DB lookup', async t => {
  const original = prisma.user.findUnique;
  let lookups = 0;
  prisma.user.findUnique = async () => { lookups++; throw new Error('DB must not be called'); };
  t.after(() => { prisma.user.findUnique = original; });
  const app = express();
  app.use(express.json());
  app.use('/api/cart', cartRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api/cart`;
  for (const [method, path] of [['POST', '/add'], ['PUT', '/update']]) {
    for (const quantity of [-1, 0, '1', 1.5, 100, null, true, {}, []]) {
      const response = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 7, quantity }) });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, 'string');
    }
  }
  assert.equal(lookups, 0);
});

test('HTTP: legacy checkout payload remains accepted and forged amounts are ignored', async t => {
  const originalLookup = prisma.user.findUnique;
  const originalTransaction = prisma.$transaction;
  const { tx } = fixture();
  prisma.user.findUnique = async () => ({ id: 1, isBlocked: false, role: 'CUSTOMER' });
  prisma.$transaction = async operation => operation(tx);
  t.after(() => { prisma.user.findUnique = originalLookup; prisma.$transaction = originalTransaction; });
  const { default: jwt } = await import('jsonwebtoken');
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'local-test-only-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const app = express(); app.use(express.json()); app.use('/api/orders', orderRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ address: 'Street 1', phone: '123', total: 0, items: [{ productId: 999, quantity: 99, price: 0.01 }] })
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.total, '64.97');
  assert.equal(result.items[0].price, '19.99');
  assert.equal(result.items[0].productId, 7);
});
