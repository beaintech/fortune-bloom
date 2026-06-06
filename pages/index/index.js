// pages/index/index.js
const app = getApp()

Page({
  data: {
    previewImage: '',
    selectedStyle: 'peony',
    remainingCount: 0,
    isVip: false,
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
    const remaining = app.getRemainingCount()
    const styles = this.data.styles.map(s => ({
      ...s,
      isFree: app.canUseFree(s.id)
    }))
    this.setData({
      remainingCount: remaining,
      isVip: app.globalData.isVip,
      styles
    })
  },

  // 选择图片
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

  // 选择风格
  selectStyle(e) {
    this.setData({ selectedStyle: e.currentTarget.dataset.id })
  },

  // 看广告解锁
  watchAd() {
    const adUnitId = 'adunit-xxxxxxxx' // TODO: 替换为你的激励视频广告单元ID
    const rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId })
    
    rewardedVideoAd.onError(() => {
      wx.showToast({ title: '广告加载失败，请重试', icon: 'none' })
    })
    
    rewardedVideoAd.onClose((res) => {
      if (res && res.isEnded) {
        // 广告看完，允许生成一张
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

  // 开始生成
  startGenerate() {
    if (this.data.generating) return
    if (!this.data.previewImage) {
      wx.showToast({ title: '请先选择照片', icon: 'none' })
      return
    }

    // VIP 直接生成
    if (app.globalData.isVip) {
      this.doGenerate(false)
      return
    }

    const styleId = this.data.selectedStyle
    
    // 该风格还有免费次数
    if (app.canUseFree(styleId)) {
      this.doGenerate(false)
      return
    }

    // 免费次数用完 → 弹窗：看广告或开会员
    wx.showModal({
      title: '免费试用已用完',
      content: '🌸 看一段广告即可解锁 1 次生成\n💎 开会员无限畅享，免广告',
      confirmText: '¥1.9 开会员',
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

  // 执行生成
  doGenerate(isAdUnlock) {
    const styleId = this.data.selectedStyle
    this.setData({ generating: true })

    // 上传图片到后端
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
          // 免费使用才标记（VIP 不标记，广告解锁不标记）
          if (!app.globalData.isVip && !isAdUnlock) {
            app.markStyleUsed(styleId)
          }
          
          // 保存到本地
          const history = wx.getStorageSync('gallery') || []
          history.unshift({
            id: Date.now(),
            original: this.data.previewImage,
            result: data.resultUrl,
            style: styleId,
            time: new Date().toLocaleString()
          })
          wx.setStorageSync('gallery', history.slice(0, 50))
          
          // 跳转结果页
          wx.navigateTo({
            url: `/pages/result/result?imageUrl=${encodeURIComponent(data.resultUrl)}&style=${styleId}`
          })
        } else {
          wx.showToast({ title: data.message || '生成失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误，请重试', icon: 'none' })
      },
      complete: () => {
        this.setData({ generating: false })
        this.updateCount()
      }
    })
  }
})
