/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user management
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import prisma from '../prismaClient.js';
import authMiddleware from '../middleware/auth.js';
import {
  emailRule,
  nameRule,
  passwordRule,
  optionalPasswordRule,
  handleValidationErrors,
} from '../validators/index.js';

const router = express.Router();

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      iss: process.env.JWT_ISSUER || 'ExtremeGearShop',
      aud: process.env.JWT_AUDIENCE || 'client',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     description: Use refresh token from httpOnly cookie to get a new access token
 *     responses:
 *       200:
 *         description: New access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *       401:
 *         description: Refresh token missing or invalid
 *       403:
 *         description: Account blocked
 *       404:
 *         description: User not found
 */
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token não encontrado' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, role: true, name: true, email: true, isBlocked: true }
    });

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (user.isBlocked) return res.status(403).json({ error: 'Conta bloqueada' });

    const newAccessToken = generateAccessToken(user);
    res.json({ token: newAccessToken });
  } catch (err) {
    console.error('Erro ao atualizar token:', err);
    res.status(401).json({ error: 'Refresh token inválido' });
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 *       500:
 *         description: Server error
 */
router.post('/register',
  nameRule(),
  emailRule(),
  passwordRule(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) return res.status(409).json({ error: 'Email já está em uso' });

      const hash = await bcrypt.hash(password, 12);                                                                                     //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      const newUser = await prisma.user.create({                                                                                     //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash: hash,
          role: 'CUSTOMER'
        },
      });

      const accessToken = generateAccessToken(newUser);
      const refreshToken = generateRefreshToken(newUser);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.status(201).json({
        token: accessToken,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      });
    } catch (e) {
      console.error('Erro ao registrar:', e);
      res.status(500).json({ error: 'Erro no servidor ao registrar' });
    }
  }
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: Invalid email or password
 *       403:
 *         description: Account blocked
 *       500:
 *         description: Server error
 */
router.post('/login',
  emailRule(),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const { password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {                                                                                     //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        return res.status(400).json({ error: 'Email ou senha inválidos' });
      }

      if (user.isBlocked) return res.status(403).json({ error: 'Sua conta está bloqueada' });

      const accessToken = generateAccessToken(user);                                                                                     //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      const refreshToken = generateRefreshToken(user);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        token: accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      });
    } catch (e) {
      console.error('Erro ao fazer login:', e);
      res.status(500).json({ error: 'Erro no servidor ao fazer login' });
    }
  }
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       500:
 *         description: Server error
 */
router.post('/logout', authMiddleware, (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Você saiu do sistema com sucesso' });
});

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               avatar: { type: string }
 *               password: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error or current password incorrect
 *       500:
 *         description: Server error
 */
router.put('/profile',
  authMiddleware,
  nameRule().optional(),
  optionalPasswordRule(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, avatar, password, newPassword } = req.body;
      const userId = req.user.id;
      const updates = {};

      if (name) updates.name = name.trim();
      if (avatar) updates.avatar = avatar;

      if (password && newPassword) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return res.status(400).json({ error: 'Senha atual incorreta' });

        updates.passwordHash = await bcrypt.hash(newPassword, 12);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: { id: true, name: true, email: true, role: true, avatar: true }
      });

      res.json({
        user: updatedUser,
        token: updates.passwordHash ? generateAccessToken(updatedUser) : undefined
      });
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
  }
);

/**
 * @swagger
 * /auth/profile:
 *   delete:
 *     summary: Delete user account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 *       500:
 *         description: Server error
 */
router.delete('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.user.delete({ where: { id: userId } });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ message: 'Sua conta foi excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir perfil:', err);
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

export default router;
