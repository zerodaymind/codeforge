# Multi-stage production Dockerfile for CodeForge Backend
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Run as non-privileged node user (least privilege, no docker group)
USER node

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node server ./server

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server/server.js"]
