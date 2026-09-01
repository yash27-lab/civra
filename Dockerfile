FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js solari-service.js permit-requirements.js document-verification-service.js ./

ENV NODE_ENV=production
ENV PORT=4173
EXPOSE 4173

USER node
CMD ["node", "server.js"]
