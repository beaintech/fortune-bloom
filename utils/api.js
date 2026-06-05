// utils/api.js - API 工具
const app = getApp()

const request = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBase + url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(res)
        }
      },
      fail: reject
    })
  })
}

// 上传图片生成
const generateImage = (filePath, style) => {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: app.globalData.apiBase + '/api/generate',
      filePath: filePath,
      name: 'image',
      formData: { style },
      success: (res) => {
        try {
          resolve(JSON.parse(res.data))
        } catch (e) {
          reject(e)
        }
      },
      fail: reject
    })
  })
}

// 登录
const login = (code) => {
  return request('/api/login', { method: 'POST', data: { code } })
}

// 创建支付
const createPayment = (plan, amount) => {
  return request('/api/pay', { method: 'POST', data: { plan, amount } })
}

module.exports = {
  request,
  generateImage,
  login,
  createPayment
}
