import express from 'express'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PROVIDER_PRESETS, categorizeModelIds, extractModelIds, requestCompatible, requestRaw, scopedConfig, splitPool, validateProviderConfig } from './adapters.mjs'
import { cancelWorkflowJob, createWorkflowJob, getWorkflowJob, getWorkflowMedia } from './workflow.mjs'
import { agentStatuses } from './agent-runner.mjs'
import { resolveMediaConfig } from './provider-discovery.mjs'
import { resolveProductLink } from './product-link.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function validateBrief(brief = {}) { if (!brief.name?.trim()) return '请填写产品名称'; if (!brief.sellingPoints?.trim()) return '请填写核心卖点'; if ((brief.assets || []).some((asset) => asset.size > 10 * 1024 * 1024)) return '单个参考素材不能超过 10 MB'; return null }

export function createApp({ apiOnly = false } = {}) {
  const app = express()
  app.use(express.json({ limit: '32mb' }))
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ugc-flow', version: '1.3.0' }))
  app.get('/downloads/UGC-Flow-Mac-1.3.0-arm64.dmg', async (_req, res) => {
    const installer = path.join(root, 'release', 'UGC-Flow-Mac-1.3.0-arm64.dmg')
    try {
      await fs.access(installer)
      return res.download(installer, 'UGC-Flow-Mac-1.3.0-arm64.dmg')
    } catch {
      return res.status(404).json({ error: '当前运行包未包含桌面安装器，请在源码目录执行 npm run build:mac' })
    }
  })
  app.get('/api/presets', (_req, res) => res.json(PROVIDER_PRESETS))
  app.post('/api/product-link', async (req, res) => { try { return res.json(await resolveProductLink(req.body?.url)) } catch (error) { return res.status(400).json({ error: error.message }) } })
  app.get('/api/agents/status', async (_req, res) => {
    try { return res.json(await agentStatuses()) } catch (error) { return res.status(500).json({ error: error.message }) }
  })
  app.post('/api/discover', async (req, res) => {
    try {
      const resolved = await resolveMediaConfig(req.body?.config || {})
      return res.json({ config: resolved.config, discoveries: resolved.discoveries })
    } catch (error) { return res.status(400).json({ error: error.message }) }
  })
  app.post('/api/test', async (req, res) => {
    try {
      const resolved = await resolveMediaConfig(req.body?.config || {}), config = resolved.config
      if (config.demoMode) return res.json({ ok: true, mode: 'demo', message: '本地演示模式可用' })
      const configError = validateProviderConfig(config)
      if (configError) return res.status(400).json({ error: configError })
      const agents = await agentStatuses(), selected = agents[config.agentProvider]
      if (!selected?.authenticated) return res.status(400).json({ error: `${config.agentProvider === 'claude' ? 'Claude' : 'Codex'} 未登录，请先在终端完成登录` })
      const videoConfig = scopedConfig(config, 'video')
      const checked = await requestCompatible(videoConfig, { endpoints: config.modelsPath || '/models\n/v1/models', models: ['connection-check'], makeOptions: async () => ({ method: 'GET', headers: { 'content-type': undefined }, timeoutMs: 15_000 }) })
      const changed = Object.values(resolved.discoveries).find((item) => item?.changed)
      return res.json({ ok: true, mode: 'live', message: `${config.agentProvider === 'claude' ? 'Claude' : 'Codex'} 已连接 · 视频 API 正常${changed ? ' · 已自动识别 API 入口' : ''}`, endpoint: checked.endpoint, resolvedConfig: config, discoveries: resolved.discoveries })
    } catch (error) { return res.status(400).json({ error: error.message }) }
  })
  app.post('/api/models', async (req, res) => {
    try {
      const resolved = await resolveMediaConfig(req.body?.config || {}), config = resolved.config
      const configError = validateProviderConfig(config)
      if (configError) return res.status(400).json({ error: configError })
      const videoConfig = scopedConfig(config, 'video')
      const pools = await Promise.allSettled([
        requestCompatible(videoConfig, { endpoints: config.modelsPath || '/models?type=all\n/v1/models?type=all\n/models\n/v1/models', models: ['standard-model-discovery'], makeOptions: async () => ({ method: 'GET', headers: { 'content-type': undefined }, timeoutMs: 20_000 }) }),
        requestCompatible(videoConfig, { endpoints: config.videoModelsPath || '/models?type=video\n/v1/models?type=video\n/v1/skills/models?type=video\n/v1/media/models', models: ['video-model-discovery'], makeOptions: async () => ({ method: 'GET', headers: { 'content-type': undefined }, timeoutMs: 20_000 }) }),
        requestCompatible(scopedConfig(config, 'image'), { endpoints: config.imageModelsPath || '/models?type=image\n/v1/models?type=image\n/v1/skills/models?type=image\n/v1/media/models', models: ['image-model-discovery'], makeOptions: async () => ({ method: 'GET', headers: { 'content-type': undefined }, timeoutMs: 20_000 }) }),
      ])
      const ids = pools.flatMap((item) => item.status === 'fulfilled' ? extractModelIds(item.value.data) : [])
      const models = categorizeModelIds([...new Set(ids)])
      if (!models.all.length) return res.status(422).json({ error: '模型接口可访问，但没有返回可识别的模型 ID' })
      return res.json({ ...models, endpoints: pools.flatMap((item) => item.status === 'fulfilled' ? [item.value.endpoint] : []), resolvedConfig: config, discoveries: resolved.discoveries })
    } catch (error) { return res.status(400).json({ error: error.message }) }
  })
  app.post('/api/jobs', (req, res) => {
    const { brief = {}, config = {} } = req.body
    const error = validateBrief(brief) || validateProviderConfig(config)
    if (error) return res.status(400).json({ error })
    return res.status(202).json(createWorkflowJob({ brief, config }))
  })
  app.get('/api/jobs/:id', (req, res) => { const job = getWorkflowJob(req.params.id); return job ? res.json(job) : res.status(404).json({ error: '任务不存在或已过期' }) })
  app.get('/api/jobs/:id/media', async (req, res) => {
    const source = getWorkflowMedia(req.params.id)
    if (!source) return res.status(404).json({ error: '视频文件不存在或尚未完成' })
    let lastError
    for (const endpoint of splitPool(source.endpoints)) {
      try {
        const upstream = await requestRaw(source.config, endpoint, { method: 'GET', headers: { 'content-type': undefined }, timeoutMs: 180_000 })
        res.setHeader('content-type', upstream.headers.get('content-type') || 'video/mp4')
        const length = upstream.headers.get('content-length'); if (length) res.setHeader('content-length', length)
        res.setHeader('cache-control', 'private, max-age=300')
        return res.send(Buffer.from(await upstream.arrayBuffer()))
      } catch (error) { lastError = error; if (error.status !== 404) break }
    }
    return res.status(lastError?.status || 502).json({ error: lastError?.message || '无法下载上游视频' })
  })
  app.delete('/api/jobs/:id', (req, res) => { const job = cancelWorkflowJob(req.params.id); return job ? res.json(job) : res.status(404).json({ error: '任务不存在或已过期' }) })
  app.post('/api/deploy', async (req, res) => {
    try {
      const { target } = req.body
      if (!['codex', 'claude'].includes(target)) return res.status(400).json({ error: '未知部署目标' })
      const base = target === 'codex' ? path.join(os.homedir(), '.codex', 'skills') : path.join(os.homedir(), '.claude', 'skills')
      for (const name of ['ai-ugc-realism', 'winning-ad-formats', 'merchant-ugc-campaign', 'ugc-flow-agent']) await fs.cp(path.join(root, 'skills', name), path.join(base, name), { recursive: true, force: true })
      return res.json({ message: `完整技能已部署到 ${base}` })
    } catch (error) { return res.status(500).json({ error: error.message }) }
  })
  if (!apiOnly) {
    app.use(express.static(path.join(root, 'dist')))
    app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')))
  }
  return app
}
