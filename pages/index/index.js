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
    this.setData({
      remainingCount: remaining,
      isVip: app.globalData.isVip
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

  // 开始生成
  startGenerate() {
    if (this.data.generating) return
    if (!this.data.previewImage) {
      wx.showToast({ title: '请先选择照片', icon: 'none' })
      return
    }

    // 检查次数
    if (!app.globalData.isVip && app.globalData.freeCount <= 0) {
      wx.showModal({
        title: '今日免费次数已用完',
        content: '升级VIP即可无限使用，每日只需几毛钱',
        confirmText: '立即开通',
        cancelText: '明天再来',
        confirmColor: '#C41E3A',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile/profile' })
          }
        }
      })
      return
    }

    this.setData({ generating: true })

    // 上传图片到后端
    wx.uploadFile({
      url: app.globalData.apiBase + '/api/generate',
      filePath: this.data.previewImage,
      name: 'image',
      formData: {
        style: this.data.selectedStyle,
        openId: app.globalData.openId || ''
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.success) {
          app.useFreeCount()
          
          // 保存到本地
          const history = wx.getStorageSync('gallery') || []
          history.unshift({
            id: Date.now(),
            original: this.data.previewImage,
            result: data.resultUrl,
            style: this.data.selectedStyle,
            time: new Date().toLocaleString()
          })
          wx.setStorageSync('gallery', history.slice(0, 50))
          
          // 跳转结果页
          wx.navigateTo({
            url: `/pages/result/result?imageUrl=${encodeURIComponent(data.resultUrl)}&style=${this.data.selectedStyle}`
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
