import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import prisma from './prismaClient.js';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import reviewRoutes from './routes/reviews.js';
import likesRoutes from './routes/likes.js';
import cartRoutes from './routes/cart.js';
import { setupSwagger } from './swagger.js';

dotenv.config();
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error("Ошибка авторизации");
  process.exit(1);
}
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());

app.use((req, res, next) => {
  req.io = io;
  next();
});

//const limiter = rateLimit({
//  windowMs: 15 * 60 * 1000,
//  max: 200
//});
//app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));

setupSwagger(app);

// ========== HEALTH CHECK ENDPOINT (para Render) ==========
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/cart', cartRoutes);

app.get('/api/healthcheck', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Extreme Gear Shop' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    }
  });
}

io.on('connection', (socket) => {
  console.log('🔌 Novo cliente conectado');
  socket.on('subscribeToProduct', (productId) => {
    socket.join(`product_${productId}`);
    console.log(`Usuário entrou na sala: product_${productId}`);
  });
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado');
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Banco de dados SQLite conectado');
    server.listen(PORT, () => {
      console.log('---');
      console.log(`🚀 EXTREME GEAR SHOP SERVER STARTED`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
      console.log(`🛠 Mode: Development (SQLite)`);
      console.log('---');
    });
  } catch (err) {
    console.error('❌ Falha na conexão com o banco de dados:', err);
    process.exit(1);
  }
}

start();
