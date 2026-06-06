// app.js - 富贵花开
App({
  globalData: {
    userInfo: null,
    openId: null,
    isVip: false,
    vipExpire: null,
    // 每个风格免费试用1次，共5个风格
    freeStylesUsed: [],  // 已免费使用过的风格ID
    apiBase: 'https://fortune-bloom-api.example.com'
  },

  onLaunch() {
    // 读取已使用的免费风格（存在本地，不清零）
    const saved = wx.getStorageSync('freeStylesUsed') || []
    this.globalData.freeStylesUsed = saved

    // 读取VIP状态
    const vip = wx.getStorageSync('vipInfo') || {}
    if (vip.expire && new Date(vip.expire) > new Date()) {
      this.globalData.isVip = true
      this.globalData.vipExpire = vip.expire
    }

    // 登录（离线兼容，后端不可用时不影响启动）
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: this.globalData.apiBase + '/api/login',
            method: 'POST',
            data: { code: res.code },
            timeout: 5000,
            success: (resp) => {
              if (resp.data && resp.data.openid) {
                this.globalData.openId = resp.data.openid
              }
            },
            fail: () => {
              // 后端未部署时静默失败，不影响小程序使用
              console.log('后端暂不可用，使用本地模式')
            }
          })
        }
      }
    })
  },

  // 检查某个风格是否可免费使用
  canUseFree(styleId) {
    if (this.globalData.isVip) return true
    return !this.globalData.freeStylesUsed.includes(styleId)
  },

  // 标记某个风格已免费使用
  markStyleUsed(styleId) {
    if (this.globalData.isVip) return
    if (this.globalData.freeStylesUsed.includes(styleId)) return
    this.globalData.freeStylesUsed.push(styleId)
    wx.setStorageSync('freeStylesUsed', this.globalData.freeStylesUsed)
  },

  // 剩余免费风格数
  getRemainingCount() {
    if (this.globalData.isVip) return '无限'
    return Math.max(0, 5 - this.globalData.freeStylesUsed.length)
  }
})
