FROM node:20-slim

LABEL maintainer="velinea"
LABEL org.opencontainers.image.source="https://github.com/velinea/transorbit"

RUN apt-get update && apt-get install -y \
    sqlite3 \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV PORT=3000

VOLUME ["/data"]

EXPOSE 3000

RUN useradd -r -u 10001 transorbit \
 && mkdir -p /data \
 && chown -R transorbit:transorbit /app /data

USER transorbit

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/src/app.js"]
