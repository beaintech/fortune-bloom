FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# 暴露端口（微信云托管读取 PORT 环境变量）
EXPOSE 3000

CMD ["node", "server.js"]
