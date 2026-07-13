const DEFAULT_TIMEOUT = 90_000
const ENDPOINT_CACHE_TTL = 30 * 60 * 1000
const successfulEndpointCache = new Map()

export const PROVIDER_PRESETS = {
  openai: {
    label: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', modelsPath: '/models', imagePath: '/images/edits\n/images/generations',
    videoPath: '/videos', videoStatusPath: '/videos/{id}', videoContentPath: '/videos/{id}/content',
    authMode: 'bearer', authHeader: 'Authorization', authPrefix: 'Bearer ',
  },
  compatible: {
    label: '通用兼容 API', baseUrl: '', modelsPath: '/models\n/v1/models',
    imagePath: '/media/generate\n/v1/media/generate\n/images/edits\n/v1/images/edits\n/images/generations\n/v1/images/generations\n/responses',
    imageStatusPath: '/media/status?task_id={id}\n/v1/media/status?task_id={id}\n/skills/task-status?task_id={id}\n/v1/skills/task-status?task_id={id}\n/tasks/{id}',
    videoPath: '/media/generate\n/v1/media/generate\n/videos\n/videos/generations\n/v1/videos\n/v1/videos/generations',
    videoStatusPath: '/media/status?task_id={id}\n/v1/media/status?task_id={id}\n/skills/task-status?task_id={id}\n/v1/skills/task-status?task_id={id}\n/videos/{id}\n/videos/generations/{id}\n/tasks/{id}\n/v1/videos/{id}',
    videoContentPath: '/videos/{id}/content\n/v1/videos/{id}/content',
    authMode: 'bearer', authHeader: 'Authorization', authPrefix: 'Bearer ',
  },
}

const trimSlash = (value = '') => String(value).trim().replace(/\/+$/, '')
const unique = (items) => [...new Set(items.filter(Boolean))]
export const splitPool = (value) => unique(Array.isArray(value) ? value.map(String).map((item) => item.trim()) : String(value || '').split(/[\n,，]/).map((item) => item.trim()))

export function shuffledPool(value, random = Math.random) {
  const items = splitPool(value)
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1)); [items[index], items[swap]] = [items[swap], items[index]]
  }
  return items
}

export function joinUrl(baseUrl, endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint
  const base = trimSlash(baseUrl)
  let path = String(endpoint || '').trim()
  if (/\/v1$/i.test(base) && /^\/v1(?:\/|$)/i.test(path)) path = path.replace(/^\/v1/i, '') || '/'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const safeUrl = (value) => { try { const url = new URL(value); url.search = ''; return url.toString() } catch { return value } }
const errorMessage = (data, status) => data?.error?.message || data?.error || data?.message || data?.msg || data?.detail || data?.data?.详情 || `上游 API 返回 ${status}`

export class UpstreamApiError extends Error {
  constructor(message, { status = 0, url = '', data = null } = {}) { super(message); this.name = 'UpstreamApiError'; this.status = status; this.url = safeUrl(url); this.data = data }
}

export function scopedConfig(config, kind) {
  const prefix = kind ? `${kind}` : ''
  return {
    ...config,
    baseUrl: config[`${prefix}BaseUrl`] || config.baseUrl,
    apiKey: config[`${prefix}ApiKey`] || config.apiKey,
    authMode: config[`${prefix}AuthMode`] || config.authMode,
  }
}

function authenticatedRequest(config, url, headers = {}) {
  const nextHeaders = { ...headers }
  const mode = config.authMode || (config.authHeader ? 'custom' : 'bearer')
  if (config.apiKey) {
    if (mode === 'query') { const parsed = new URL(url); parsed.searchParams.set(config.queryKeyName || 'key', config.apiKey); url = parsed.toString() }
    else {
      const names = { bearer: 'Authorization', 'x-api-key': 'x-api-key', 'x-goog-api-key': 'x-goog-api-key' }
      const header = names[mode] || config.authHeader || 'Authorization'
      const prefix = mode === 'bearer' ? 'Bearer ' : mode === 'custom' ? (config.authPrefix ?? '') : ''
      nextHeaders[header] = `${prefix}${config.apiKey}`
    }
  }
  return { url, headers: nextHeaders }
}

export async function requestRaw(config, endpoint, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT)
  const initialHeaders = { 'content-type': 'application/json', ...options.headers }
  if (initialHeaders['content-type'] === undefined) delete initialHeaders['content-type']
  const request = authenticatedRequest(config, joinUrl(config.baseUrl, endpoint), initialHeaders)
  try {
    const response = await fetch(request.url, { ...options, headers: request.headers, signal: options.signal || controller.signal })
    if (!response.ok) {
      const text = await response.text(); let data
      try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text.slice(0, 500) } }
      throw new UpstreamApiError(errorMessage(data, response.status), { status: response.status, url: request.url, data })
    }
    return response
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('上游 API 请求超时')
    if (error instanceof UpstreamApiError) throw error
    const code = error?.cause?.code || error?.code || ''
    const networkMessages = {
      ECONNRESET: '上游连接被重置', ECONNREFUSED: '上游拒绝连接', ENOTFOUND: '无法解析上游域名',
      EAI_AGAIN: '上游域名解析暂时失败', ETIMEDOUT: '上游网络连接超时', UND_ERR_CONNECT_TIMEOUT: '上游网络连接超时',
      UND_ERR_SOCKET: '上游连接意外断开', UND_ERR_HEADERS_TIMEOUT: '等待上游响应头超时',
    }
    if (error instanceof TypeError || code) {
      throw new UpstreamApiError(networkMessages[code] || '无法连接上游 API', {
        status: 503, url: request.url, data: { networkCode: code || 'FETCH_FAILED' },
      })
    }
    throw error
  } finally { clearTimeout(timeout) }
}

export async function requestJson(config, endpoint, options = {}) {
  const response = await requestRaw(config, endpoint, options)
  const text = await response.text()
  if (!text) return {}
  try {
    const data = JSON.parse(text)
    const businessCode = Number(data?.code)
    if (Number.isFinite(businessCode) && businessCode >= 400) throw new UpstreamApiError(errorMessage(data, businessCode), { status: businessCode, url: response.url, data })
    return data
  } catch (error) {
    if (error instanceof UpstreamApiError) throw error
    throw new UpstreamApiError('候选端点返回了非 JSON 数据', { status: response.ok ? 502 : response.status, url: response.url, data: { originalStatus: response.status, raw: text.slice(0, 500) } })
  }
}

const DEFAULT_RETRY_STATUSES = new Set([400, 404, 405, 409, 422, 429, 500, 502, 503, 504])

export async function requestCompatible(config, { endpoints, models, makeOptions, retryStatuses = DEFAULT_RETRY_STATUSES, random = Math.random }) {
  let endpointPool = splitPool(endpoints)
  const modelPool = shuffledPool(models, random)
  if (!endpointPool.length) throw new Error('没有可调用的 API 端点')
  if (!modelPool.length) throw new Error('没有可调用的模型')
  const cacheKey = `${config.baseUrl || ''}|${endpointPool.join('|')}`
  const cacheable = !/^https?:\/\/(?:127(?:\.\d+){3}|localhost|\[::1\])(?::|\/|$)/i.test(config.baseUrl || '')
  const cached = cacheable ? successfulEndpointCache.get(cacheKey) : null
  if (cached && Date.now() - cached.at < ENDPOINT_CACHE_TTL && endpointPool.includes(cached.endpoint)) endpointPool = [cached.endpoint, ...endpointPool.filter((item) => item !== cached.endpoint)]
  const attempts = []
  let lastError
  for (const model of modelPool) {
    for (const endpoint of endpointPool) {
      try {
        const data = await requestJson(config, endpoint.replaceAll('{model}', encodeURIComponent(model)), await makeOptions(model, endpoint))
        if (cacheable) successfulEndpointCache.set(cacheKey, { endpoint, at: Date.now() })
        return { data, model, endpoint, attempts }
      } catch (error) {
        lastError = error
        attempts.push({ model, endpoint, status: error.status || 0, message: error.message })
        if (!(error instanceof UpstreamApiError) || !retryStatuses.has(error.status)) throw error
      }
    }
  }
  const modelFailures = attempts.filter((item) => /model.+(?:not found|disabled|does not exist|unsupported|不可用|不存在|未启用)/i.test(item.message))
  if (modelFailures.length) {
    const failedModels = unique(modelFailures.map((item) => item.model)).join('、')
    throw new Error(`模型不可用：${failedModels}。接口已连接，但该供应商没有启用这些模型；请在 API 接入中读取可用模型或填写供应商实际模型 ID。`)
  }
  const missingImageFailures = attempts.filter((item) => /only supports image-to-video|one reference image is required|reference image.+required|image.+is required/i.test(item.message))
  if (missingImageFailures.length) throw new Error('当前视频模型仅支持图生视频，但上游没有识别到参考图。请上传 1 张图片或填写公网图片 URL，并使用 /videos/generations 接口。')
  const parameterFailure = attempts.find((item) => item.status !== 404 && /seconds?.*(?:supports|integer|invalid)|duration.*(?:integer|invalid|unmarshal|not supported)|resolution.*(?:not supported|available)|ratio.*(?:not valid|invalid)|请求参数不支持|pricing rule/i.test(item.message))
  if (parameterFailure) throw new Error(`视频模型参数不兼容：${parameterFailure.model} · ${parameterFailure.message}。请在 API 接入中选择该模型支持的时长、分辨率和画面比例。`)
  if (attempts.length && attempts.every((item) => item.status === 404)) throw new Error('接口路径不可用：所有候选端点均返回 404。当前地址可能是文档/前台网站而不是 API Base URL；请点击“智能识别并测试”，或填写供应商文档标注的 API 根地址。')
  const detail = attempts.slice(0, 6).map((item) => `${item.model} @ ${item.endpoint}: ${item.status || '网络'} ${item.message}`).join('；')
  throw new Error(`所有候选模型或端点均失败：${detail || lastError?.message || '未知错误'}`)
}

export function extractModelIds(data) {
  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.models) ? data.data.models : Array.isArray(data?.models) ? data.models : Array.isArray(data?.result) ? data.result : []
  return unique(rows.map((item) => typeof item === 'string' ? item : item?.id || item?.name || item?.model).filter(Boolean))
}

export function categorizeModelIds(ids) {
  const videoPattern = /(?:sora|veo|kling|seedance|wan\d*|hailuo|minimax.*video|video)/i
  const imagePattern = /(?:gpt-image|image|flux|dall|midjourney|imagen|sdxl|stable-diffusion|nano-banana)/i
  const video = ids.filter((id) => videoPattern.test(id))
  const image = ids.filter((id) => !videoPattern.test(id) && imagePattern.test(id))
  const text = ids.filter((id) => !videoPattern.test(id) && !imagePattern.test(id))
  return { all: ids, text, image, video }
}

export function extractText(data) {
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((item) => item?.text || item?.content || '').join('')
  if (typeof data?.output_text === 'string') return data.output_text
  if (Array.isArray(data?.output)) return data.output.flatMap((item) => item?.content || []).map((item) => item?.text || '').join('')
  return typeof data?.result === 'string' ? data.result : ''
}

export function extractAssetUrl(data) {
  const first = data?.data?.[0]
  if (first?.url) return first.url
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`
  const generated = data?.output?.find?.((item) => item?.type === 'image_generation_call')?.result
  if (generated) return `data:image/png;base64,${generated}`
  const output = data?.output
  if (typeof output === 'string' && /^https?:\/\//i.test(output)) return output
  if (Array.isArray(output)) {
    const url = output.find((item) => typeof item === 'string' && /^https?:\/\//i.test(item)) || output.find((item) => item?.url)?.url
    if (url) return url
  }
  const direct = data?.url || data?.video?.url || data?.video_url || data?.videoUrl || data?.download_url || data?.result_url || data?.result?.url || data?.result?.video?.url || data?.result?.video_url || data?.result?.videoUrl || data?.result?.download_url || data?.result?.result_url || data?.result?.data?.[0]?.url || data?.data?.url || data?.data?.video?.url || data?.data?.video_url || data?.data?.videoUrl || data?.data?.download_url || data?.data?.result_url || data?.data?.output?.url || data?.result?.output?.url
  if (direct) return direct
  const candidates = [data?.data?.output, data?.result?.output, data?.results, data?.data?.results].flat().filter(Boolean)
  return candidates.find((item) => typeof item === 'string' && /^https?:\/\//i.test(item)) || candidates.find((item) => item?.url || item?.video_url)?.url || candidates.find((item) => item?.video_url)?.video_url || null
}

export const extractJobId = (data) => data?.id || data?.data?.id || data?.data?.task_id || data?.output?.task_id || data?.task_id || data?.request_id || data?.result?.id || data?.result?.task_id || null
export const extractJobStatus = (data) => String(data?.state || data?.status || data?.task_status || data?.data?.state || data?.data?.status || data?.data?.task_status || data?.output?.task_status || data?.result?.state || data?.result?.status || '').toLowerCase()
export const extractProgress = (data) => Number.parseFloat(data?.progress ?? data?.data?.progress ?? data?.result?.progress ?? 0) || 0

export function parseStrategy(raw, fallbackFormat) {
  const cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let strategy
  try { strategy = JSON.parse(cleaned) } catch { strategy = {} }
  const defaults = ['镜头直视：用一句反应制造好奇', '展示产品：迅速给出答案', '点出具体痛点与使用场景', '近景演示核心功能', '展示结果并给出真实反应', '补充第二种使用方式', '连续细节快切增强质感', '产品留在画面内并轻声推荐']
  return {
    format: strategy.format || fallbackFormat || '震惊反应 + 演示', mechanism: strategy.mechanism || '先制造好奇，再让产品演示成为答案。',
    hook: strategy.hook || '等等，这个我怎么现在才发现？', shots: Array.from({ length: 8 }, (_, index) => strategy.shots?.[index] || defaults[index]),
    metrics: Array.isArray(strategy.metrics) ? strategy.metrics : ['分享率', '完播率', '保存率'],
  }
}

export function validateProviderConfig(config = {}) {
  if (config.demoMode) return null
  if (!config.testAgentPlan && !['codex', 'claude'].includes(config.agentProvider)) return '请选择 Codex 或 Claude 智能体'
  const videoBaseUrl = config.videoBaseUrl || config.baseUrl
  if (!videoBaseUrl) return '请填写视频 API Base URL'
  if (!/^https?:\/\//i.test(videoBaseUrl)) return '视频 API Base URL 必须以 http:// 或 https:// 开头'
  if (!config.videoApiKey && !config.apiKey) return '请填写视频 API Key'
  if (!splitPool(config.videoModels || config.videoModel).length) return '请填写视频模型'
  const agentNeedsImageApi = config.imageSource === 'agent' && Boolean(config.imageBaseUrl && config.imageApiKey)
  if (!['reference', 'agent'].includes(config.imageSource) || agentNeedsImageApi) {
    const imageBaseUrl = config.imageBaseUrl || config.baseUrl
    if (!imageBaseUrl || !/^https?:\/\//i.test(imageBaseUrl)) return '图片 API Base URL 必须以 http:// 或 https:// 开头'
    if (!config.imageApiKey && !config.apiKey) return '图片生成需要图片 API Key；或选择“使用上传参考图”'
    if (!splitPool(config.imageModels || config.imageModel).length) return '请填写图片模型'
  }
  for (const value of [config.imageBaseUrl, config.videoBaseUrl].filter(Boolean)) if (!/^https?:\/\//i.test(value)) return '独立模型 Base URL 必须以 http:// 或 https:// 开头'
  return null
}
