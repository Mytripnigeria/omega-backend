FROM node:18-alpine

WORKDIR /app

# Chromium + the runtime libs Puppeteer needs to render the invoice HTML.
# We use Alpine's system Chromium (puppeteer's bundled binary is glibc-only and
# won't run on musl), and tell Puppeteer to skip its own download.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-emoji

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 9091

CMD ["node", "dist/main.js"]
