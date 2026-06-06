/**
 * server.js - 富贵花开 后端API服务
 * 
 * 功能:
 * 1. 代理通义万相 AI 图像风格化
 * 2. 微信登录
 * 3. 微信支付
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const axios = require('axios')
const path = require('path')
const fs = require('fs')

const app = express()
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

app.use(cors())
app.use(express.json())
app.use('/static', express.static(path.join(__dirname, 'static')))

// 确保静态目录存在
if (!fs.existsSync(path.join(__dirname, 'static'))) {
  fs.mkdirSync(path.join(__dirname, 'static'), { recursive: true })
}

// ========== 通义万相 API 配置 ==========
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const DASHSCOPE_API = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation'

// 风格映射 (style_index)
const STYLE_INDEX_MAP = {
  peony: 14,     // 国风工笔 → 牡丹富贵
  golden: 8,     // 清雅国风 → 金玉满堂
  ink: 5,        // 国画古风 → 水墨丹青
  cloud: 3,      // 小清新   → 祥云仙气
  classic: 9     // 喜迎新年 → 古典年画
}

// ========== 通义万相 图像生成 ==========
async function generateWithTongyi(imageBase64, styleId) {
  const styleIndex = STYLE_INDEX_MAP[styleId] || 14
  try {
    const response = await axios.post(DASHSCOPE_API, {
      model: 'wanx-style-repaint-v1',
      input: {
        image_url: imageBase64,
        style_index: styleIndex
      }
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      }
    })

    if (response.data && response.data.output) {
      const taskId = response.data.output.task_id
      // 轮询等待结果
      const result = await pollTaskResult(taskId)
      return result
    }
    
    return null
  } catch (error) {
    console.error('Tongyi API error:', error.message)
    return null
  }
}

// 轮询异步任务结果
async function pollTaskResult(taskId, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      const response = await axios.get(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        { headers: { 'Authorization': `Bearer ${DASHSCOPE_API_KEY}` } }
      )
      
      const status = response.data.output.task_status
      if (status === 'SUCCEEDED') {
        return response.data.output.results[0].url
      } else if (status === 'FAILED') {
        console.error('Task failed:', response.data)
        return null
      }
    } catch (e) {
      console.error('Poll error:', e.message)
    }
  }
  
  return null
}

// ========== API 路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '富贵花开 API' })
})

// 微信登录
app.post('/api/login', async (req, res) => {
  const { code } = req.body
  
  if (!code) {
    return res.json({ success: false, message: '缺少 code' })
  }
  
  // 调用微信API换取 openid
  // 生产环境使用真实API
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
  
  try {
    // 将图片转为 base64
    const imageBase64 = req.file.buffer.toString('base64')
    
    // 调用通义万相（新版 wanx-style-repaint-v1）
    const resultUrl = await generateWithTongyi(`data:image/jpeg;base64,${imageBase64}`, style)
    
    if (resultUrl) {
      res.json({ 
        success: true, 
        resultUrl: resultUrl,
        style: style
      })
    } else {
      // 如果API调用失败，返回演示图片
      res.json({ 
        success: true, 
        resultUrl: '/static/demo-result.jpg',
        style: style,
        note: 'demo_mode'
      })
    }
  } catch (error) {
    console.error('Generate error:', error)
    res.json({ success: false, message: '生成失败，请重试' })
  }
})

// 创建支付订单
app.post('/api/pay', async (req, res) => {
  const { plan, amount, openId } = req.body
  
  // 生产环境: 调用微信支付统一下单API
  // 这里返回模拟数据
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
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🌸 富贵花开 API 服务已启动: http://localhost:${PORT}`)
  console.log(`📋 健康检查: http://localhost:${PORT}/api/health`)
})
