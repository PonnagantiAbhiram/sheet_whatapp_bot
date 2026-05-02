FROM node:22-slim

# Install Chromium and all required system dependencies for headless Chrome
RUN apt-get update && apt-get install -y \
    chromium \
    libxss1 \
    libappindicator3-1 \
    libindicator7 \
    libgconf-2-4 \
    libxrender1 \
    libxtst6 \
    libxi6 \
    libxrandr2 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    fonts-liberation \
    fonts-noto-color-emoji \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install dependencies
# (postinstall script is skipped because PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the bot source code
COPY . .

CMD ["node", "index.js"]
