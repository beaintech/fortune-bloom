// app.js - 富贵花开
App({
  globalData: {
    userInfo: null,
    openId: null,
    freeCount: 3,
    isVip: false,
    vipExpire: null,
    apiBase: 'https://fortune-bloom-api.example.com'
  },

  onLaunch() {
    // 读取本地存储
    const today = this.getDateKey()
    const saved = wx.getStorageSync('dailyUsage') || {}
    
    // 重置每日免费次数
    if (saved.date !== today) {
      saved.date = today
      saved.count = 0
      wx.setStorageSync('dailyUsage', saved)
    }
    this.globalData.freeCount = 3 - (saved.count || 0)

    // 读取VIP状态
    const vip = wx.getStorageSync('vipInfo') || {}
    if (vip.expire && new Date(vip.expire) > new Date()) {
      this.globalData.isVip = true
      this.globalData.vipExpire = vip.expire
    }

    // 登录
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: this.globalData.apiBase + '/api/login',
            method: 'POST',
            data: { code: res.code },
            success: (resp) => {
              if (resp.data && resp.data.openid) {
                this.globalData.openId = resp.data.openid
              }
            }
          })
        }
      }
    })
  },

  getDateKey() {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  },

  useFreeCount() {
    if (this.globalData.isVip) return true
    if (this.globalData.freeCount <= 0) return false
    
    this.globalData.freeCount--
    const saved = wx.getStorageSync('dailyUsage') || { date: this.getDateKey(), count: 0 }
    saved.count = (saved.count || 0) + 1
    wx.setStorageSync('dailyUsage', saved)
    return true
  },

  getRemainingCount() {
    if (this.globalData.isVip) return '无限'
    return Math.max(0, this.globalData.freeCount)
  }
})
