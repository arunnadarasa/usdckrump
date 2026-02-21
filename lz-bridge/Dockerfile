# Bridge relayer: watches LockRequest on Base Sepolia, calls fulfillLock on Story Aeneid
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .

CMD ["node", "scripts/relayer-bridge.js"]
