// pages/index/index.js
const app = getApp()

// 🔧 测试模式 - 已关闭，走微信云托管后端
const DEBUG_MODE = false

// ⚠️ API Key 已移至后端，前端不再需要
// 通义万相调用统一通过微信云托管后端代理
const DASHSCOPE_API_KEY = ''
const DASHSCOPE_GEN_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation'
const DASHSCOPE_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks'

// 风格 → 预置 style_index 映射
const STYLE_INDEX_MAP = {
  peony: 14,     // 国风工笔 → 对应牡丹富贵
  golden: 8,     // 清雅国风 → 对应金玉满堂
  ink: 5,        // 国画古风 → 对应水墨丹青
  cloud: 3,      // 小清新   → 对应祥云仙气
  classic: 9     // 喜迎新年 → 对应古典年画
}

// 风格中文名
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

    // 🔧 测试模式 / 后端未部署 → 直连通义万相
    // Render.com 从国内访问很慢/不可达，测试时统一走直连
    if (DEBUG_MODE || app.globalData.apiBase.includes('example.com')) {
      this.generateDirectly(styleId, isAdUnlock)
    } else {
      this.generateViaBackend(styleId, isAdUnlock)
    }
  },

  // ========== 直连通义万相 API（测试用）==========
  generateDirectly(styleId, isAdUnlock) {
    const styleIndex = STYLE_INDEX_MAP[styleId] || 14
    const styleName = STYLE_NAMES[styleId] || '牡丹富贵'
    const fs = wx.getFileSystemManager()

    wx.showLoading({ title: `AI ${styleName}风格...`, mask: true })

    fs.readFile({
      filePath: this.data.previewImage,
      encoding: 'base64',
      success: (readRes) => {
        const imageBase64 = 'data:image/jpeg;base64,' + readRes.data

        // === 调用 wanx-style-repaint-v1（人像风格重绘）===
        // 免费额度: 500张/90天 | 超量: ¥0.12/张
        wx.request({
          url: DASHSCOPE_GEN_URL,
          method: 'POST',
          timeout: 120000,
          header: {
            'Authorization': 'Bearer ' + DASHSCOPE_API_KEY,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable'
          },
          data: {
            model: 'wanx-style-repaint-v1',
            input: {
              image_url: imageBase64,   // 支持 base64 格式
              style_index: styleIndex   // 预置风格索引
            }
          },
          success: (apiRes) => {
            console.log('[通义万相] 状态码:', apiRes.statusCode)
            console.log('[通义万相] 响应:', JSON.stringify(apiRes.data).substring(0, 300))

            if (apiRes.statusCode === 200 && apiRes.data && apiRes.data.output && apiRes.data.output.task_id) {
              const taskId = apiRes.data.output.task_id
              this.pollTask(taskId, styleId, isAdUnlock)
            } else {
              wx.hideLoading()
              const errMsg = (apiRes.data && (apiRes.data.message || apiRes.data.errmsg)) || ('HTTP ' + (apiRes.statusCode || '无响应'))
              wx.showModal({
                title: 'API 调用失败',
                content: errMsg + '\n\n请检查：\n1. API Key 是否正确\n2. 开发者工具是否勾选"不校验合法域名"',
                showCancel: false
              })
              this.setData({ generating: false })
              console.error('[通义万相] 提交失败:', apiRes.data)
            }
          },
          fail: (err) => {
            wx.hideLoading()
            wx.showModal({
              title: '网络请求失败',
              content: '无法连接通义万相 API。\n\n错误: ' + (err.errMsg || JSON.stringify(err)) + '\n\n如果在微信开发者工具中测试，请确保已勾选"不校验合法域名"。',
              showCancel: false
            })
            this.setData({ generating: false })
            console.error('[通义万相] 请求失败:', err)
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '读取图片失败', icon: 'none' })
        this.setData({ generating: false })
      }
    })
  },

  // 轮询异步任务结果
  pollTask(taskId, styleId, isAdUnlock, retries) {
    retries = retries || 40

    if (retries <= 0) {
      wx.hideLoading()
      wx.showToast({ title: '生成超时，请重试', icon: 'none' })
      this.setData({ generating: false })
      return
    }

    wx.request({
      url: DASHSCOPE_TASK_URL + '/' + taskId,
      method: 'GET',
      timeout: 30000,
      header: {
        'Authorization': 'Bearer ' + DASHSCOPE_API_KEY
      },
      success: (res) => {
        const output = res.data && res.data.output
        if (!output) {
          console.log('[通义万相] 轮询响应异常:', res.data)
          setTimeout(() => {
            this.pollTask(taskId, styleId, isAdUnlock, retries - 1)
          }, 2000)
          return
        }

        const status = output.task_status
        if (status === 'SUCCEEDED') {
          const resultUrl = output.results && output.results[0] && output.results[0].url
          if (resultUrl) {
            this.onAiSuccess(resultUrl, styleId, isAdUnlock)
          } else {
            wx.hideLoading()
            wx.showToast({ title: '生成结果异常', icon: 'none' })
            this.setData({ generating: false })
          }
        } else if (status === 'FAILED') {
          wx.hideLoading()
          const errMsg = (output.err_msg) ? output.err_msg : '未知错误'
          wx.showModal({
            title: 'AI 生成失败',
            content: '错误: ' + errMsg,
            showCancel: false
          })
          this.setData({ generating: false })
          console.error('[通义万相] 任务失败:', res.data)
        } else {
          setTimeout(() => {
            this.pollTask(taskId, styleId, isAdUnlock, retries - 1)
          }, 2000)
        }
      },
      fail: (err) => {
        console.log('[通义万相] 轮询请求失败:', err)
        setTimeout(() => {
          this.pollTask(taskId, styleId, isAdUnlock, retries - 1)
        }, 2000)
      }
    })
  },

  // AI 生成成功 → 下载结果图
  onAiSuccess(resultUrl, styleId, isAdUnlock) {
    wx.downloadFile({
      url: resultUrl,
      success: (dlRes) => {
        wx.hideLoading()
        this.afterGenerate(styleId, isAdUnlock, dlRes.tempFilePath)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '下载结果失败', icon: 'none' })
        this.setData({ generating: false })
      }
    })
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

  // ========== 通过后端代理调用（正式上线用）==========
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
