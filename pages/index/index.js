// pages/index/index.js
const app = getApp()

// ⚠️ 测试用：通义万相 API Key 写在前端（正式上线必须走后端）
const DASHSCOPE_API_KEY = 'sk-f965b5c203c04c00bd4a9bfbeb05b188'
const DASHSCOPE_GEN_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation'
const DASHSCOPE_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks'

// 风格提示词
const STYLE_PROMPTS = {
  peony: '将这张照片转化为华丽的中国传统花卉风格。背景是盛开的牡丹花丛，搭配大红色和金色的华丽边框。整体色调以中国红和金色为主，添加富贵华丽的装饰元素。画面明亮、喜庆、富贵。人脸保持自然清晰，服装和背景整体美化。',
  golden: '将这张照片转化为金碧辉煌的风格。金色祥云背景，金色边框装饰。整体呈温暖的金色调，如同置身金色宫殿。加入金色光芒、钱币、元宝等象征财富的元素。画面富丽堂皇但不过分夸张。',
  ink: '将这张照片转化为优雅的中国水墨画风格。背景为淡淡的水墨渲染，留白有致。颜色以黑白灰为主，点缀少量朱红。人物轮廓用水墨笔触勾勒，气质优雅文艺。画面宁静致远，有文人气息。',
  cloud: '将这张照片转化为仙气飘飘的祥云风格。背景是蓝天白云和缭绕的仙气，画面清新淡雅。加入祥云、仙鹤、远山等元素。整体色调柔和明亮，给人一种祥和、好运的感觉。',
  classic: '将这张照片转化为喜庆的中国传统年画风格。大红底色，金色纹样边框。人物面容红润喜庆，服装华丽。加入牡丹、福字、如意等传统吉祥元素。画面饱满、热闹、喜庆，有浓郁的中国年味。'
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

    const isPlaceholder = app.globalData.apiBase.includes('example.com')

    if (isPlaceholder) {
      this.generateDirectly(styleId, isAdUnlock)
    } else {
      this.generateViaBackend(styleId, isAdUnlock)
    }
  },

  // ========== 直连通义万相 API（测试用）==========
  generateDirectly(styleId, isAdUnlock) {
    const stylePrompt = STYLE_PROMPTS[styleId] || STYLE_PROMPTS.peony
    const fs = wx.getFileSystemManager()

    wx.showLoading({ title: 'AI 生成中...', mask: true })

    fs.readFile({
      filePath: this.data.previewImage,
      encoding: 'base64',
      success: (readRes) => {
        const base64 = 'data:image/jpeg;base64,' + readRes.data

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
            model: 'wanx-style-cosplay-v1',
            input: {
              base_image: base64,
              ref_image: base64,
              style_index: 0
            },
            parameters: {
              prompt: stylePrompt,
              negative_prompt: '模糊, 扭曲, 变形, 丑陋, 恐怖, 暗黑, 悲伤',
              size: '1024*1024'
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
    if (!app.globalData.isVip && !isAdUnlock) {
      app.markStyleUsed(styleId)
    }
    if (app.globalData.isVip) {
      app.recordGeneration()
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
