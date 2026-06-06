FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# 微信云托管自动注入 PORT 环境变量，无需硬编码 EXPOSE
CMD ["node", "server.js"]
