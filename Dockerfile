# Base Image
FROM node:22-slim AS base
WORKDIR /app

# --- Dependency Stage ---
FROM base AS deps
# Copy package metadata to cache dependency installation
COPY package.json package-lock.json ./
COPY apps/app/package.json ./apps/app/package.json
COPY apps/marketing/package.json ./apps/marketing/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Copy prepare script to avoid MODULE_NOT_FOUND during npm ci
COPY scripts/infrastructure/prepare-husky.js ./scripts/infrastructure/prepare-husky.js

# Install dependencies using package-lock.json
RUN npm ci

# --- Development Runner ---
FROM base AS dev
# Copy pre-installed node_modules
COPY --from=deps /app/node_modules ./node_modules
# Copy all source files
COPY . .

# Set environment variables for local development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Expose ports: 3000 for App, 3001 for Marketing
EXPOSE 3000
EXPOSE 3001

# Run development servers via Turborepo
CMD ["npm", "run", "dev"]

# --- Production Builder ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Run strict build
RUN npm run build

# --- Production Runner ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy build artifacts and dependencies
COPY --from=builder /app ./

# Expose ports
EXPOSE 3000
EXPOSE 3001

# Production startup command
CMD ["npx", "turbo", "run", "start"]
