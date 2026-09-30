FROM node:20-alpine

ENV NODE_ENV=production \
    SPARRING_HOST=0.0.0.0 \
    SPARRING_PORT=8788 \
    SPARRING_STATIC_DIR=/app/dist \
    SPARRING_QUOTA_FILE=/data/quota.json

WORKDIR /app
COPY --chown=node:node package.json app.js ./
COPY --chown=node:node server-dist/ ./server-dist/
COPY --chown=node:node dist/ ./dist/
COPY --chown=node:node spec/ ./spec/
COPY --chown=node:node prompts/ ./prompts/

USER node
EXPOSE 8788
CMD ["node", "app.js"]
