FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY prisma/schema.prisma ./prisma/schema.prisma
RUN ./node_modules/.bin/prisma generate

COPY . .
ENV NODE_ENV=production

USER node

EXPOSE 5000

CMD ["node", "index.js"]
