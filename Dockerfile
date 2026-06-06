FROM node:18-alpine

WORKDIR /app

# 从 backend/ 复制依赖文件
COPY backend/package*.json ./
RUN npm install --production

# 从 backend/ 复制所有源码
COPY backend/ .

# 微信云托管自动注入 PORT 环境变量
CMD ["node", "server.js"]
