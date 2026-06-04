FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl

FROM base AS deps

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM deps AS tools

COPY apps/api apps/api

RUN npm run prisma:generate -w apps/api

FROM tools AS build

RUN npm run build -w apps/api

FROM base AS runner

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY --from=tools /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && npm run start -w apps/api"]
