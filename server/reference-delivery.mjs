import crypto from 'node:crypto'

const publicUrl = (value) => /^https?:\/\//i.test(String(value || ''))
const uploadCache = new Map()
const UPLOAD_CACHE_TTL = 30 * 60 * 1000

function readPath(data, path) {
  return String(path || '').split('.').filter(Boolean).reduce((value, key) => value?.[key], data)
}

function extractUrl(data, preferredPath = '') {
  const preferred = preferredPath ? readPath(data, preferredPath) : null
  const values = [preferred, data?.url, data?.data?.url, data?.result?.url, data?.file?.url, data?.location, data?.data?.location]
  return values.find(publicUrl) || null
}

function authHeaders(config) {
  const key = config.referenceUploadApiKey || config.videoApiKey || config.apiKey
  if (!key) return {}
  const mode = config.referenceUploadAuthMode || 'bearer'
  if (mode === 'x-api-key') return { 'x-api-key': key }
  if (mode === 'none') return {}
  if (mode === 'custom') return { [config.referenceUploadAuthHeader || 'Authorization']: `${config.referenceUploadAuthPrefix || ''}${key}` }
  return { Authorization: `Bearer ${key}` }
}

function decodeDataUrl(value) {
  const match = String(value || '').match(/^data:([^;,]+);base64,(.+)$/s)
  if (!match) throw new Error('本地参考图不是有效的 base64 data URL')
  return { mime: match[1], bytes: Buffer.from(match[2], 'base64') }
}

function automaticUploadUrls(config) {
  const base = String(config.imageBaseUrl || config.videoBaseUrl || config.baseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return []
  if (/\/v1$/i.test(base)) return [`${base}/uploads/images`]
  return [`${base}/v1/uploads/images`, `${base}/uploads/images`]
}

export async function deliverReferenceImage(config, value, signal) {
  if (!value || publicUrl(value)) return { url: value || null, mode: value ? 'public-url' : 'none' }
  if (!String(value).startsWith('data:')) throw new Error('参考图既不是公网 URL，也不是可上传的 data URL')
  const uploadUrls = config.referenceUploadUrl ? [config.referenceUploadUrl] : automaticUploadUrls(config)
  if (!uploadUrls.length) return { url: value, mode: 'local-data' }

  const protocol = config.referenceUploadProtocol || 'multipart'
  const decoded = decodeDataUrl(value)
  const uploadCacheKey = `${uploadUrls.join('|')}|${crypto.createHash('sha256').update(decoded.bytes).digest('hex')}`
  const cachedUpload = uploadCache.get(uploadCacheKey)
  if (cachedUpload && Date.now() - cachedUpload.at < UPLOAD_CACHE_TTL) return { url: cachedUpload.url, mode: 'upload-cache' }
  const headers = authHeaders(config)
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120_000)
  const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  try {
    for (const uploadUrl of uploadUrls) {
      const nextHeaders = { ...headers }; let body
      if (protocol === 'json') { nextHeaders['content-type'] = 'application/json'; body = JSON.stringify({ [config.referenceUploadField || 'data_url']: value }) }
      else if (protocol === 'put') { nextHeaders['content-type'] = decoded.mime; body = decoded.bytes }
      else { const form = new FormData(); form.append(config.referenceUploadField || 'file', new Blob([decoded.bytes], { type: decoded.mime }), config.referenceUploadFilename || 'ugc-reference.jpg'); if (!config.referenceUploadUrl) form.append('purpose', 'generation'); body = form }
      const response = await fetch(uploadUrl, { method: protocol === 'put' ? 'PUT' : 'POST', headers: nextHeaders, body, signal: requestSignal })
      const text = await response.text(); let data
      try { data = text ? JSON.parse(text) : {} } catch { data = { url: response.headers.get('location') || text.trim() } }
      if (!response.ok) { if (!config.referenceUploadUrl && [404, 405].includes(response.status)) continue; throw new Error(data?.error?.message || data?.error || data?.message || `参考图上传失败 (${response.status})`) }
      const url = protocol === 'put' && config.referenceUploadPublicUrl ? config.referenceUploadPublicUrl : extractUrl(data, config.referenceUploadResponsePath)
      if (!publicUrl(url)) { if (!config.referenceUploadUrl) continue; throw new Error('上传成功，但响应中没有可识别的公网图片 URL；请设置“返回 URL 字段路径”') }
      uploadCache.set(uploadCacheKey, { at: Date.now(), url })
      return { url, mode: config.referenceUploadUrl ? `upload-${protocol}` : 'upload-auto' }
    }
    return { url: value, mode: 'local-data' }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('参考图上传超时')
    throw error
  } finally { clearTimeout(timer) }
}

export const isPublicReferenceUrl = publicUrl
