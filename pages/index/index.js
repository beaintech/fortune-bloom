// pages/index/index.js
const app = getApp()

Page({
  data: {
    previewImage: '',
    selectedStyle: 'peony',
    remainingCount: 0,
    isVip: false,
    vipLimitText: '',   // VIP剩余额度文字
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

    // VIP 用户：检查上限
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
    
    // 该风格还有免费次数
    if (app.canUseFree(styleId)) {
      this.doGenerate(false)
      return
    }

    // 免费次数用完 → 弹窗：看广告或开会员
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

  // 执行生成
  doGenerate(isAdUnlock) {
    const styleId = this.data.selectedStyle
    this.setData({ generating: true })

    // 检测是否是占位符域名（后端未部署）
    const isPlaceholder = app.globalData.apiBase.includes('example.com')

    if (isPlaceholder) {
      // ===== Demo 模式：后端未部署，模拟生成过程 =====
      wx.showLoading({ title: 'AI 生成中...', mask: true })

      // 模拟3秒生成时间
      setTimeout(() => {
        wx.hideLoading()

        // 免费使用才标记（VIP 不标记，广告解锁不标记）
        if (!app.globalData.isVip && !isAdUnlock) {
          app.markStyleUsed(styleId)
        }

        // VIP 用户记录生成次数
        if (app.globalData.isVip) {
          app.recordGeneration()
        }

        // 用原图作为"结果图"（demo 模式下预览图即结果）
        const resultUrl = this.data.previewImage

        // 保存到本地历史
        const history = wx.getStorageSync('gallery') || []
        history.unshift({
          id: Date.now(),
          original: this.data.previewImage,
          result: resultUrl,
          style: styleId,
          time: new Date().toLocaleString(),
          isDemo: true
        })
        wx.setStorageSync('gallery', history.slice(0, 50))

        this.setData({ generating: false })
        this.updateCount()

        // 跳转结果页
        wx.navigateTo({
          url: `/pages/result/result?imageUrl=${encodeURIComponent(resultUrl)}&style=${styleId}&demo=1`
        })
      }, 3000)
      return
    }

    // ===== 真实模式：调用后端 API =====
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
          
          // VIP 用户记录生成次数
          if (app.globalData.isVip) {
            app.recordGeneration()
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
          this.setData({ generating: false })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误，请重试', icon: 'none' })
        this.setData({ generating: false })
      },
      complete: () => {
        // 只在真实模式下在 complete 里更新（demo 模式在 setTimeout 里更新）
        if (!isPlaceholder) {
          this.setData({ generating: false })
          this.updateCount()
        }
      }
    })
  }
})
