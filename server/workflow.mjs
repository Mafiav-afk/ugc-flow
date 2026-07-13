import crypto from 'node:crypto'
import { characterPrompt, videoPrompt } from './prompts.mjs'
import { buildDemoProduct, buildDemoStrategy, delay, DEMO_ASSET } from './demo.mjs'
import { extractAssetUrl, extractJobId, extractJobStatus, extractProgress, requestCompatible, scopedConfig, splitPool } from './adapters.mjs'
import { configuredVideoParams, jsonVideoParams, mediaParamsFor, parseParamsJson } from './media-profiles.mjs'
import { runAgentPlan } from './agent-runner.mjs'
import { compactMediaReference, compactPrompt } from './media-input.mjs'
import { resolveMediaConfig } from './provider-discovery.mjs'
import { discoverTextVideoModel, modelRequiresPublicReference } from './model-capabilities.mjs'
import { deliverReferenceImage } from './reference-delivery.mjs'
import { getVideoModelProfile } from '../shared/video-models.mjs'

const jobs = new Map()
const MAX_JOBS = 100
const publicJob = (job) => { const { config: _config, abortController: _controller, mediaSource: _mediaSource, ...safe } = job; return safe }
const update = (job, patch) => Object.assign(job, patch, { updatedAt: new Date().toISOString() })
const log = (job, stage, message) => { job.logs.push({ stage, message, at: new Date().toISOString() }); update(job, { stage, message }) }
function assertActive(job) { if (job.abortController.signal.aborted || job.status === 'cancelled') throw new DOMException('任务已取消', 'AbortError') }

export function videoEndpointsFor(config, { relayGrok = false } = {}) {
  const configured = splitPool(config.videoPath)
  if (relayGrok) return ['/videos/generations', '/v1/videos/generations', ...configured.filter((path) => /\/videos\/generations\/?$/i.test(path))].join('\n')
  if (config.videoProtocol === 'media') return (configured.filter((path) => path.includes('/media/generate')).length ? configured.filter((path) => path.includes('/media/generate')) : ['/media/generate', '/v1/media/generate']).join('\n')
  if (config.videoProtocol === 'openai') return ['/videos', '/v1/videos', ...configured.filter((path) => /\/videos\/?$/i.test(path))].join('\n')
  if (config.videoProtocol === 'json') return ['/videos/generations', '/v1/videos/generations', ...configured.filter((path) => /\/videos\/generations\/?$/i.test(path))].join('\n')
  const standard = configured.filter((path) => !path.includes('/media/generate'))
  return (standard.length ? ['/videos', '/videos/generations', '/v1/videos', '/v1/videos/generations', ...standard] : configured.length ? configured : ['/videos', '/videos/generations', '/v1/videos', '/v1/videos/generations']).join('\n')
}

async function imageFilePart(reference, index, signal) {
  if (String(reference).startsWith('data:')) {
    const match = String(reference).match(/^data:([^;,]+);base64,(.+)$/s)
    if (!match) throw new Error('参考产品图不是有效的 base64 图片')
    return { blob: new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }), name: `product-${index + 1}.${match[1].includes('png') ? 'png' : 'jpg'}` }
  }
  const response = await fetch(reference, { signal })
  if (!response.ok) throw new Error(`无法读取产品参考图 (${response.status})`)
  return { blob: new Blob([await response.arrayBuffer()], { type: response.headers.get('content-type') || 'image/jpeg' }), name: `product-${index + 1}.jpg` }
}

async function pollAssetTask(job, { apiConfig, id, paths, label, maxAttempts = 120, initialDelayMs = 3_000, pollIntervalMs = 5_000 }) {
  const signal = job.abortController.signal
  const endpoints = splitPool(paths).map((item) => item.replaceAll('{id}', id))
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    assertActive(job); await delay(attempt === 0 ? Number(apiConfig.pollInitialDelayMs ?? initialDelayMs) : Number(apiConfig.pollIntervalMs ?? pollIntervalMs))
    let response
    try {
      response = (await requestCompatible(apiConfig, { endpoints, models: ['status'], makeOptions: async () => ({ method: 'GET', signal, headers: { 'content-type': undefined } }) })).data
    } catch (error) {
      if (attempt < 8 && /404|Not Found|所有候选|接口路径不可用/.test(error.message)) { update(job, { message: `${label}任务尚未同步，正在重试 · ${attempt + 1}/8` }); continue }
      throw error
    }
    const url = extractAssetUrl(response), status = extractJobStatus(response), progress = extractProgress(response)
    update(job, { message: `${label}生成中 · ${progress || Math.min(99, 15 + Math.floor(attempt / 2))}%` })
    if (url) return { url, response, status }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status) || response?.is_final === true && status === 'failed') throw new Error(`上游${label}任务失败：${response?.error || '未提供原因'}`)
    if (response?.is_final === true && !['success', 'succeeded', 'completed'].includes(status)) throw new Error(`上游${label}任务已结束但没有返回结果`)
    if (['success', 'succeeded', 'completed'].includes(status)) return { url: null, response, status }
  }
  return { url: null, response: null, status: 'timeout' }
}

async function demoWorkflow(job) {
  const messages = ['正在提取商品卖点、受众与合规风险…', '正在匹配爆款机制并编写 8 镜头脚本…', '正在生成带有真实皮肤细节的角色参考…', '正在锁定产品外观和包装约束…', '正在合成 15 秒竖屏演示成片…', '正在整理提示词、脚本与导出文件…']
  for (let stage = 1; stage <= 6; stage += 1) { assertActive(job); log(job, stage, messages[stage - 1]); await delay(350) }
  const strategy = buildDemoStrategy(job.brief)
  return { mode: 'demo', strategy, product: buildDemoProduct(job.brief), characterUrl: DEMO_ASSET, productReferenceUrl: job.brief.assets?.[0]?.dataUrl || DEMO_ASSET, videoUrl: null, previewUrl: DEMO_ASSET, prompt: videoPrompt(job.brief, strategy), characterPrompt: characterPrompt(job.brief) }
}

async function liveWorkflow(job) {
  const { brief } = job
  const resolved = await resolveMediaConfig(job.config), config = resolved.config
  const signal = job.abortController.signal
  const imageConfig = scopedConfig(config, 'image'), videoConfig = scopedConfig(config, 'video')
  log(job, 1, `正在连接 ${config.agentProvider === 'claude' ? 'Claude' : 'Codex'}，调用 UGC Skills 分析商品…`)
  let agent
  try {
    agent = config.testAgentPlan ? { plan: config.testAgentPlan, provider: 'test' } : await runAgentPlan(config.agentProvider || 'codex', brief, config)
  } catch (error) {
    if (config.requireAgentSuccess) throw error
    const fallbackStrategy = buildDemoStrategy(brief)
    agent = { provider: 'local-fallback', fallback: error.message, plan: { product: buildDemoProduct(brief), strategy: fallbackStrategy, imagePrompt: characterPrompt(brief), videoPrompt: videoPrompt(brief, fallbackStrategy), imageUrl: '' } }
    log(job, 1, `Codex/Claude 暂时不可用，已切换本地商家模板继续执行 · ${error.message}`)
  }
  const product = agent.plan.product || buildDemoProduct(brief)
  const strategy = { ...buildDemoStrategy(brief), ...(agent.plan.strategy || {}), shots: Array.from({ length: 8 }, (_, index) => agent.plan.strategy?.shots?.[index] || buildDemoStrategy(brief).shots[index]) }
  const productLock = brief.assets?.length ? `Use the supplied product reference image as the exact product identity. Preserve package shape, colors, cap, label layout, typography and logo placement; place that same product naturally in the creator's hand. ` : ''
  const imagePrompt = compactPrompt(productLock + (agent.plan.imagePrompt || characterPrompt(brief)), 5_000)
  const prompt = compactPrompt(agent.plan.videoPrompt || videoPrompt(brief, strategy), 12_000)
  const discovered = Object.values(resolved.discoveries).find((item) => item?.changed)
  update(job, { result: { mode: 'live', product, strategy, characterUrl: null, productReferenceUrl: null, videoUrl: null, previewUrl: null, prompt, characterPrompt: imagePrompt, providerTrace: discovered ? { discovery: { source: discovered.source, changed: true } } : {} } })
  assertActive(job)
  log(job, 2, `${agent.provider === 'local-fallback' ? '本地商家模板已生成' : `${agent.provider === 'claude' ? 'Claude' : 'Codex'} ${agent.cached ? '已复用分析结果' : '已用自有额度生成'}`} ${strategy.format} 与 8 镜头结构…`)
  log(job, 3, config.imageSource === 'agent' ? '正在接收 Codex 生图结果…' : config.imageSource === 'reference' ? '正在使用上传参考图，跳过图片 API…' : '正在调用异步图片模型生成参考图…')
  const productReferenceUrl = brief.assets?.[0]?.dataUrl || brief.assets?.[0]?.url || null
  let imageReferences = brief.assets?.map((asset) => asset.dataUrl || asset.url).filter(Boolean) || []
  const agentImage = /^https?:\/\//i.test(agent.plan.imageUrl || '') ? agent.plan.imageUrl : null
  const agentApiFallback = config.imageSource === 'agent' && !agentImage && Boolean(imageConfig.baseUrl && imageConfig.apiKey && splitPool(config.imageModels || config.imageModel).length)
  if (agentApiFallback) log(job, 3, 'Codex 已生成图片提示词；当前环境无生图下载 URL，自动切换异步图片 API…')
  if (config.imageProtocol !== 'openai' && imageReferences.length && (!['reference', 'agent'].includes(config.imageSource) || agentApiFallback)) {
    const delivered = await Promise.all(imageReferences.map((reference) => deliverReferenceImage({ ...config, ...imageConfig }, reference, signal)))
    imageReferences = delivered.map((item) => item.url).filter(Boolean)
    if (delivered.some((item) => item.mode === 'upload-auto')) log(job, 3, '本地产品图已通过供应商上传接口自动转换为公网 URL…')
  }
  if (['reference', 'agent'].includes(config.imageSource) && !agentApiFallback) {
    const selectedReference = config.videoReferenceUrl || agentImage || productReferenceUrl
    if (!selectedReference) throw new Error(config.imageSource === 'agent' ? '当前 Codex 环境没有返回可下载图片 URL。请粘贴“公开视频参考图 URL”，或上传 Codex 生成的图片。' : '请先上传图片或填写公开视频参考图 URL')
    update(job, { result: { ...job.result, characterUrl: selectedReference, previewUrl: selectedReference, productReferenceUrl: productReferenceUrl || selectedReference, providerTrace: { agent: { provider: agent.provider }, image: { model: config.imageSource === 'agent' ? 'codex-image-tool' : 'uploaded-reference', endpoint: agentImage ? 'agent-download-url' : 'reference', fallbacks: [] } } } })
    log(job, 4, `${config.imageSource === 'agent' ? 'Codex 图片下载地址' : '上传参考图'}已回传并锁定，未调用图片 API`)
  }
  if (!['reference', 'agent'].includes(config.imageSource) || agentApiFallback) {
  const imageCall = await requestCompatible(imageConfig, {
    endpoints: config.imagePath || '/media/generate\n/v1/media/generate\n/images/edits\n/v1/images/edits\n/images/generations\n/v1/images/generations\n/responses',
    models: config.imageModels || config.imageModel,
    makeOptions: async (model, endpoint) => {
      if (endpoint.includes('predictions')) return { method: 'POST', signal, headers: { Prefer: 'wait=60' }, body: JSON.stringify({ input: { prompt: imagePrompt, aspect_ratio: '9:16' } }) }
      if (endpoint.includes('responses')) return { method: 'POST', signal, body: JSON.stringify({ model, input: imagePrompt, tools: [{ type: 'image_generation', action: 'generate' }], store: false }) }
      if (config.imageProtocol === 'media' || endpoint.includes('/media/generate')) {
        const body = { model, prompt: imagePrompt, params: mediaParamsFor({ kind: 'image', model, references: imageReferences, overrides: parseParamsJson(config.imageParamsJson) }) }
        if (config.notifyUrl) body.notify_url = config.notifyUrl
        return { method: 'POST', signal, body: JSON.stringify(body) }
      }
      if (endpoint.includes('/images/edits')) {
        if (!imageReferences.length) throw Object.assign(new Error('没有产品参考图，跳过图生图端点'), { status: 422 })
        const form = new FormData(); form.append('model', model); form.append('prompt', imagePrompt); form.append('size', '1024x1536'); form.append('n', '1')
        for (const [index, reference] of imageReferences.slice(0, 4).entries()) { const file = await imageFilePart(reference, index, signal); form.append('image[]', file.blob, file.name) }
        return { method: 'POST', signal, timeoutMs: 180_000, headers: { 'content-type': undefined }, body: form }
      }
      return { method: 'POST', signal, body: JSON.stringify({ model, prompt: imagePrompt, size: '9:16', n: 1, response_format: 'url', ...(imageReferences.length ? { reference_images: imageReferences, image_urls: imageReferences } : {}) }) }
    },
  })
  let characterUrl = extractAssetUrl(imageCall.data)
  const imageUpstreamId = extractJobId(imageCall.data)
  if (!characterUrl && imageUpstreamId) {
    const returnedStatusUrl = imageCall.data?.urls?.get
    const imageStatusPaths = [returnedStatusUrl, ...splitPool(config.imageStatusPath || '/media/status?task_id={id}\n/v1/media/status?task_id={id}\n/skills/task-status?task_id={id}\n/v1/skills/task-status?task_id={id}\n/tasks/{id}'), '/images/generations/{id}', '/v1/images/generations/{id}'].filter(Boolean).join('\n')
    characterUrl = (await pollAssetTask(job, { apiConfig: imageConfig, id: imageUpstreamId, paths: imageStatusPaths, label: '图片', maxAttempts: 60 })).url
  }
  if (!characterUrl) throw new Error('图片接口未返回可识别的角色图 URL 或 base64 数据')
  assertActive(job)
  update(job, { result: { ...job.result, characterUrl, previewUrl: characterUrl, productReferenceUrl, providerTrace: { agent: { provider: agent.provider }, image: { model: imageCall.model, endpoint: imageCall.endpoint, fallbacks: imageCall.attempts } } } })
  log(job, 4, `角色与产品参考已锁定 · ${imageCall.model}`)
  }
  const characterUrl = job.result.characterUrl
  const rawVideoReference = config.videoReferenceUrl || [characterUrl, productReferenceUrl].find((value) => /^https?:\/\//i.test(value || '')) || productReferenceUrl || characterUrl
  let videoReference = await compactMediaReference(rawVideoReference)
  const referencePolicy = config.videoReferencePolicy || 'auto-t2v'
  if (referencePolicy === 'text-only') videoReference = null
  else {
    const delivery = await deliverReferenceImage(config, videoReference, signal)
    videoReference = delivery.url
    if (delivery.mode.startsWith('upload-')) {
      log(job, 4, `本地参考图已自动上传并转换为公网 URL · ${delivery.mode.replace('upload-', '')}`)
      update(job, { result: { ...job.result, previewUrl: characterUrl, providerTrace: { ...job.result.providerTrace, referenceDelivery: { mode: delivery.mode } } } })
    }
  }
  let videoModels = config.videoModels || config.videoModel
  if (config.videoProfile && config.videoProfile !== 'custom') {
    const profile = getVideoModelProfile(config.videoProfile)
    const matchingModels = splitPool(videoModels).filter((model) => profile.match.test(model))
    if (matchingModels.length) videoModels = matchingModels.join(',')
  }
  let relayGrokMedia = splitPool(videoModels).some((model) => /^grok-video-1\.5-preview$/i.test(model))
  let mediaProtocol = config.videoProtocol === 'media' || splitPool(videoEndpointsFor(config, { relayGrok: relayGrokMedia })).every((path) => path.includes('/media/generate'))
  const localReference = String(videoReference || '').startsWith('data:')
  const initiallySelectedModel = splitPool(videoModels)[0]
  const knownImageOnlyModel = getVideoModelProfile(initiallySelectedModel).requiresImage
  if ((mediaProtocol || knownImageOnlyModel) && (referencePolicy === 'text-only' || localReference || !videoReference)) {
    const selected = initiallySelectedModel
    const capability = selected ? await modelRequiresPublicReference(videoConfig, selected, signal) : { required: false }
    if (referencePolicy === 'require-public' && (localReference || !videoReference)) throw new Error('当前模型要求公网参考图。请上传 1 张图片并配置自动上传，或直接填写 COS/CDN 图片 URL。')
    if (referencePolicy === 'text-only' || capability.required) {
      const fallback = await discoverTextVideoModel(videoConfig, videoModels, signal)
      if (!fallback) throw new Error('grok-video-1.5-preview 仅支持图生视频。请上传 1 张参考图或填写公网图片 URL；如需无图生成，请在视频模型池加入文生视频模型。')
      videoModels = fallback.model; videoReference = null
      log(job, 5, `本地图片无法直传，已自动切换文生视频模型 · ${fallback.model}`)
      update(job, { result: { ...job.result, providerTrace: { ...job.result.providerTrace, referenceFallback: { policy: referencePolicy, model: fallback.model, source: fallback.source } } } })
      relayGrokMedia = splitPool(videoModels).some((model) => /^grok-video-1\.5-preview$/i.test(model))
      mediaProtocol = config.videoProtocol === 'media' || splitPool(videoEndpointsFor(config, { relayGrok: relayGrokMedia })).every((path) => path.includes('/media/generate'))
    }
  }
  log(job, 5, '视频任务已提交，正在等待成片…')
  const videoCall = await requestCompatible(videoConfig, {
    endpoints: videoEndpointsFor(config, { relayGrok: relayGrokMedia }),
    models: videoModels,
    random: () => 0.999999,
    makeOptions: async (model, endpoint) => {
      const selectedParams = endpoint.includes('/videos/generations') ? jsonVideoParams(configuredVideoParams(config, model)) : configuredVideoParams(config, model)
      if (endpoint.includes('predictions')) return { method: 'POST', signal, timeoutMs: 180_000, headers: { Prefer: 'wait=60' }, body: JSON.stringify({ input: { prompt, image: videoReference, ...selectedParams } }) }
      if (config.videoProtocol === 'media' || endpoint.includes('/media/generate')) {
        const body = { model, prompt, params: mediaParamsFor({ kind: 'video', model, references: [videoReference].filter(Boolean), overrides: { ...selectedParams, ...parseParamsJson(config.videoParamsJson) } }) }
        if (config.notifyUrl) body.notify_url = config.notifyUrl
        return { method: 'POST', signal, timeoutMs: 180_000, body: JSON.stringify(body) }
      }
      if (endpoint.includes('/videos/generations')) {
        const supportsAudio = /(?:vidu.*q3|wan(?:2|x)?[.-]?\d|seedance|doubao.*seedance|kling.*omni|veo3)/i.test(model)
        const references = videoReference ? (/^grok-imagine-video/i.test(model)
          ? { image: { url: videoReference } }
          : /^grok-video-1\.5-preview$/i.test(model)
            ? { image_urls: [videoReference], images: [videoReference], input_reference: videoReference, image: videoReference }
            : { image_urls: [videoReference] }) : {}
        const audio = supportsAudio ? { audio: config.videoAudio !== false } : {}
        const metadata = /seedance/i.test(model) ? { metadata: { resolution: selectedParams.resolution, audio: config.videoAudio !== false } } : {}
        if (/^grok-video-3$/i.test(model)) {
          const { resolution, ...grokParams } = selectedParams
          return { method: 'POST', signal, timeoutMs: 180_000, body: JSON.stringify({ model, prompt, ...grokParams, duration: Number(grokParams.duration), ...(videoReference ? { images: [videoReference] } : {}), metadata: { resolution } }) }
        }
        return { method: 'POST', signal, timeoutMs: 180_000, body: JSON.stringify({ model, prompt, ...selectedParams, ...references, ...audio, ...metadata }) }
      }
      const officialVideo = (config.videoProtocol === 'openai') || (config.videoProtocol !== 'json' && /\/videos\/?$/i.test(endpoint))
      if (officialVideo) {
        const form = new FormData(); form.append('model', model); form.append('prompt', prompt); form.append('size', selectedParams.size || selectedParams.resolution || '720x1280'); form.append('seconds', selectedParams.seconds || selectedParams.duration || '12')
        const reference = videoReference
        if (reference?.startsWith('data:')) { const [meta, encoded] = reference.split(',', 2); const mime = meta.match(/^data:([^;]+)/)?.[1] || 'image/png'; form.append('input_reference', new Blob([Buffer.from(encoded, 'base64')], { type: mime }), 'reference.png') }
        else if (/^https?:\/\//i.test(reference || '')) { const file = await imageFilePart(reference, 0, signal); form.append('input_reference', file.blob, file.name) }
        return { method: 'POST', signal, timeoutMs: 180_000, headers: { 'content-type': undefined }, body: form }
      }
      const body = { model, prompt, ...selectedParams, input_reference: videoReference }
      return { method: 'POST', signal, timeoutMs: 180_000, body: JSON.stringify(body) }
    },
  })
  let videoUrl = extractAssetUrl(videoCall.data)
  const upstreamId = extractJobId(videoCall.data)
  update(job, { result: { ...job.result, upstreamId, providerTrace: { ...job.result.providerTrace, video: { model: videoCall.model, endpoint: videoCall.endpoint, fallbacks: videoCall.attempts } } } })
  if (!videoUrl && upstreamId) {
    const returnedStatusUrl = videoCall.data?.urls?.get
    const statusPaths = [returnedStatusUrl, ...splitPool(config.videoStatusPath), '/videos/generations/{id}', '/v1/videos/generations/{id}', '/videos/{id}', '/v1/videos/{id}', '/media/status?task_id={id}', '/v1/media/status?task_id={id}', '/tasks/{id}'].filter(Boolean).join('\n')
    const polled = await pollAssetTask(job, { apiConfig: videoConfig, id: upstreamId, paths: statusPaths, label: '视频', maxAttempts: 1440, initialDelayMs: 5_000, pollIntervalMs: 5_000 })
    videoUrl = polled.url
    if (!videoUrl && ['completed', 'succeeded', 'success'].includes(polled.status)) {
        const contentPaths = splitPool(config.videoContentPath || '/videos/{id}/content').map((item) => item.replaceAll('{id}', upstreamId))
        if (contentPaths.length) { job.mediaSource = { config: videoConfig, endpoints: contentPaths }; videoUrl = `/api/jobs/${job.id}/media` }
    }
  }
  if (!videoUrl) throw new Error('视频接口未在轮询时限内返回成片 URL')
  assertActive(job)
  log(job, 6, '正在整理提示词、脚本与导出文件…')
  return { ...job.result, mode: 'live', product, strategy, characterUrl, productReferenceUrl, videoUrl, previewUrl: characterUrl, upstreamId, prompt, characterPrompt: imagePrompt, providerTrace: { ...job.result.providerTrace, video: { model: videoCall.model, endpoint: videoCall.endpoint, fallbacks: videoCall.attempts } } }
}

async function execute(job) {
  update(job, { status: 'running', startedAt: new Date().toISOString() })
  try {
    const result = job.config.demoMode ? await demoWorkflow(job) : await liveWorkflow(job)
    assertActive(job)
    update(job, { status: 'completed', stage: 6, message: '带货视频工作流已完成', result, completedAt: new Date().toISOString() })
  } catch (error) {
    if (error.name === 'AbortError' || job.status === 'cancelled') update(job, { status: 'cancelled', message: '任务已取消' })
    else update(job, { status: 'failed', message: error.message || '生成失败', error: error.message || '生成失败' })
  }
}

export function createWorkflowJob({ brief, config }) {
  if (jobs.size >= MAX_JOBS) jobs.delete(jobs.keys().next().value)
  const id = crypto.randomUUID(), now = new Date().toISOString()
  const job = { id, status: 'queued', stage: 0, message: '任务已创建', brief, config, logs: [], createdAt: now, updatedAt: now, error: null, result: null, mediaSource: null, abortController: new AbortController() }
  jobs.set(id, job); void execute(job); return publicJob(job)
}
export const getWorkflowJob = (id) => jobs.has(id) ? publicJob(jobs.get(id)) : null
export const getWorkflowMedia = (id) => jobs.get(id)?.mediaSource || null
export function cancelWorkflowJob(id) { const job = jobs.get(id); if (!job) return null; if (!['completed', 'failed', 'cancelled'].includes(job.status)) { job.abortController.abort(); update(job, { status: 'cancelled', message: '任务已取消' }) }; return publicJob(job) }
export function clearWorkflowJobs() { for (const job of jobs.values()) job.abortController.abort(); jobs.clear() }
