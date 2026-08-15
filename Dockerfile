FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY lib ./lib
COPY scripts ./scripts
COPY server ./server
COPY public ./public
RUN npm run onnxruntime:stage && npm run check && mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
EXPOSE 8787
CMD ["npm", "start"]
