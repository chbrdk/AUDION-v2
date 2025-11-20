FROM node:22.11.0-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/types/package*.json packages/types/
RUN npm install
COPY . .
# Skip build in development mode - Next.js will compile on demand
# RUN npm run build:web
EXPOSE 3000
CMD ["npm", "run", "dev:web"]

