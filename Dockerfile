# Monorepo kökünden build (Railway root = repo root).
# Alternatif: Root Directory = telegram-degen-bot → o klasördeki Dockerfile kullanılır.
FROM node:20-alpine AS build
WORKDIR /app
COPY telegram-degen-bot/package.json telegram-degen-bot/package-lock.json* ./
RUN npm ci
COPY telegram-degen-bot/tsconfig.json ./
COPY telegram-degen-bot/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY telegram-degen-bot/package.json telegram-degen-bot/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
