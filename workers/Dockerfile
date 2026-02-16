FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
COPY ../shared ./shared
CMD ["npx", "tsx", "src/index.ts"]
