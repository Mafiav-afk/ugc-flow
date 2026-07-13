const asList = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []

export function mediaParamsFor({ kind, model, references = [], overrides = {} }) {
  const id = String(model || '').toLowerCase()
  const images = asList(references).slice(0, 9)
  let params
  if (kind === 'image') {
    params = { size: 'auto', quality: 'auto', n: 1, response_format: 'url', aspect_ratio: '9:16' }
    if (images.length) params.images = images.slice(0, 14)
  } else if (/grok.*(?:video|imagine)/i.test(id)) {
    params = { aspect_ratio: '9:16', resolution: '720p', duration: '15' }
    if (images.length) params.images = images[0]
  } else if (/sora/i.test(id)) {
    params = { duration: '12', orientation: 'portrait', aspect_ratio: '9:16', size: '720x1280', seconds: '12' }
    if (images.length) params.input_reference = images[0]
  } else if (/(?:kwvideo|seedance|jimeng)/i.test(id)) {
    params = { version: '快速', duration: '15', aspect_ratio: '9:16', resolution: '720p' }
    if (images.length) params.images = images.slice(0, 9)
  } else if (/happyhorse/i.test(id)) {
    params = { resolution: '720P', ratio: '9:16', duration: '15' }
  } else if (/kling/i.test(id)) {
    params = { duration: '15', mode: 'std', aspect_ratio: '9:16' }
    if (images.length) params.images = images.slice(0, 2)
  } else if (/wan(?:2|x)?[.-]?\d|wanxiang/i.test(id)) {
    params = { resolution: '720P', duration: '15', prompt_extend: true, ratio: '9:16' }
    if (images.length) { params.reference_urls = images.slice(0, 5); params._mode = 'wan2.7-r2v' }
  } else {
    params = { aspect_ratio: '9:16', duration: '15', resolution: '720p' }
    if (images.length) params.images = images
  }
  return { ...params, ...overrides }
}

export function parseParamsJson(value) {
  if (!String(value || '').trim()) return {}
  const parsed = JSON.parse(value)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('媒体参数覆盖必须是 JSON 对象')
  return parsed
}

export function configuredVideoParams(config, model) {
  const configuredModel = String(config.videoModels || config.videoModel || '').split(/[\n,，]/).map((item) => item.trim()).find(Boolean)
  const inferredProfile = getVideoModelProfile(model)
  const profileOverride = configuredModel === model && (config.videoProfile === 'custom' || config.videoProfile === inferredProfile.id) ? config.videoProfile : ''
  return videoSelectionParams(model, { duration: config.videoDuration, resolution: config.videoResolution, aspectRatio: config.videoAspectRatio, mode: config.videoMode }, profileOverride)
}
import { getVideoModelProfile, videoSelectionParams } from '../shared/video-models.mjs'
