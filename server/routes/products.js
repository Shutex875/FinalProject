/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product catalog management
 */

 import express from 'express';
 import { PrismaClient } from '@prisma/client';

 const router = express.Router();
 const prisma = new PrismaClient();

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get list of products with filtering, sorting and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or brand
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Category name
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *         description: Brand name
 *       - in: query
 *         name: categoryId
 *         schema: { type: integer }
 *         description: Category ID
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *         description: Maximum price
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [newest, price_asc, price_desc] }
 *         description: Sort order
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of products with pagination metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       description: { type: string }
 *                       price: { type: number }
 *                       stock: { type: integer }
 *                       imageUrl: { type: string }
 *                       brand: { type: string }
 *                       color: { type: string }
 *                       categoryId: { type: integer }
 *                       category: { type: object }
 *                       createdAt: { type: string, format: date-time }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *                 totalPages: { type: integer }
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { search, category, brand, categoryId, minPrice, maxPrice, sortBy, page = 1, limit = 12 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {};                                                                                   //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { brand: { contains: search } }
      ];
    }

    if (category) where.category = { name: category };
    if (categoryId) where.categoryId = Number(categoryId);
    if (brand) where.brand = brand;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = Number(minPrice);
      if (maxPrice !== undefined) where.price.lte = Number(maxPrice);
    }

    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { price: 'asc' };
    if (sortBy === 'price_desc') orderBy = { price: 'desc' };
    if (sortBy === 'newest') orderBy = { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('🔥 Erro ao obter produtos:', error);
    res.status(500).json({ error: 'Erro ao obter lista de produtos' });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details with category and reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 name: { type: string }
 *                 description: { type: string }
 *                 price: { type: number }
 *                 stock: { type: integer }
 *                 imageUrl: { type: string }
 *                 brand: { type: string }
 *                 color: { type: string }
 *                 categoryId: { type: integer }
 *                 category: { type: object }
 *                 reviews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       text: { type: string }
 *                       rating: { type: integer }
 *                       createdAt: { type: string, format: date-time }
 *                       author:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           avatar: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *       400:
 *         description: Invalid product ID
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'ID do produto inválido' });
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        reviews: {
          include: { author: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(product);
  } catch (error) {
    console.error('🔥 Erro no servidor ao obter produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
