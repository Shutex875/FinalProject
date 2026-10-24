import { Prisma } from '@prisma/client';

export class CommerceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Retry only serialization conflicts; aborted transactions have no committed effects.
export async function commerceTransaction(prisma, userId, operation) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.isBlocked) throw new CommerceError(403, 'Conta indisponível');
        return operation(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error.code !== 'P2034') throw error;
      if (attempt === 3) throw new CommerceError(409, 'Cart changed; please retry');
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

export function assertQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new CommerceError(400, 'Quantity must be an integer between 1 and 99');
  }
}

export async function changeCart(tx, userId, productId, quantity, add) {
  const key = { userId_productId: { userId, productId } };
  const existing = await tx.cartItem.findUnique({ where: key });
  if (!add && !existing) throw new CommerceError(404, 'Item not in cart');
  const nextQuantity = add ? (existing?.quantity || 0) + quantity : quantity;
  assertQuantity(nextQuantity);
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new CommerceError(404, 'Product not found');
  if (product.stock < nextQuantity) throw new CommerceError(409, 'Not enough stock');
  // Cart items are selections, not reservations. Checkout alone deducts stock.
  return tx.cartItem.upsert({
    where: key,
    create: { userId, productId, quantity: nextQuantity },
    update: { quantity: nextQuantity }
  });
}

export async function checkout(tx, userId, { address, phone, comment }) {
  const cart = await tx.cartItem.findMany({
    where: { userId }, include: { product: true }, orderBy: { productId: 'asc' }
  });
  if (!cart.length) throw new CommerceError(400, 'Cart is empty');
  let subtotal = new Prisma.Decimal(0);
  const items = [];
  for (const item of cart) {
    assertQuantity(item.quantity);
    const price = new Prisma.Decimal(item.product.price);
    if (!price.isFinite() || price.isNegative()) throw new CommerceError(409, 'Invalid product price');
    const result = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } }
    });
    if (result.count !== 1) throw new CommerceError(409, 'Not enough stock');
    subtotal = subtotal.plus(price.times(item.quantity));
    items.push({ productId: item.productId, quantity: item.quantity, price });
  }
  // Same delivery policy as CheckoutPage; all arithmetic remains decimal.
  const total = subtotal.plus(subtotal.lessThan(200) ? 5 : 0);
  const order = await tx.order.create({
    data: { userId, address, phone, comment: comment || null, total, status: 'PENDING', items: { create: items } },
    include: { items: true }
  });
  await tx.cartItem.deleteMany({ where: { userId } });
  return order;
}

export async function deactivateUser(tx, userId, anonymousEmail) {
  // Preserve financial history; existing isBlocked checks reject both token types.
  await tx.user.update({
    where: { id: userId },
    data: { email: anonymousEmail, passwordHash: null, name: null, avatar: null, isBlocked: true,
      role: 'CUSTOMER', language: 'en', theme: 'light' }
  });
  await tx.cartItem.deleteMany({ where: { userId } });
  await tx.like.deleteMany({ where: { userId } });
  await tx.review.deleteMany({ where: { authorId: userId } });
}
