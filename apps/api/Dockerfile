FROM node:24-alpine

RUN apk add --no-cache openssl && corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY apps/api apps/api
RUN pnpm --filter @museum/api db:generate \
  && pnpm --filter @museum/api build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @museum/api db:deploy && pnpm --filter @museum/api start:prod"]
