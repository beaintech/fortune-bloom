/**
 * server.js - 富贵花开 后端API服务
 * 
 * 功能:
 * 1. 代理腾讯混元 AI 图像风格化（图生图）
 * 2. 微信登录
 * 3. 微信支付
 * 
 * AI 引擎: 腾讯混元生图 ImageToImage（同步接口，无需轮询）
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

// 腾讯云 SDK — 仅导入 aiart 模块
const { aiart } = require('tencentcloud-sdk-nodejs-aiart')
const AiartClient = aiart.v20221229.Client

const app = express()
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/static', express.static(path.join(__dirname, 'static')))

// 确保静态目录存在
if (!fs.existsSync(path.join(__dirname, 'static'))) {
  fs.mkdirSync(path.join(__dirname, 'static'), { recursive: true })
}

// ========== 腾讯混元 API 配置 ==========
const TENCENT_SECRET_ID  = process.env.TENCENT_SECRET_ID
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY
const TENCENT_REGION     = process.env.TENCENT_REGION || 'ap-guangzhou'

// 初始化腾讯云客户端（延迟初始化，避免空凭证报错）
function getClient() {
  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置')
  }
  return new AiartClient({
    credential: {
      secretId: TENCENT_SECRET_ID,
      secretKey: TENCENT_SECRET_KEY,
    },
    region: TENCENT_REGION,
    profile: {
      httpProfile: {
        endpoint: 'aiart.tencentcloudapi.com',
        reqTimeout: 30, // 30 秒超时（同步接口，无需轮询）
      },
    },
  })
}

// ========== 风格映射（腾讯混元 Style ID） ==========
const STYLE_CONFIG = {
  peony:   { id: '125', prompt: '牡丹花开，富贵吉祥，国风工笔画风格，金红配色，华丽典雅' },
  golden:  { id: '203', prompt: '金玉满堂，璀璨华美，唯美古风风格，金色光辉，雍容华贵' },
  ink:     { id: '101', prompt: '水墨丹青，意境悠远，水墨画风格，墨色浓淡相宜，留白有韵' },
  cloud:   { id: '203', prompt: '祥云缭绕，仙气飘飘，唯美古风风格，云纹环绕，轻盈梦幻' },
  classic: { id: '128', prompt: '古典年画，喜庆祥和，国风娃娃画风格，色彩明艳，瑞兽吉祥' },
}

// ========== 腾讯混元 图像风格化 ==========
async function generateWithHunyuan(imageBase64, styleId) {
  const config = STYLE_CONFIG[styleId]
  if (!config) throw new Error(`未知风格: ${styleId}`)

  const client = getClient()

  try {
    const params = {
      // InputImage 只传纯 base64，不带 data URI 前缀
      // 腾讯混元 ImageToImage 参数
      // 文档: https://cloud.tencent.com/document/product/1668/88066
      InputImage: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      Styles: [config.id],       // ⚠️ 必须是数组，不是字符串！
      Prompt: config.prompt,
      RspImgType: 'base64',      // 返回 base64
      Strength: 0.7,             // 生成自由度 0~1，推荐 0.6-0.8
      ResultConfig: {
        Resolution: '2048:2048'
      }
    }

    console.log(`🎨 调用腾讯混元: style=${styleId} (Style ID: ${config.id})`)
    const response = await client.ImageToImage(params)
    
    if (response.ResultImage) {
      console.log('✅ 混元生成成功')
      // ResultImage 是 base64 字符串，转为 data URI
      return `data:image/jpeg;base64,${response.ResultImage}`
    }
    
    console.error('❌ 混元返回异常:', JSON.stringify(response))
    return null
    
  } catch (error) {
    console.error('❌ 腾讯混元 API 错误:', error.message)
    if (error.code) {
      console.error('  错误码:', error.code)
      console.error('  错误详情:', error.message)
    }
    // 把腾讯云的错误信息传回前端
    const errMsg = error.code 
      ? `混元API错误 [${error.code}]: ${error.message}`
      : `混元API错误: ${error.message}`
    throw new Error(errMsg)
  }
}

// ========== API 路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
  const status = {
    status: 'ok',
    service: '富贵花开 API',
    engine: '腾讯混元生图',
    configured: !!(TENCENT_SECRET_ID && TENCENT_SECRET_KEY)
  }
  res.json(status)
})

// 微信登录
app.post('/api/login', async (req, res) => {
  const { code } = req.body
  
  if (!code) {
    return res.json({ success: false, message: '缺少 code' })
  }
  
  res.json({ 
    success: true, 
    openid: 'demo_' + code.substring(0, 8)
  })
})

// AI 图像生成
app.post('/api/generate', upload.single('image'), async (req, res) => {
  const { style, openId } = req.body
  
  if (!req.file) {
    return res.json({ success: false, message: '请上传图片' })
  }
  
  // 检查腾讯云凭证
  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
    console.error('❌ 腾讯云凭证未配置！请在云托管环境变量中设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY')
    return res.json({ success: false, message: 'AI 服务未配置，请联系开发者设置腾讯云密钥' })
  }

  if (!STYLE_CONFIG[style]) {
    return res.json({ success: false, message: `未知风格: ${style}` })
  }
  
  try {
    console.log(`📸 收到生成请求: style=${style}, fileSize=${req.file.size} bytes`)
    
    // 将图片转为 base64
    const imageBase64 = req.file.buffer.toString('base64')
    const dataUri = `data:image/jpeg;base64,${imageBase64}`
    
    // 调用腾讯混元（同步接口，直接返回结果，无需轮询！）
    const resultUrl = await generateWithHunyuan(dataUri, style)
    
    if (resultUrl) {
      res.json({ 
        success: true, 
        resultUrl: resultUrl,
        style: style
      })
    } else {
      res.json({ 
        success: false, 
        message: 'AI 生成失败，请换张照片试试，或稍后重试'
      })
    }
  } catch (error) {
    console.error('Generate error:', error.message)
    // 把混元 API 的真实错误返回给前端
    const msg = error.message && error.message.includes('混元') 
      ? error.message 
      : 'AI 生成失败，请稍后重试'
    res.json({ success: false, message: msg })
  }
})

// 创建支付订单
app.post('/api/pay', async (req, res) => {
  const { plan, amount, openId } = req.body
  
  res.json({
    success: true,
    payParams: {
      timeStamp: String(Date.now()),
      nonceStr: Math.random().toString(36).substring(2),
      package: 'prepay_id=wx_demo_' + Date.now(),
      signType: 'MD5',
      paySign: 'demo_sign'
    }
  })
})

// ========== 启动服务器 ==========
app.listen(process.env.PORT || 80, () => {
  const port = process.env.PORT || 80
  console.log(`🌸 富贵花开 API 服务已启动: http://localhost:${port}`)
  console.log(`🎨 AI 引擎: 腾讯混元生图 (ImageToImage)`)
  console.log(`🔑 腾讯云密钥: ${TENCENT_SECRET_ID ? '✅ 已配置' : '❌ 未配置'}`)
  console.log(`📋 健康检查: http://localhost:${port}/api/health`)
})
