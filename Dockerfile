# ════════════════════════════════════════════════════════════════════════
# REEBOW TECH PLATFORM — DOCKERFILE
# Multi-stage: Build → Production (Alpine, Non-root, Optimized)
# Version: 2.0.0 | Node 20 LTS | Security Hardened
# ════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────
# STAGE 1: Build Dependencies (Node 20 Alpine)
# ────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Metadata
LABEL org.opencontainers.image.title="Reebow TECH Platform"
LABEL org.opencontainers.image.description="Telegram-style real-time messaging & video call platform"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.authors="Reebow TECH"
LABEL org.opencontainers.image.source="https://github.com/your-org/reebow-platform"
LABEL org.opencontainers.image.licenses="MIT"

# Security: Update packages, add dumb-init for signal handling
RUN apk add --no-cache --upgrade \
    dumb-init \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy source code
COPY . .

# ────────────────────────────────────────────────────────────────────────
# STAGE 2: Production Runtime (Distroless-style: minimal attack surface)
# ────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# Install only runtime deps: dumb-init, curl (healthcheck)
RUN apk add --no-cache --upgrade \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --from=builder --chown=nodejs:nodejs /app/server.js ./server.js
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# ────────────────────────────────────────────────────────────────────────
# SECURITY HARDENING
# ────────────────────────────────────────────────────────────────────────

# Remove package managers and build tools to minimize attack surface
RUN rm -rf /usr/bin/npm /usr/bin/npx /usr/bin/yarn /usr/bin/pnpm /usr/local/bin/docker* /usr/local/bin/containerd* 2>/dev/null || true

# ────────────────────────────────────────────────────────────────────────
# ENVIRONMENT VARIABLES (Runtime defaults, override at deploy)
# ────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=10000 \
    NPM_CONFIG_LOGLEVEL=warn \
    NODE_OPTIONS="--max-old-space-size=512" \
    # Security
    TRUST_PROXY=true \
    HELMET_CSP_ENABLED=true \
    SESSION_SECURE_COOKIES=true \
    # Paths
    APP_DIR=/app \
    LOGS_DIR=/var/log/reebow \
    TMP_DIR=/tmp/reebow

# ────────────────────────────────────────────────────────────────────────
# USER & PERMISSIONS
# ────────────────────────────────────────────────────────────────────────
USER nodejs

# ────────────────────────────────────────────────────────────────────────
# HEALTHCHECK
# ────────────────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/health || exit 1

# ────────────────────────────────────────────────────────────────────────
# EXPOSE PORT
# ────────────────────────────────────────────────────────────────────────
EXPOSE 10000

# ────────────────────────────────────────────────────────────────────────
# ENTRYPOINT & CMD
# ────────────────────────────────────────────────────────────────────────
# Use dumb-init for proper signal handling (SIGTERM -> graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# ────────────────────────────────────────────────────────────────────────
# BUILD ARGS (for CI/CD)
# ────────────────────────────────────────────────────────────────────────
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created=${BUILD_DATE} \
      org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.version=${VERSION}
