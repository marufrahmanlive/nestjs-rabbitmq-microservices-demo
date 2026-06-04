FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* tsconfig.json nest-cli.json ./
RUN npm ci

COPY libs/ ./libs/
COPY apps/ ./apps/

ARG SERVICE_NAME=api-gateway
RUN npx nest build ${SERVICE_NAME}

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER nestjs

ARG SERVICE_NAME=api-gateway
ENV SERVICE_NAME=${SERVICE_NAME}

CMD ["sh", "-c", "node dist/apps/${SERVICE_NAME}/main.js"]