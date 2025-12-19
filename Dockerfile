# Multi-stage Docker build for Microsoft Fabric Analytics MCP Server
# Optimized for Glama.ai with MCP inspection support

# Stage 1: Build stage with increased memory
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Install git (required for some npm packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build with increased Node.js memory (4GB heap)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm run build

# Stage 2: Production stage
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mcp && useradd -r -g mcp -u 1001 mcp

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# Copy built application from builder stage
COPY --from=builder --chown=mcp:mcp /app/build ./build

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Environment variables for MCP server
ENV NODE_ENV=production \
    MCP_SERVER_NAME="fabric-analytics-mcp" \
    MCP_SERVER_VERSION="2.0.1"

# Enable MCP inspector support for Glama.ai
ENV MCP_INSPECTOR_ENABLED=true

# Expose MCP stdio interface (standard for MCP servers)
# MCP servers typically use stdio, not HTTP ports

# Health check for containerized environments
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD pgrep -f "node.*build/index.js" > /dev/null || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the MCP server via stdio
CMD ["node", "build/index.js"]
