# syntax=docker/dockerfile:1
#
# zkevinly-web as a container. Same site and same /api/* handlers as the Cloudflare Worker (the
# Worker stays the production host); this is for hosting it anywhere else.
#
#   docker build -t zkevinly-web --secret id=npm_token,env=NODE_AUTH_TOKEN \
#     --build-arg GITHUB_TOKEN=... .        (GITHUB_TOKEN is optional; see below)
#   docker run -p 8080:8080 --env-file .env zkevinly-web
#
# @zkevinly/ui is a workspace package here, so no registry token is needed to build.
# GITHUB_TOKEN (optional, build secret): lets the build read release/commit info for the project
# cards. Without it those badges are simply hidden.

FROM node:22-slim AS build
ENV ASTRO_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --no-audit --no-fund
COPY . .
ARG APP_VERSION=dev
RUN --mount=type=secret,id=github_token,required=false \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" \
    npm run build:fast \
 && printf '{"version":"%s"}' "$APP_VERSION" > dist/version.json

# The Worker handlers import the site's TypeScript config, so bundle the Node host into one JS file
# (esbuild is already in the tree via wrangler). The result needs no node_modules.
RUN node_modules/.bin/esbuild server/node.mjs --bundle --platform=node --format=esm --target=node22 \
      --outfile=/out/server.mjs \
      --banner:js="import{createRequire}from'node:module';const require=createRequire(import.meta.url);"

# Runtime: just the built site and the bundled server.
FROM node:22-slim
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=8080 DIST_DIR=/app/dist
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /out/server.mjs ./server.mjs
USER node

LABEL org.opencontainers.image.title="zkevinly-web" \
      org.opencontainers.image.source="https://github.com/zKevinLy/zkevinly-web" \
      org.opencontainers.image.version="${APP_VERSION}"

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.mjs"]
