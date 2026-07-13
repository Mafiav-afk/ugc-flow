export function userErrorMessage(message) {
  const text = String(message || '操作失败').replace(/\s+/g, ' ').trim()
  if (/only supports image-to-video|one reference image is required|reference image.+required/i.test(text)) {
    return '当前视频模型仅支持图生视频。请上传 1 张参考图或填写公网图片 URL；如需无图生成，请改用文生视频模型。'
  }
  if (text.length <= 220) return text
  return `${text.slice(0, 196).trim()}… 请检查 API 接入配置。`
}
