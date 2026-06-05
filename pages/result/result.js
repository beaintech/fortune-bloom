// pages/result/result.js
const app = getApp()

Page({
  data: {
    resultUrl: '',
    style: '',
    isVip: false,
    showShareTip: false,
    styleNames: {
      peony: '牡丹富贵',
      golden: '金玉满堂',
      ink: '水墨丹青',
      cloud: '祥云仙气',
      classic: '古典年画'
    }
  },

  onLoad(options) {
    const imageUrl = decodeURIComponent(options.imageUrl || '')
    const style = options.style || 'peony'
    
    this.setData({
      resultUrl: imageUrl,
      style: style,
      isVip: app.globalData.isVip
    })

    // 延迟显示分享提示
    setTimeout(() => {
      this.setData({ showShareTip: true })
    }, 2000)
  },

  // 保存到相册
  saveImage() {
    wx.showLoading({ title: '保存中...' })
    
    // 先下载远程图片
    wx.downloadFile({
      url: this.data.resultUrl,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading()
            wx.showToast({ title: '已保存到相册', icon: 'success' })
            this.setData({ showShareTip: true })
          },
          fail: () => {
            wx.hideLoading()
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许小程序保存图片到相册',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting()
                }
              }
            })
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  },

  // 分享配置
  onShareAppMessage() {
    return {
      title: `我用「富贵花开」生成了一张${this.data.styleNames[this.data.style] || ''}美照，你也来试试！`,
      imageUrl: this.data.resultUrl,
      path: '/pages/index/index'
    }
  },

  goGenerate() {
    wx.navigateBack()
  },

  goGallery() {
    wx.switchTab({ url: '/pages/gallery/gallery' })
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  }
})
