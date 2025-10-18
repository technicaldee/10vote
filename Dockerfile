# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build UI + bundle ws server
COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies (ws, dotenv)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets (UI and ws-server)
COPY --from=build /app/build ./build

# Default port for HTTP + WebSocket (behind TLS proxy)
ENV WS_PORT=8080
EXPOSE 8080

# Start the server that serves UI and handles WebSocket upgrades
CMD ["node", "build/ws-server.js"]