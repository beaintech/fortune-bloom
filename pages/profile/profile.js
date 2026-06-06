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
    // 计算今日生成数
    const today = new Date().toLocaleDateString()
    const todayCount = gallery.filter(item => {
      return item.time && item.time.startsWith(today)
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
  }
})
