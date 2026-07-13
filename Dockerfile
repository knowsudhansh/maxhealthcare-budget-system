# syntax=docker/dockerfile:1.7

FROM node:22.21.1-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=secret,id=corp_ca,target=/run/secrets/corp-ca.pem \
    export NODE_EXTRA_CA_CERTS=/run/secrets/corp-ca.pem && \
    export npm_config_cafile=/run/secrets/corp-ca.pem && \
    npm ci --omit=dev --no-audit --no-fund

FROM node:22.21.1-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

RUN mkdir -p "/app/Server data" \
    && chown -R node:node "/app/Server data"

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]