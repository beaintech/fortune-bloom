// app.js - 富贵花开
App({
  globalData: {
    userInfo: null,
    openId: null,
    isVip: false,
    vipType: '',      // 'day' | 'month' | 'year'
    vipExpire: null,
    // 每个风格免费试用1次，共5个风格
    freeStylesUsed: [],  // 已免费使用过的风格ID
    apiBase: 'https://fortune-bloom-api.example.com'
  },

  // 会员生成上限
  VIP_LIMITS: {
    day: 10,      // 日卡：24小时内最多10张
    month: 50,    // 月卡：30天内最多50张
    year: 300     // 年卡：365天内最多300张
  },

  onLaunch() {
    // 读取已使用的免费风格（存在本地，不清零）
    const saved = wx.getStorageSync('freeStylesUsed') || []
    this.globalData.freeStylesUsed = saved

    // 读取VIP状态
    const vip = wx.getStorageSync('vipInfo') || {}
    if (vip.expire && new Date(vip.expire) > new Date()) {
      this.globalData.isVip = true
      this.globalData.vipType = vip.type || 'day'
      this.globalData.vipExpire = vip.expire
    }

    // 清理过期的生成记录（节省存储空间）
    this.cleanOldRecords()

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
  },

  // 获取VIP会员的已生成张数（在有效期内）
  getVipUsedCount() {
    if (!this.globalData.isVip) return 0
    const vip = wx.getStorageSync('vipInfo') || {}
    if (!vip.type) return 0

    const records = wx.getStorageSync('generateRecords') || []
    const now = new Date()

    // 根据会员类型计算有效期起始时间
    let startDate
    if (vip.type === 'day') {
      startDate = new Date(vip.startTime)
    } else if (vip.type === 'month') {
      // 月卡：从开通日起30天内
      startDate = new Date(vip.startTime)
      const expireDate = new Date(startDate)
      expireDate.setDate(expireDate.getDate() + 30)
      // 如果还没过期，统计从startTime到现在
      if (now <= expireDate) {
        // 只统计最近30天的
        const cutoff = new Date(now)
        cutoff.setDate(cutoff.getDate() - 30)
        return records.filter(r => new Date(r) >= cutoff).length
      }
      return 0
    } else {
      // 年卡：从开通日起365天内
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - 365)
      return records.filter(r => new Date(r) >= cutoff).length
    }

    // 日卡：统计今天内的
    const todayStr = now.toLocaleDateString()
    return records.filter(r => new Date(r).toLocaleDateString() === todayStr).length
  },

  // 检查VIP是否已达到上限
  isVipLimitReached() {
    if (!this.globalData.isVip) return false
    const vip = wx.getStorageSync('vipInfo') || {}
    if (!vip.type) return false
    const limit = this.VIP_LIMITS[vip.type] || 10
    return this.getVipUsedCount() >= limit
  },

  // 记录一次生成
  recordGeneration() {
    if (!this.globalData.isVip) return
    const records = wx.getStorageSync('generateRecords') || []
    records.push(new Date().toISOString())
    wx.setStorageSync('generateRecords', records.slice(-500)) // 最多保留500条
  },

  // 清理超过1年的记录
  cleanOldRecords() {
    const records = wx.getStorageSync('generateRecords') || []
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const filtered = records.filter(r => new Date(r) >= cutoff)
    if (filtered.length !== records.length) {
      wx.setStorageSync('generateRecords', filtered)
    }
  }
})
