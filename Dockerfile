FROM node:24-bookworm-slim AS node-runtime
FROM python:3.14-slim-bookworm
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 ca-certificates && rm -rf /var/lib/apt/lists/* && ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /app
COPY ml/requirements.txt ml/requirements.txt
RUN python -m venv .venv && .venv/bin/python -m pip install --no-cache-dir -r ml/requirements.txt
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci
COPY . .
ENV API_BASE_URL=http://api:4000
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000 4000
