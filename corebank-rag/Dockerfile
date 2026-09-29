# syntax=docker/dockerfile:1
# ---- build stage: compile TypeScript, then throw the toolchain away ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
RUN npm ci
COPY src ./src
RUN npx tsc -p tsconfig.build.json

# ---- runtime stage: only what the service needs to run ----
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY ops/cost-rates.json ./ops/cost-rates.json
# Run as the unprivileged user that ships with the node image, not root.
USER node
EXPOSE 3002
# Configuration and secrets arrive at RUNTIME as environment variables
# (PORT, VERSION, LATENCY_MS, and any secret from the platform's secret
# store). Nothing secret is ever written into an image layer.
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3002)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/http-server.js"]
