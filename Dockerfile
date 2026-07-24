FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json next.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system capture && useradd --system --gid capture capture
COPY --from=builder --chown=capture:capture /app/public ./public
COPY --from=builder --chown=capture:capture /app/.next/standalone ./
COPY --from=builder --chown=capture:capture /app/.next/static ./.next/static
USER capture
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
