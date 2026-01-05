# ---------- Base image ----------
FROM node:20-alpine

# ---------- System deps ----------
# sqlite: CLI tool for debugging
# dumb-init: proper signal handling (Ctrl+C, SIGTERM)
RUN apk add --no-cache \
    sqlite \
    dumb-init

# ---------- App directory ----------
WORKDIR /app

# ---------- Copy package files ----------
# Copy only package files first to leverage Docker cache
COPY server/package*.json ./server/

# ---------- Install dependencies ----------
RUN cd server && npm ci --omit=dev

# ---------- Copy application source ----------
COPY server ./server

# ---------- Environment ----------
ENV NODE_ENV=production
ENV PORT=3000

# ---------- Data volume ----------
# SQLite DB, uploads, exports
VOLUME ["/data"]

# ---------- Expose port ----------
EXPOSE 3000

# ---------- Non-root user ----------
RUN addgroup -S transorbit && adduser -S transorbit -G transorbit
RUN chown -R transorbit:transorbit /app /data
USER transorbit

# ---------- Entrypoint ----------
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# ---------- Start ----------
CMD ["node", "server/src/app.js"]
