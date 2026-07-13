const STATIC_DEMO = new URLSearchParams(window.location.search).has('online-demo') || (import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(window.location.hostname))
const staticJobs = new Map()
const demoAsset = `${import.meta.env.BASE_URL}assets/demo-ugc-frame.png`

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`)
  return data
}

function demoStrategy(brief) {
  return {
    format: brief.format && brief.format !== '自动匹配最佳格式' ? brief.format : '意外发现 · 真实演示',
    hook: `原来${brief.name || '这个产品'}这么好用，难怪大家都在推荐`,
    shots: ['开场吸引：先抛出具体痛点', '产品出镜：自然给出答案', '场景铺垫：展示真实需求', '核心演示：完整呈现功能', '效果证明：展示前后变化', '第二用法：扩展使用场景', '细节快切：材质与质感', '轻 CTA：像朋友一样推荐'],
  }
}

function staticJobSnapshot(job) {
  if (job.status === 'cancelled') return { ...job, createdAtMs: undefined }
  const elapsed = Date.now() - job.createdAtMs
  const stage = Math.min(6, Math.max(1, Math.floor(elapsed / 450) + 1))
  const completed = elapsed >= 2800
  const strategy = demoStrategy(job.brief)
  const result = {
    mode: 'demo',
    ...(stage >= 1 ? { product: { summary: `${job.brief.name}面向${job.brief.audience || '目标消费者'}，突出${job.brief.sellingPoints || '真实使用价值'}。` } } : {}),
    ...(stage >= 2 ? { strategy } : {}),
    ...(stage >= 3 ? { characterUrl: demoAsset, previewUrl: demoAsset } : {}),
    ...(stage >= 4 ? { productReferenceUrl: demoAsset } : {}),
    prompt: '在线演示提示词：接入本地智能体与媒体 API 后生成真实图片和视频。',
  }
  const messages = ['正在分析商品信息', '正在匹配爆款结构', '正在生成角色参考', '正在锁定产品外观', '正在合成 8 镜头竖屏视频', '正在整理成片与提示词']
  return { id: job.id, status: completed ? 'completed' : 'running', stage: completed ? 6 : stage, message: completed ? '在线演示工作流已完成' : messages[stage - 1], result, logs: messages.slice(0, completed ? 6 : stage).map((message, index) => ({ stage: index + 1, message, at: new Date(job.createdAtMs + index * 450).toISOString() })) }
}

const staticApi = {
  health: async () => ({ ok: true, service: 'ugc-flow-pages', version: '1.3.0' }),
  agents: async () => ({ codex: { installed: false, authenticated: false }, claude: { installed: false, authenticated: false } }),
  discover: async (config) => ({ config, discoveries: {} }),
  test: async () => ({ ok: true, mode: 'demo', message: 'GitHub Pages 在线演示模式可用' }),
  models: async () => ({ all: [], image: [], video: [] }),
  productLink: async () => { throw new Error('在线演示版不读取外部商品页面，请直接填写商品信息') },
  createJob: async (brief) => { const id = crypto.randomUUID(); const job = { id, brief, status: 'running', stage: 1, createdAtMs: Date.now() }; staticJobs.set(id, job); return staticJobSnapshot(job) },
  getJob: async (id) => { const job = staticJobs.get(id); if (!job) throw new Error('演示任务不存在或已刷新'); return staticJobSnapshot(job) },
  cancelJob: async (id) => { const job = staticJobs.get(id); if (!job) throw new Error('演示任务不存在'); job.status = 'cancelled'; return staticJobSnapshot(job) },
  deploy: async () => ({ message: '在线演示不会修改本机；下载 Mac 版后可一键部署技能' }),
}

export const api = STATIC_DEMO ? staticApi : {
  health: () => jsonRequest('/api/health'),
  agents: () => jsonRequest('/api/agents/status'),
  discover: (config) => jsonRequest('/api/discover', { method: 'POST', body: JSON.stringify({ config }) }),
  test: (config) => jsonRequest('/api/test', { method: 'POST', body: JSON.stringify({ config }) }),
  models: (config) => jsonRequest('/api/models', { method: 'POST', body: JSON.stringify({ config }) }),
  productLink: (url) => jsonRequest('/api/product-link', { method: 'POST', body: JSON.stringify({ url }) }),
  createJob: (brief, config) => jsonRequest('/api/jobs', { method: 'POST', body: JSON.stringify({ brief, config }) }),
  getJob: (id) => jsonRequest(`/api/jobs/${id}`),
  cancelJob: (id) => jsonRequest(`/api/jobs/${id}`, { method: 'DELETE' }),
  deploy: (target) => jsonRequest('/api/deploy', { method: 'POST', body: JSON.stringify({ target }) }),
}

export const isStaticDemo = STATIC_DEMO
export const desktopDownloadUrl = STATIC_DEMO ? 'https://github.com/Mafiav-afk/ugc-flow/releases/latest/download/UGC-Flow-Mac-1.3.0-arm64.dmg' : '/downloads/UGC-Flow-Mac-1.3.0-arm64.dmg'
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export function downloadJson(filename, data) {
  const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = filename; anchor.click(); URL.revokeObjectURL(href)
}
