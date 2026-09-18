FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js solari-service.js source-snapshot-store.js permit-requirements.js document-verification-service.js ./

ENV NODE_ENV=production
ENV PORT=4173
ENV CIVRA_SOURCE_SNAPSHOT_DIR=/var/lib/civra-source-snapshots

RUN mkdir -p /var/lib/civra-source-snapshots && chown -R node:node /app /var/lib/civra-source-snapshots

USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
