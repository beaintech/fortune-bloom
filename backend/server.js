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

// 风格映射
const STYLE_PROMPTS = {
  peony: `将这张照片转化为华丽的中国传统花卉风格。背景是盛开的牡丹花丛，搭配大红色和金色的华丽边框。整体色调以中国红(#C41E3A)和金色(#D4A017)为主，添加富贵华丽的装饰元素。画面明亮、喜庆、富贵。人脸保持自然清晰，服装和背景整体美化。`,
  
  golden: `将这张照片转化为金碧辉煌的风格。金色祥云背景，金色边框装饰。整体呈温暖的金色调，如同置身金色宫殿。加入金色光芒、钱币、元宝等象征财富的元素。画面富丽堂皇但不过分夸张。`,
  
  ink: `将这张照片转化为优雅的中国水墨画风格。背景为淡淡的水墨渲染，留白有致。颜色以黑白灰为主，点缀少量朱红。人物轮廓用水墨笔触勾勒，气质优雅文艺。画面宁静致远，有文人气息。`,
  
  cloud: `将这张照片转化为仙气飘飘的祥云风格。背景是蓝天白云和缭绕的仙气，画面清新淡雅。加入祥云、仙鹤、远山等元素。整体色调柔和明亮，给人一种祥和、好运的感觉。`,
  
  classic: `将这张照片转化为喜庆的中国传统年画风格。大红底色，金色纹样边框。人物面容红润喜庆，服装华丽。加入牡丹、福字、如意等传统吉祥元素。画面饱满、热闹、喜庆，有浓郁的中国年味。`
}

// ========== 通义万相 图像生成 ==========
async function generateWithTongyi(imageBase64, stylePrompt) {
  try {
    const response = await axios.post(DASHSCOPE_API, {
      model: 'wanx-style-cosplay-v1',
      input: {
        base_image: imageBase64,
        ref_image: imageBase64,
        style_index: 0
      },
      parameters: {
        prompt: stylePrompt,
        negative_prompt: '模糊, 扭曲, 变形, 丑陋, 恐怖, 暗黑, 悲伤',
        size: '1024*1024'
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
  
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.peony
  
  try {
    // 将图片转为 base64
    const imageBase64 = req.file.buffer.toString('base64')
    
    // 调用通义万相
    const resultUrl = await generateWithTongyi(`data:image/jpeg;base64,${imageBase64}`, stylePrompt)
    
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
