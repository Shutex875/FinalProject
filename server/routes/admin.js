/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations (requires ADMIN role)
 */

import express from 'express';
import multer from 'multer';
import prisma from '../prismaClient.js';
import auth from '../middleware/auth.js';
import checkRole from '../middleware/checkRole.js';
import { uploadToS3 } from '../utils/s3.js';
import {
  roleRule,
  isBlockedRule,
  userIdParamRule,
  searchQueryRule,
  pageQueryRule,
  limitQueryRule,
  handleValidationErrors,
} from '../validators/index.js';

const router = express.Router();

// Хранение файла в оперативной памяти перед отправкой в S3 (Stateless)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

router.use(auth);
router.use(checkRole(['ADMIN']));

// ==================== СТАТИСТИКА ====================
router.get('/stats', async (req, res) => {
  try {
    const [userCount, orderCount, productCount, latestOrders] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.product.count(),
      prisma.order.findMany({
        take: 7,
        orderBy: { createdAt: 'desc' },
        select: { total: true, createdAt: true },
      }),
    ]);
    const salesData = latestOrders.reverse().map((order) => ({
      name: new Date(order.createdAt).toLocaleDateString(),
      total: order.total,
    }));
    res.json({
      summary: [
        { title: 'Users', value: userCount },
        { title: 'Orders', value: orderCount },
        { title: 'Products', value: productCount },
      ],
      salesData: salesData.length > 0 ? salesData : [{ name: 'Jan', total: 0 }, { name: 'Feb', total: 0 }],
    });
  } catch (err) {
    console.error('🔥 Stats error:', err);
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

// ==================== КАТЕГОРИИ ====================
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) {
    console.error('🔥 Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// ==================== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ====================
router.get(
  '/users',
  searchQueryRule(),
  pageQueryRule(),
  limitQueryRule(),
  handleValidationErrors,
  async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;
    try {
      const whereClause = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          select: { id: true, name: true, email: true, role: true, isBlocked: true, createdAt: true },
          skip,
          take: limitInt,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where: whereClause }),
      ]);
      res.json({ data: users, pagination: { total, page: pageInt, limit: limitInt, totalPages: Math.ceil(total / limitInt) } });
    } catch (err) {
      console.error('🔥 Erro ao obter usuários:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

router.put(
  '/users/:id/role',
  userIdParamRule(),
  roleRule(),
  handleValidationErrors,
  async (req, res) => {
    const { role: newRole } = req.body;
    const { id } = req.params;
    try {
      const userId = parseInt(id);
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (targetUser.id === req.user.id && newRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Você não pode alterar sua própria função' });
      }
      await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
      res.json({ message: `Função do usuário ${targetUser.email} atualizada para ${newRole}` });
    } catch (err) {
      console.error('🔥 Erro ao atualizar função:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

router.put(
  '/users/:id/block',
  userIdParamRule(),
  isBlockedRule(),
  handleValidationErrors,
  async (req, res) => {
    const { isBlocked } = req.body;
    const { id } = req.params;
    try {
      const userId = parseInt(id);
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (targetUser.id === req.user.id) return res.status(403).json({ error: 'Você não pode bloquear a si mesmo' });
      await prisma.user.update({ where: { id: userId }, data: { isBlocked: !!isBlocked } });
      res.json({ message: `Usuário ${isBlocked ? 'bloqueado com sucesso' : 'desbloqueado com sucesso'}` });
    } catch (err) {
      console.error('🔥 Erro ao bloquear:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

router.delete(
  '/users/:id',
  userIdParamRule(),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    try {
      const userId = parseInt(id);
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (targetUser.id === req.user.id) return res.status(403).json({ error: 'Você não pode excluir a si mesmo' });
      await prisma.user.delete({ where: { id: userId } });
      res.json({ message: 'Usuário e dados relacionados excluídos com sucesso' });
    } catch (err) {
      console.error('🔥 Erro ao excluir usuário:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// ==================== УПРАВЛЕНИЕ ТОВАРАМИ ====================
router.get(
  '/products',
  pageQueryRule(),
  limitQueryRule(),
  handleValidationErrors,
  async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;
    try {
      const whereClause = search ? { OR: [{ name: { contains: search } }, { brand: { contains: search } }] } : {};
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: whereClause,
          select: { id: true, name: true, brand: true, price: true, stock: true, categoryId: true, imageUrl: true, description: true },
          skip,
          take: limitInt,
          orderBy: { id: 'asc' },
        }),
        prisma.product.count({ where: whereClause }),
      ]);
      res.json({ data: products, pagination: { total, page: pageInt, limit: limitInt, totalPages: Math.ceil(total / limitInt) } });
    } catch (err) {
      console.error('🔥 Erro ao obter produtos:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

router.put('/products/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  if (stock === undefined || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative number' });
  try {
    const productId = parseInt(id);
    const product = await prisma.product.update({ where: { id: productId }, data: { stock: stock }, select: { id: true, name: true, stock: true } });
    res.json({ message: `Stock for ${product.name} updated to ${product.stock}`, product });
  } catch (err) {
    console.error('🔥 Erro ao atualizar stock:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Создание товара
router.post('/products', async (req, res) => {
  try {
    const { name, brand, price, stock, categoryId, description, imageUrl } = req.body;
    if (!name || !price || !categoryId) {
      return res.status(400).json({ error: 'Name, price and category are required' });
    }
    const product = await prisma.product.create({
      data: {
        name,
        brand: brand || null,
        price: parseFloat(price),
        stock: stock ? parseInt(stock) : 0,
        categoryId: parseInt(categoryId),
        description: description || null,
        imageUrl: imageUrl || null,
      },
    });
    res.status(201).json(product);
  } catch (err) {
    console.error('🔥 Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Удаление товара
router.delete('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const productId = parseInt(id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await prisma.product.delete({ where: { id: productId } });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('🔥 Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Загрузка изображения в S3
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  try {
    const imageUrl = await uploadToS3(req.file, 'products');
    res.json({ imageUrl });
  } catch (err) {
    console.error('🔥 Error uploading image to S3:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ==================== УПРАВЛЕНИЕ ЗАКАЗАМИ ====================
const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

router.get(
  '/orders',
  pageQueryRule(),
  limitQueryRule(),
  handleValidationErrors,
  async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;
    try {
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: {},
          include: { user: { select: { id: true, name: true, email: true } }, items: { include: { product: { select: { id: true, name: true, price: true } } } } },
          skip,
          take: limitInt,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.order.count(),
      ]);
      res.json({ data: orders, pagination: { total, page: pageInt, limit: limitInt, totalPages: Math.ceil(total / limitInt) } });
    } catch (err) {
      console.error('🔥 Erro ao obter pedidos:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

router.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` });
  }
  try {
    const orderId = parseInt(id);
    const order = await prisma.order.update({ where: { id: orderId }, data: { status }, select: { id: true, status: true, user: { select: { email: true } } } });
    res.json({ message: `Order #${order.id} status updated to ${order.status}`, order });
  } catch (err) {
    console.error('🔥 Erro ao atualizar status do pedido:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const orderId = parseInt(id);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await prisma.order.delete({ where: { id: orderId } });
    res.json({ message: `Order #${orderId} deleted successfully` });
  } catch (err) {
    console.error('🔥 Erro ao deletar pedido:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;