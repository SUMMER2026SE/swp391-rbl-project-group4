# Backend Kizuna Nihongo — chạy trên Render / Railway / Fly.io (container thường trú).
# KHÔNG dùng được Vercel serverless vì cần ffmpeg + yt-dlp và cron chạy liên tục.

FROM node:20-bookworm-slim

# ffmpeg      : tách/chuẩn hoá audio cho tính năng luyện nghe (config/audio.js)
# python3+pip : chạy yt-dlp (config/youtube.js tự fallback `python -m yt_dlp`)
# make/g++    : node-gyp build native module `node-vad` (VAD chia đoạn transcript)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-pip make g++ ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài dependencies trước để tận dụng cache layer khi chỉ đổi source
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Render/Railway tự cấp biến PORT; server.js ưu tiên đọc PORT.
EXPOSE 3001

CMD ["node", "server.js"]
