FROM node:20-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

COPY server/src ./src

ENV PORT=7030
ENV DATA_DIR=/data
EXPOSE 7030

CMD ["node", "src/app.js"]
