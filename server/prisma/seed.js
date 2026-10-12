import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Banco de dados limpo...');

  // Администратор
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is required!");
  }
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      email: 'admin@shop.com',
      name: 'Alex Admin',
      role: 'ADMIN',
      isBlocked: false,
      passwordHash: hashedPassword,
    },
  });
  console.log('👤 Administrador criado');

  // Категории (id фиксированы)
  const categories = [
    { id: 1, name: 'Skateboards' },
    { id: 2, name: 'Footwear' },
    { id: 3, name: 'Hardware' },
    { id: 4, name: 'Apparel' },
    { id: 5, name: 'Longboards' },
    { id: 6, name: 'Accessories' },
  ];
  for (const cat of categories) {
    await prisma.category.create({ data: cat });
  }
  console.log('📁 Categorias criadas');

  // Оригинальные 5 товаров (сохранены)
  const products = [
    {
      name: 'Vans Skate Old Skool',
      brand: 'Vans',
      description: 'Classic skate shoes with reinforced materials.',
      price: 74.99,
      stock: 12,
      imageUrl: '/images/vans-skate-old-skool-shoes.jpg',
      categoryId: 2,
      color: 'Black'
    },
    {
      name: 'Globe G1 Ablaze 7.75"',
      brand: 'Globe',
      description: 'Full complete skateboard for beginners and pros.',
      price: 105.00,
      stock: 8,
      imageUrl: '/images/globe-g1-ablaze-775-skateboard-complete.jpg',
      categoryId: 1,
      color: 'Graphic'
    },
    {
      name: 'Thunder Polished 161',
      brand: 'Thunder',
      description: 'Durable trucks for wide decks.',
      price: 32.99,
      stock: 20,
      imageUrl: '/images/thunder-polished-161-skateboard-truck.jpg',
      categoryId: 3,
      color: 'Silver'
    },
    {
      name: 'Loaded Dervish Sama',
      brand: 'Loaded',
      description: 'Flexible longboard for carving and pumping.',
      price: 314.99,
      stock: 5,
      imageUrl: '/images/loaded-dervish-sama-longboard.jpg',
      categoryId: 5,
      color: 'Bamboo'
    },
    {
      name: 'Triple 8 Saver Series Pad Set',
      brand: 'Triple 8',
      description: 'Knee and elbow pads for protection.',
      price: 39.99,
      stock: 15,
      imageUrl: '/images/triple8-pad-set.jpg',
      categoryId: 6,
      color: 'Black'
    },
    // ----- НОВЫЕ ТОВАРЫ (более 95 штук, всего >100) -----
    // Skateboards
    {
      name: 'SKATE ELEMENT SECTION 7.75',
      brand: 'Element',
      description: 'Durable maple deck with Element trucks and wheels.',
      price: 89.95,
      stock: 10,
      imageUrl: '/images/SKATE-ELEMENT-SECTION-7-75.jpg',
      categoryId: 1,
      color: 'Multi'
    },
    {
      name: 'Almost Impact Light Deck',
      brand: 'Almost',
      description: 'Ultra-lightweight skateboard deck.',
      price: 59.99,
      stock: 7,
      imageUrl: '/images/Almost-Impact-Light-Deck.webp',
      categoryId: 1,
      color: 'Black'
    },
    {
      name: 'Zero Cold World Deck',
      brand: 'Zero',
      description: 'Iconic skull graphic deck.',
      price: 64.99,
      stock: 6,
      imageUrl: '/images/Zero-Cold-World-Deck.webp',
      categoryId: 1,
      color: 'Black/White'
    },
    {
      name: 'Baker Logo Deck',
      brand: 'Baker',
      description: 'Classic Baker skateboards deck.',
      price: 62.99,
      stock: 9,
      imageUrl: '/images/Baker-Logo-Deck.webp',
      categoryId: 1,
      color: 'Red'
    },
    {
      name: 'Deathwish Deck',
      brand: 'Deathwish',
      description: 'Pro model from Deathwish.',
      price: 65.99,
      stock: 5,
      imageUrl: '/images/Deathwish-Deck.webp',
      categoryId: 1,
      color: 'Purple'
    },
    {
      name: 'Anti-Hero Eagle Deck',
      brand: 'Anti-Hero',
      description: 'Classic eagle graphic.',
      price: 67.99,
      stock: 8,
      imageUrl: '/images/Anti-Hero-Eagle-Deck.webp',
      categoryId: 1,
      color: 'Yellow'
    },
    {
      name: 'Real Issey Deck',
      brand: 'Real',
      description: 'Real skateboards team model.',
      price: 63.99,
      stock: 10,
      imageUrl: '/images/Real-Issey-Deck.jpg',
      categoryId: 1,
      color: 'Blue'
    },
    {
      name: 'Krooked Deck',
      brand: 'Krooked',
      description: 'Krooked skateboards classic shape.',
      price: 61.99,
      stock: 7,
      imageUrl: '/images/Krooked-Deck.webp',
      categoryId: 1,
      color: 'Green'
    },
    {
      name: 'Flip Skateboard Deck',
      brand: 'Flip',
      description: 'Flip skateboards pro deck.',
      price: 66.99,
      stock: 9,
      imageUrl: '/images/Flip-Skateboard-Deck.webp',
      categoryId: 1,
      color: 'Multi'
    },
    {
      name: 'Plan B Deck',
      brand: 'Plan B',
      description: 'Plan B skateboards team deck.',
      price: 68.99,
      stock: 6,
      imageUrl: '/images/Plan-B-Deck.webp',
      categoryId: 1,
      color: 'White'
    },
    {
      name: 'Girl Skateboards Deck',
      brand: 'Girl',
      description: 'Girl skateboards iconic design.',
      price: 64.99,
      stock: 8,
      imageUrl: '/images/Girl-Skateboards-Deck.webp',
      categoryId: 1,
      color: 'Pink'
    },
    {
      name: 'Chocolate Deck',
      brand: 'Chocolate',
      description: 'Chocolate skateboards deck.',
      price: 64.99,
      stock: 7,
      imageUrl: '/images/Chocolate-Deck.webp',
      categoryId: 1,
      color: 'Brown'
    },
    {
      name: 'Birdhouse Tony Hawk Deck',
      brand: 'Birdhouse',
      description: 'Tony Hawk pro model.',
      price: 69.99,
      stock: 5,
      imageUrl: '/images/Birdhouse-Tony-Hawk-Deck.webp',
      categoryId: 1,
      color: 'Multi'
    },
    {
      name: 'Powell Peralta Ripper Deck',
      brand: 'Powell-Peralta',
      description: 'Classic Ripper graphic.',
      price: 72.99,
      stock: 4,
      imageUrl: '/images/Powell-Peralta-Ripper-Deck.webp',
      categoryId: 1,
      color: 'Red'
    },
    {
      name: 'Santa Cruz Screaming Hand Deck',
      brand: 'Santa Cruz',
      description: 'Iconic screaming hand graphic.',
      price: 71.99,
      stock: 6,
      imageUrl: '/images/Santa-Cruz-Screaming-Hand-Deck.webp',
      categoryId: 1,
      color: 'Black'
    },
    {
      name: 'Creature Deck',
      brand: 'Creature',
      description: 'Creature skateboards tough construction.',
      price: 63.99,
      stock: 7,
      imageUrl: '/images/Creature-Deck.webp',
      categoryId: 1,
      color: 'Green'
    },
    {
      name: 'Welcome Deck',
      brand: 'Welcome',
      description: 'Welcome skateboards unique shapes.',
      price: 99.99,
      stock: 5,
      imageUrl: '/images/Welcome-Deck.webp',
      categoryId: 1,
      color: 'Blue'
    },
    // Longboards
    {
      name: 'Arbor Axis Longboard',
      brand: 'Arbor',
      description: 'Drop-through bamboo longboard for cruising.',
      price: 199.99,
      stock: 4,
      imageUrl: '/images/Arbor-Axis-Longboard.webp',
      categoryId: 5,
      color: 'Natural'
    },
    {
      name: 'Landyachtz Dinghy',
      brand: 'Landyachtz',
      description: 'Mini cruiser, easy to carry.',
      price: 159.99,
      stock: 6,
      imageUrl: '/images/Landyachtz-Dinghy.webp',
      categoryId: 5,
      color: 'Turquoise'
    },
    {
      name: 'Rayne Whip Deck',
      brand: 'Rayne',
      description: 'Lightweight bamboo/fiberglass construction.',
      price: 259.99,
      stock: 3,
      imageUrl: '/images/Rayne-Whip-Deck.webp',
      categoryId: 5,
      color: 'Black'
    },
    {
      name: 'Original Apex 40',
      brand: 'Original',
      description: 'Precision truck system for carving.',
      price: 299.99,
      stock: 2,
      imageUrl: '/images/Original-Apex-40.jpeg',
      categoryId: 5,
      color: 'Carbon'
    },
    {
      name: 'Sector 9 Bamboo Lookout',
      brand: 'Sector 9',
      description: 'Bamboo drop-through complete.',
      price: 189.99,
      stock: 5,
      imageUrl: '/images/Sector-9-Bamboo-Lookout.jpeg',
      categoryId: 5,
      color: 'Natural'
    },
    // Footwear
    {
      name: 'Nike SB Dunk Low Pro',
      brand: 'Nike SB',
      description: 'Professional skate shoe with Zoom Air.',
      price: 110.00,
      stock: 8,
      imageUrl: '/images/Nike-SB-Dunk-Low-Pro.avif',
      categoryId: 2,
      color: 'Black/White'
    },
    {
      name: 'Adidas Busenitz',
      brand: 'Adidas',
      description: 'Pro model skate shoe by Dennis Busenitz.',
      price: 85.00,
      stock: 10,
      imageUrl: '/images/Adidas-Busenitz.avif',
      categoryId: 2,
      color: 'Black'
    },
    {
      name: 'Emerica Wino G6',
      brand: 'Emerica',
      description: 'Andrew Reynolds pro shoe.',
      price: 79.99,
      stock: 7,
      imageUrl: '/images/Emerica-Wino-G6.jpeg',
      categoryId: 2,
      color: 'Brown'
    },
    {
      name: 'Lakai Griffin',
      brand: 'Lakai',
      description: 'Classic cupsole skate shoe.',
      price: 69.99,
      stock: 9,
      imageUrl: '/images/Lakai-Griffin.jpeg',
      categoryId: 2,
      color: 'Grey'
    },
    {
      name: 'New Balance Numeric 1010',
      brand: 'New Balance',
      description: 'Tiago Lemos pro model.',
      price: 120.00,
      stock: 6,
      imageUrl: '/images/New-Balance-Numeric-1010.webp',
      categoryId: 2,
      color: 'White'
    },
    {
      name: 'DC Manual',
      brand: 'DC',
      description: 'Durable skate shoe with impact protection.',
      price: 65.00,
      stock: 12,
      imageUrl: '/images/DC-Manual.jpg',
      categoryId: 2,
      color: 'Black/Red'
    },
    {
      name: 'Etnies Marana',
      brand: 'Etnies',
      description: 'Michelin rubber outsole for durability.',
      price: 70.00,
      stock: 8,
      imageUrl: '/images/Etnies-Marana.webp',
      categoryId: 2,
      color: 'Black'
    },
    {
      name: 'Es Accel OG',
      brand: 'és',
      description: 'Classic fat skate shoe.',
      price: 89.99,
      stock: 5,
      imageUrl: '/images/Es-Accel-OG.jpeg',
      categoryId: 2,
      color: 'White'
    },
    {
      name: 'Cariuma Catiba Pro',
      brand: 'Cariuma',
      description: 'Sustainable skate shoe with memory foam.',
      price: 99.00,
      stock: 7,
      imageUrl: '/images/Cariuma-Catiba-Pro.jpeg',
      categoryId: 2,
      color: 'Olive'
    },
    // Hardware & Parts
    {
      name: 'Independent Stage 11 149',
      brand: 'Independent',
      description: 'Standard trucks for 8.25" boards.',
      price: 54.99,
      stock: 15,
      imageUrl: '/images/Independent-Stage-11-149.jpeg',
      categoryId: 3,
      color: 'Silver'
    },
    {
      name: 'Venture Lo Trucks',
      brand: 'Venture',
      description: 'Low profile trucks for street skating.',
      price: 49.99,
      stock: 12,
      imageUrl: '/images/Venture-Lo-Trucks.webp',
      categoryId: 3,
      color: 'Raw'
    },
    {
      name: 'Ace Classic 44',
      brand: 'Ace',
      description: 'Turny trucks for carving.',
      price: 52.99,
      stock: 10,
      imageUrl: '/images/Ace-Classic-44.jpg',
      categoryId: 3,
      color: 'Silver'
    },
    {
      name: 'Krux K5 Trucks',
      brand: 'Krux',
      description: 'Lightweight and durable.',
      price: 47.99,
      stock: 13,
      imageUrl: '/images/Krux-K5-Trucks.webp',
      categoryId: 3,
      color: 'Black'
    },
    {
      name: 'Tensor Mag Light',
      brand: 'Tensor',
      description: 'Magnesium alloy trucks, super light.',
      price: 59.99,
      stock: 9,
      imageUrl: '/images/Tensor-Mag-Light.webp',
      categoryId: 3,
      color: 'White'
    },
    {
      name: 'Bones STF V5 Wheels',
      brand: 'Bones',
      description: 'Street Tech Formula wheels 52mm.',
      price: 34.99,
      stock: 25,
      imageUrl: '/images/Bones-STF-V5-Wheels.webp',
      categoryId: 3,
      color: 'White'
    },
    {
      name: 'Spitfire Formula Four 54mm',
      brand: 'Spitfire',
      description: 'High rebound urethane.',
      price: 36.99,
      stock: 20,
      imageUrl: '/images/Spitfire-Formula-Four-54mm.webp',
      categoryId: 3,
      color: 'Black'
    },
    {
      name: 'OJ Wheels Super Juice 60mm',
      brand: 'OJ',
      description: 'Soft cruiser wheels.',
      price: 39.99,
      stock: 14,
      imageUrl: '/images/OJ-Wheels-Super-Juice-60mm.webp',
      categoryId: 3,
      color: 'Yellow'
    },
    {
      name: 'Ricta Clouds 78a',
      brand: 'Ricta',
      description: 'Soft cruiser wheels for rough ground.',
      price: 33.99,
      stock: 18,
      imageUrl: '/images/Ricta-Clouds-78a.webp',
      categoryId: 3,
      color: 'White'
    },
    {
      name: 'Bronson G3 Bearings',
      brand: 'Bronson',
      description: 'High speed bearings.',
      price: 29.99,
      stock: 30,
      imageUrl: '/images/Bronson-G3-Bearings.jpg',
      categoryId: 3,
      color: 'Silver'
    },
    {
      name: 'Bones Reds Bearings',
      brand: 'Bones',
      description: 'Standard high-quality bearings.',
      price: 19.99,
      stock: 40,
      imageUrl: '/images/Bones-Reds-Bearings.webp',
      categoryId: 3,
      color: 'Red'
    },
    {
      name: 'Zealous Bearings',
      brand: 'Zealous',
      description: 'Built-in spacers, no maintenance.',
      price: 24.99,
      stock: 25,
      imageUrl: '/images/Zealous-Bearings.webp',
      categoryId: 3,
      color: 'Green'
    },
    // Apparel
    {
      name: 'Thrasher Hoodie',
      brand: 'Thrasher',
      description: 'Classic flame hoodie.',
      price: 69.99,
      stock: 20,
      imageUrl: '/images/Thrasher-Hoodie.webp',
      categoryId: 4,
      color: 'Black'
    },
    {
      name: 'Vans Hoodie',
      brand: 'Vans',
      description: 'Classic flame hoodie.',
      price: 89.99,
      stock: 20,
      imageUrl: '/images/Vans-Hoodie.jpeg',
      categoryId: 4,
      color: 'Black'
    },
    {
      name: 'adidas Hoodie',
      brand: 'Thrasher',
      description: 'Classic flame hoodie.',
      price: 69.99,
      stock: 20,
      imageUrl: '/images/adidas-Hoodie.webp',
      categoryId: 4,
      color: 'Black'
    },
    {
      name: 'Supreme Box Logo Tee',
      brand: 'Supreme',
      description: 'Iconic box logo t-shirt.',
      price: 128.00,
      stock: 5,
      imageUrl: '/images/Supreme-Box-Logo-Tee.webp',
      categoryId: 4,
      color: 'Red'
    },
    {
      name: 'Independent Trucker Hat',
      brand: 'Independent',
      description: 'Foam trucker hat with embroidered logo.',
      price: 25.99,
      stock: 30,
      imageUrl: '/images/Independent-Trucker-Hat.webp',
      categoryId: 4,
      color: 'Black'
    },
    {
      name: 'Nike SB Beanie',
      brand: 'Nike SB',
      description: 'Cuffed knit beanie.',
      price: 29.99,
      stock: 18,
      imageUrl: '/images/Nike-SB-Beanie.jpg',
      categoryId: 4,
      color: 'Black'
    },
    {
      name: 'Vans Checkerboard Socks',
      brand: 'Vans',
      description: 'Classic checkerboard crew socks.',
      price: 12.99,
      stock: 50,
      imageUrl: '/images/Vans-Checkerboard-Socks.jpg',
      categoryId: 4,
      color: 'Black/White'
    },
    {
      name: 'Spitfire Tee',
      brand: 'Spitfire',
      description: 'Graphic t-shirt.',
      price: 29.99,
      stock: 22,
      imageUrl: '/images/Spitfire-Tee.jpeg',
      categoryId: 4,
      color: 'White'
    },
    // Accessories
    {
      name: 'Pro-Tec Classic Helmet',
      brand: 'Pro-Tec',
      description: 'Certified skate helmet.',
      price: 59.99,
      stock: 12,
      imageUrl: '/images/Pro-Tec-Classic-Helmet.webp',
      categoryId: 6,
      color: 'Matte Black'
    },
    {
      name: '187 Killer Pads Knee Pads',
      brand: '187',
      description: 'Pro knee pads.',
      price: 49.99,
      stock: 10,
      imageUrl: '/images/187-Killer-Pads-Knee-Pads.webp',
      categoryId: 6,
      color: 'Black'
    },
    {
      name: 'Grizzly Griptape',
      brand: 'Grizzly',
      description: 'High quality griptape with logo.',
      price: 14.99,
      stock: 60,
      imageUrl: '/images/Grizzly-Griptape.jpg',
      categoryId: 6,
      color: 'Black'
    },
    {
      name: 'Mob Grip Tape',
      brand: 'Mob',
      description: 'Super coarse griptape.',
      price: 12.99,
      stock: 45,
      imageUrl: '/images/Mob-Grip-Tape.webp',
      categoryId: 6,
      color: 'Black'
    },
    {
      name: 'Jessup Griptape',
      brand: 'Jessup',
      description: 'Standard griptape.',
      price: 9.99,
      stock: 70,
      imageUrl: '/images/Jessup-Griptape.webp',
      categoryId: 6,
      color: 'Black'
    },
    {
      name: 'Independent Hardware Set',
      brand: 'Independent',
      description: 'Phillips hardware, 1"',
      price: 4.99,
      stock: 100,
      imageUrl: '/images/Independent-Hardware-Set.webp',
      categoryId: 6,
      color: 'Silver'
    },
    {
      name: 'Diamond Supply Co. Hardware',
      brand: 'Diamond',
      description: 'Colored hardware.',
      price: 6.99,
      stock: 80,
      imageUrl: '/images/Diamond-Supply-Co-Hardware.webp',
      categoryId: 6,
      color: 'Gold'
    },
  ];

  // Добавляем все товары в базу
  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`🚀 Sucesso! Banco de dados pronto. Produtos criados: ${products.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao preencher o banco de dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
