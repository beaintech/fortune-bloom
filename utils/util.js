// utils/util.js - 通用工具
const formatTime = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`
}

const pad = (n) => n < 10 ? '0' + n : n

// 图片压缩
const compressImage = (src, quality = 80) => {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: src,
      quality: quality,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    })
  })
}

module.exports = {
  formatTime,
  compressImage
}
