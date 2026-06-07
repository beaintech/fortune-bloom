// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    isVip: false,
    totalGenerated: 0,
    todayGenerated: 0,
    remainingStyles: 5,
    vipUsageText: '',
    _avatarTapCount: 0,
    vipFeatures: [
      { icon: '🎨', text: '日卡10张/月卡50张/年卡300张' },
      { icon: '⚡', text: '高速生成 · 优先处理' },
      { icon: '💾', text: '无限保存到相册' },
      { icon: '🔓', text: '无水印高清原图' },
      { icon: '🎁', text: '专属风格定期更新' },
      { icon: '💬', text: '客服优先响应' }
    ]
  },

  onShow() {
    this.loadUserInfo()
    this.loadStats()
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      avatarUrl: userInfo.avatarUrl || '',
      nickName: userInfo.nickName || '',
      isVip: app.globalData.isVip
    })
  },

  loadStats() {
    const gallery = wx.getStorageSync('gallery') || []
    // 计算今日生成数（用 ISO 日期前缀比��）
    const todayPrefix = new Date().toISOString().substring(0, 10)
    const todayCount = gallery.filter(item => {
      return item.time && item.time.substring(0, 10) === todayPrefix
    }).length

    // VIP 已用/剩余
    let vipUsageText = ''
    if (app.globalData.isVip) {
      const vip = wx.getStorageSync('vipInfo') || {}
      const type = vip.type || 'day'
      const limits = { day: 10, month: 50, year: 300 }
      const typeNames = { day: '日卡', month: '月卡', year: '年卡' }
      const limit = limits[type] || 10
      const used = app.getVipUsedCount()
      const left = Math.max(0, limit - used)
      vipUsageText = `${typeNames[type]} · 已用 ${used}/${limit} · 剩余 ${left}`
    }
    
    this.setData({
      totalGenerated: gallery.length,
      todayGenerated: todayCount,
      remainingStyles: app.getRemainingCount(),
      vipUsageText: vipUsageText
    })
  },

  // 购买套餐
  buyPlan(e) {
    const plan = e.currentTarget.dataset.plan
    const prices = { day: 290, month: 1290, year: 7900 }
    const names = { day: '日卡', month: '月卡', year: '年卡' }
    const limits = { day: '10张/24小时', month: '50张/30天', year: '300张/365天' }
    
    wx.showModal({
      title: `确认购买${names[plan]}`,
      content: `¥${(prices[plan] / 100).toFixed(1)} · 上限${limits[plan]}\n立即开通VIP${names[plan]}`,
      confirmText: '确认支付',
      cancelText: '再想想',
      confirmColor: '#C41E3A',
      success: (res) => {
        if (res.confirm) {
          this.processPayment(plan, prices[plan])
        }
      }
    })
  },

  processPayment(plan, amount) {
    // 检测是否是占位符域名（后端未部署）
    const isPlaceholder = app.globalData.apiBase.includes('example.com')
    if (isPlaceholder) {
      wx.showModal({
        title: '后端未部署',
        content: '支付功能需要后端服务器。\n当前为 Demo 模式，VIP 功能已本地模拟开启（24小时）。\n\n正式上线前请先部署后端服务。',
        confirmText: '模拟开通',
        cancelText: '知道了',
        confirmColor: '#C41E3A',
        success: (res) => {
          if (res.confirm) {
            // Demo 模式：本地模拟开通 VIP
            const expire = new Date()
            const startTime = new Date().toISOString()
            if (plan === 'day') expire.setDate(expire.getDate() + 1)
            else if (plan === 'month') expire.setMonth(expire.getMonth() + 1)
            else if (plan === 'year') expire.setFullYear(expire.getFullYear() + 1)

            wx.setStorageSync('vipInfo', {
              type: plan,
              startTime: startTime,
              expire: expire.toISOString()
            })
            app.globalData.isVip = true
            app.globalData.vipType = plan
            app.globalData.vipExpire = expire.toISOString()

            this.loadUserInfo()
            this.loadStats()

            wx.showToast({ title: 'Demo 模式：VIP 已模拟开通', icon: 'none', duration: 2000 })
          }
        }
      })
      return
    }

    wx.showLoading({ title: '支付中...' })
    
    // 调用后端创建支付订单
    wx.request({
      url: app.globalData.apiBase + '/api/pay',
      method: 'POST',
      data: {
        plan: plan,
        amount: amount,
        openId: app.globalData.openId
      },
      success: (res) => {
        if (res.data && res.data.payParams) {
          // 调起微信支付
          wx.requestPayment({
            ...res.data.payParams,
            success: () => {
              wx.hideLoading()
              // 更新VIP状态
              const expire = new Date()
              const startTime = new Date().toISOString()
              if (plan === 'day') expire.setDate(expire.getDate() + 1)
              else if (plan === 'month') expire.setMonth(expire.getMonth() + 1)
              else if (plan === 'year') expire.setFullYear(expire.getFullYear() + 1)
              
              wx.setStorageSync('vipInfo', {
                type: plan,
                startTime: startTime,
                expire: expire.toISOString()
              })
              app.globalData.isVip = true
              app.globalData.vipType = plan
              app.globalData.vipExpire = expire.toISOString()
              
              this.loadUserInfo()
              this.loadStats()
              
              wx.showToast({ title: '开通成功！', icon: 'success' })
            },
            fail: () => {
              wx.hideLoading()
              wx.showToast({ title: '支付取消', icon: 'none' })
            }
          })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  showAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '《富贵花开》小程序用户服务协议...',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私。上传的照片仅用于AI美化处理，不会存储或用于其他用途。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 🔧 开发调试：连击头像 5 次重置免费额度
  onAvatarTap() {
    let count = (this.data._avatarTapCount || 0) + 1
    this.setData({ _avatarTapCount: count })
    if (count >= 5) {
      this.setData({ _avatarTapCount: 0 })
      wx.setStorageSync('freeStylesUsed', [])
      const app = getApp()
      app.globalData.freeStylesUsed = []
      this.loadStats()
      wx.showToast({ title: '✅ 免费额度已重置', icon: 'none', duration: 1500 })
    } else if (count >= 3) {
      wx.showToast({ title: `再点 ${5 - count} 次重置额度`, icon: 'none', duration: 800 })
    }
  }
})
