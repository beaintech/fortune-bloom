// pages/index/index.js
const app = getApp()

// 🔧 正式模式 - 走微信云托管后端，AI引擎: 腾讯混元生图
const DEBUG_MODE = false

// AI 风格化统一通过微信云托管后端代理（腾讯混元 ImageToImage）
// 前端只需传 style ID，后端负责映射到混元风格参数
const STYLE_NAMES = {
  peony: '牡丹富贵', golden: '金玉满堂', ink: '水墨丹青',
  cloud: '祥云仙气', classic: '古典年画'
}

Page({
  data: {
    previewImage: '',
    selectedStyle: 'peony',
    remainingCount: 0,
    isVip: false,
    vipLimitText: '',
    generating: false,
    styles: [
      { id: 'peony', name: '牡丹富贵', emoji: '🌸', color: '#FFE4E1' },
      { id: 'golden', name: '金玉满堂', emoji: '✨', color: '#FFF8DC' },
      { id: 'ink', name: '水墨丹青', emoji: '🖌️', color: '#F0F0F0' },
      { id: 'cloud', name: '祥云仙气', emoji: '☁️', color: '#F0F8FF' },
      { id: 'classic', name: '古典年画', emoji: '🏮', color: '#FFF0F5' }
    ],
    demos: []
  },

  onShow() {
    this.updateCount()
  },

  updateCount() {
    // 🔧 测试模式
    if (DEBUG_MODE) {
      const styles = this.data.styles.map(s => ({ ...s, isFree: true }))
      this.setData({
        remainingCount: '🔧测试',
        isVip: false,
        vipLimitText: '测试模式 - 不限次数',
        styles
      })
      return
    }

    const isVip = app.globalData.isVip
    let remaining = app.getRemainingCount()
    let vipLimitText = ''

    if (isVip) {
      const vip = wx.getStorageSync('vipInfo') || {}
      const type = vip.type || 'day'
      const limits = { day: 10, month: 50, year: 300 }
      const limit = limits[type] || 10
      const used = app.getVipUsedCount()
      const left = Math.max(0, limit - used)
      vipLimitText = `今日剩余 ${left}/${limit} 张`
      remaining = left
    }

    const styles = this.data.styles.map(s => ({
      ...s,
      isFree: app.canUseFree(s.id)
    }))
    this.setData({
      remainingCount: remaining,
      isVip: isVip,
      vipLimitText,
      styles
    })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ previewImage: res.tempFilePaths[0] })
      }
    })
  },

  selectStyle(e) {
    this.setData({ selectedStyle: e.currentTarget.dataset.id })
  },

  watchAd() {
    const adUnitId = 'adunit-xxxxxxxx'
    const rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId })

    rewardedVideoAd.onError(() => {
      wx.showToast({ title: '广告加载失败，请重试', icon: 'none' })
    })

    rewardedVideoAd.onClose((res) => {
      if (res && res.isEnded) {
        this.doGenerate(true)
      } else {
        wx.showToast({ title: '需要看完广告才能解锁哦', icon: 'none' })
      }
    })

    rewardedVideoAd.show().catch(() => {
      rewardedVideoAd.load()
        .then(() => rewardedVideoAd.show())
        .catch(() => wx.showToast({ title: '广告暂时不可用', icon: 'none' }))
    })
  },

  startGenerate() {
    if (this.data.generating) return
    if (!this.data.previewImage) {
      wx.showToast({ title: '请先选择照片', icon: 'none' })
      return
    }

    // 🔧 测试模式：跳过所有限制，直接生成
    if (DEBUG_MODE) {
      this.doGenerate(false)
      return
    }

    if (app.globalData.isVip) {
      if (app.isVipLimitReached()) {
        const vip = wx.getStorageSync('vipInfo') || {}
        const typeNames = { day: '日卡', month: '月卡', year: '年卡' }
        const typeName = typeNames[vip.type] || '会员'
        wx.showModal({
          title: `${typeName}额度已用完`,
          content: '本次会员周期内生成次数已达上限。\n可续费升级，或等下一周期重置。',
          confirmText: '立即续费',
          cancelText: '知道了',
          confirmColor: '#C41E3A',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/profile/profile' })
            }
          }
        })
        return
      }
      this.doGenerate(false)
      return
    }

    const styleId = this.data.selectedStyle

    if (app.canUseFree(styleId)) {
      this.doGenerate(false)
      return
    }

    wx.showModal({
      title: '免费试用已用完',
      content: '🌸 看一段广告即可解锁 1 次生成\n💎 开会员高额度畅享，免广告',
      confirmText: '¥2.9 开会员',
      cancelText: '看广告解锁',
      confirmColor: '#C41E3A',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/profile/profile' })
        } else {
          this.watchAd()
        }
      }
    })
  },

  // ========== 主生成入口 ==========
  doGenerate(isAdUnlock) {
    const styleId = this.data.selectedStyle
    this.setData({ generating: true })

    // ✅ 生产模式：统一走云托管后端（腾讯混元生图）
    if (DEBUG_MODE || app.globalData.apiBase.includes('example.com')) {
      this.generateDirectly(styleId, isAdUnlock)
    } else {
      this.generateViaBackend(styleId, isAdUnlock)
    }
  },

  // ========== 直连模式（已废弃，统一走后端）==========
  generateDirectly(styleId, isAdUnlock) {
    wx.showToast({ title: '请关闭测试模式，使用后端服务', icon: 'none' })
    this.setData({ generating: false })
  },

  // 生成完成后的公共处理
  afterGenerate(styleId, isAdUnlock, resultPath) {
    // 🔧 测试模式：不标记使用，不限次数
    if (!DEBUG_MODE) {
      if (!app.globalData.isVip && !isAdUnlock) {
        app.markStyleUsed(styleId)
      }
      if (app.globalData.isVip) {
        app.recordGeneration()
      }
    }

    const history = wx.getStorageSync('gallery') || []
    history.unshift({
      id: Date.now(),
      original: this.data.previewImage,
      result: resultPath,
      style: styleId,
      time: new Date().toLocaleString()
    })
    wx.setStorageSync('gallery', history.slice(0, 50))

    this.setData({ generating: false })
    this.updateCount()

    wx.navigateTo({
      url: '/pages/result/result?imageUrl=' + encodeURIComponent(resultPath) + '&style=' + styleId
    })
  },

  // ========== 通过后端代理调用腾讯混元（正式模式）==========
  generateViaBackend(styleId, isAdUnlock) {
    wx.uploadFile({
      url: app.globalData.apiBase + '/api/generate',
      filePath: this.data.previewImage,
      name: 'image',
      formData: {
        style: styleId,
        openId: app.globalData.openId || ''
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.success) {
          this.afterGenerate(styleId, isAdUnlock, data.resultUrl)
        } else {
          wx.showToast({ title: data.message || '生成失败', icon: 'none' })
          this.setData({ generating: false })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误，请重试', icon: 'none' })
        this.setData({ generating: false })
      }
    })
  }
})
