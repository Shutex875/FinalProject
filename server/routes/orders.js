/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management
 */

import express from 'express';
import prisma from '../prismaClient.js';
import authenticate from '../middleware/auth.js';
import { checkout, commerceTransaction, CommerceError } from '../services/commerce.js';
import {
  addressRule,
  phoneRule,
  commentRule,
  handleValidationErrors,
} from '../validators/index.js';

const router = express.Router();

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create an order from the user cart (request items and total are ignored)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, phone]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: integer }
 *                     quantity: { type: integer, minimum: 1 }
 *                     price: { type: number }
 *               total: { type: number }
 *               address: { type: string }
 *               phone: { type: string }
 *               comment: { type: string }
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error (empty cart, missing address/phone)
 *       500:
 *         description: Server error
 */
router.post('/',
  authenticate,
  addressRule(),
  phoneRule(),
  commentRule(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { address, phone, comment } = req.body;
      const newOrder = await commerceTransaction(prisma, req.user.id,
        tx => checkout(tx, req.user.id, { address, phone, comment }));

      res.status(201).json(newOrder);
    } catch (error) {
      if (error instanceof CommerceError) return res.status(error.status).json({ error: error.message });
      console.error('🔥 Erro ao criar pedido:', error);
      res.status(500).json({ error: 'Não foi possível finalizar o pedido' });
    }
  }
);

/**
 * @swagger
 * /orders/my:
 *   get:
 *     summary: Get current user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *                   total: { type: number }
 *                   status: { type: string }
 *                   address: { type: string }
 *                   phone: { type: string }
 *                   comment: { type: string }
 *                   createdAt: { type: string, format: date-time }
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         quantity: { type: integer }
 *                         price: { type: number }
 *                         product: { type: object }
 *       500:
 *         description: Server error
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter pedidos' });
  }
});

export default router;
