// pages/gallery/gallery.js
Page({
  data: {
    list: [],
    hasMore: false,
    styleNames: {
      peony: '牡丹富贵',
      golden: '金玉满堂',
      ink: '水墨丹青',
      cloud: '祥云仙气',
      classic: '古典年画'
    }
  },

  onShow() {
    this.loadGallery()
  },

  loadGallery() {
    let list = wx.getStorageSync('gallery') || []
    // 清理无效/失败的记录（旧版可能存了空白路径）
    list = list.filter(item => item.result && item.result !== '/static/demo-result.jpg')
    wx.setStorageSync('gallery', list)
    this.setData({ list: list.slice(0, 30) })
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index
    const urls = this.data.list.map(item => item.result)
    wx.previewImage({
      current: urls[index],
      urls: urls
    })
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除作品',
      content: '确定要删除这张作品吗？',
      confirmColor: '#C41E3A',
      success: (res) => {
        if (res.confirm) {
          const list = wx.getStorageSync('gallery') || []
          const newList = list.filter(item => item.id !== id)
          wx.setStorageSync('gallery', newList)
          this.loadGallery()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
