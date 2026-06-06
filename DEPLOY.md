# 富贵花开 - 后端部署指南

## 方式一：Render.com（最简单，免费）

1. 注册 https://render.com （用 GitHub 登录）
2. 点击 "New +" → "Web Service"
3. 连接 GitHub 仓库 `beaintech/fortune-bloom`
4. 配置：
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. 在 "Environment" 标签页添加环境变量：
   - `DASHSCOPE_API_KEY` = `sk-你的通义万相API密钥`
6. 点击 "Create Web Service"
7. 部署完成后会得到一个 URL，例如：`https://fortune-bloom-api.onrender.com`
8. 把该 URL 替换 `app.js` 里的 `apiBase`

⚠️ Render 免费版 15 分钟无请求会自动休眠，第一次请求会慢 30 秒。

---

## 方式二：微信云托管（推荐生产用）

最适合微信小程序，无需域名校验，内置微信登录和支付。

### 前提条件
- 已认证的小程序账号
- 微信支付已开通

### 步骤

1. 登录 [微信公众平台](https://mp.weixin.qq.com) → 小程序后台
2. 左侧菜单 → **云托管** → **立即开通**
3. 创建服务：`fortune-bloom-api`
4. 在项目根目录创建 `Dockerfile`：（已提供）
5. 推送代码，在云托管控制台点击「新建版本」→ 选择代码仓库分支
6. 部署完成后，在「服务信息」里复制「公网访问地址」
7. 将该地址填入 `app.js` 的 `apiBase`

### 环境变量配置（微信云托管控制台）
- `DASHSCOPE_API_KEY` = `sk-你的通义万相API密钥`

---

## 方式三：本地测试（开发用）

```bash
cd fortune-bloom/backend
npm install
echo "DASHSCOPE_API_KEY=sk-你的密钥" > .env
node server.js
# 服务启动在 http://localhost:3000
```

然后在微信开发者工具 → 详情 → 本地设置 → 勾选「不校验合法域名」

---

## 部署后必做

1. 在小程序后台添加域名白名单：
   - 登录 mp.weixin.qq.com → 开发 → 开发管理 → 开发设置 → 服务器域名
   - 把你的后端域名加到 `request 合法域名`
2. 更新 `app.js` 第 11 行的 `apiBase` 为真实域名
3. 重新编译小程序
