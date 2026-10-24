FROM node:18-alpine

WORKDIR /app

# Зависимости
COPY package*.json ./
RUN npm ci --silent

# Оптимизация кэша: Prisma генерируется до копирования всего кода
COPY prisma ./prisma/
RUN npx prisma generate

# Исходный код и переключение на пользователя node
COPY . .
RUN chown -R node:node /app

USER node

EXPOSE 5000

CMD ["npm", "start"]
