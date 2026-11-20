FROM mcr.microsoft.com/playwright:v1.61.1-noble AS browser
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web .
CMD ["npx", "playwright", "test"]

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
