# Multi-stage / Lightweight Production Dockerfile for Wedding Studio Free
# Compatible with: Render, Railway, Koyeb, Fly.io, Google Cloud Run, Self-Hosted Docker

FROM node:22-alpine AS builder

WORKDIR /app

# Install system utilities if needed
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY package.json ./

# Install all dependencies (including devDependencies required for vite build and tsx)
RUN npm install

# Copy application source code
COPY . .

# Build the frontend production assets into /app/dist
RUN npm run build

# Runtime Stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install production node environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules, package.json, dist, and server source
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/supabase ./supabase
COPY --from=builder /app/data ./data
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose port (can be overridden dynamically by cloud providers via $PORT)
EXPOSE 3000

# Start production server
CMD ["npm", "run", "start"]
