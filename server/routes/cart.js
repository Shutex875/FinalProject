import express from 'express';
import prisma from '../prismaClient.js';
import authenticate from '../middleware/auth.js';
import { assertQuantity, changeCart, commerceTransaction, CommerceError } from '../services/commerce.js';

const router = express.Router();

async function sendCart(res, userId) {
  const cart = await prisma.cartItem.findMany({ where: { userId }, include: { product: true } });
  res.json(cart.map(({ product, quantity }) => ({
    id: product.id, name: product.name, price: product.price, brand: product.brand,
    imageUrl: product.imageUrl, quantity, stock: product.stock
  })));
}

function handleError(res, error) {
  if (error instanceof CommerceError) return res.status(error.status).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: 'Failed to update cart' });
}

function productId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new CommerceError(400, 'Invalid product ID');
  }
  return id;
}

// Validate before authentication: malformed quantities must never reach the DB.
function validateQuantity(req, res, next) {
  try {
    assertQuantity(req.body?.quantity);
    productId(req.body?.productId);
    next();
  } catch (error) { handleError(res, error); }
}

router.get('/', authenticate, async (req, res) => {
  try { await sendCart(res, req.user.id); } catch (error) { handleError(res, error); }
});

for (const [method, route, add] of [['post', '/add', true], ['put', '/update', false]]) {
  router[method](route, validateQuantity, authenticate, async (req, res) => {
    try {
      const id = productId(req.body.productId);
      await commerceTransaction(prisma, req.user.id,
        tx => changeCart(tx, req.user.id, id, req.body.quantity, add));
      await sendCart(res, req.user.id);
    } catch (error) { handleError(res, error); }
  });
}

router.delete('/remove/:productId', authenticate, async (req, res) => {
  try {
    const id = productId(req.params.productId);
    await commerceTransaction(prisma, req.user.id,
      tx => tx.cartItem.deleteMany({ where: { userId: req.user.id, productId: id } }));
    await sendCart(res, req.user.id);
  } catch (error) { handleError(res, error); }
});

router.delete('/clear', authenticate, async (req, res) => {
  try {
    await commerceTransaction(prisma, req.user.id,
      tx => tx.cartItem.deleteMany({ where: { userId: req.user.id } }));
    res.json([]);
  } catch (error) { handleError(res, error); }
});

export default router;
