import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { clearWorkflowJobs, createWorkflowJob, getWorkflowJob } from '../server/workflow.mjs'

const testAgentPlan = { product: { summary: '测试商品', audience: '目标用户', claims: ['真实卖点'], risks: [] }, strategy: { format: '产品即演示', mechanism: '展示证明', hook: '看看这个', shots: Array.from({ length: 8 }, (_, index) => `镜头 ${index + 1}`), metrics: ['完播率', '点击率', '转化率'] }, imagePrompt: 'realistic UGC reference image', videoPrompt: 'realistic 9:16 UGC product video' }
const sendJson = (res, data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
const readJson = (req) => new Promise((resolve) => { let raw = ''; req.on('data', (chunk) => { raw += chunk }); req.on('end', () => resolve(JSON.parse(raw || '{}'))) })
async function waitForJob(id) { let job; for (let attempt = 0; attempt < 160; attempt += 1) { job = getWorkflowJob(id); if (['completed', 'failed'].includes(job.status)) break; await new Promise((resolve) => setTimeout(resolve, 20)) }; return job }

test.afterEach(() => clearWorkflowJobs())

test('live workflow switches away from 404 routes and records selected models', async (t) => {
  const calls = []
  const server = http.createServer((req, res) => {
    calls.push(req.url)
    if (req.url.includes('missing')) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"detail":"Not Found"}'); return }
    res.writeHead(200, { 'content-type': 'application/json' })
    if (req.url === '/images/generations') res.end('{"data":[{"b64_json":"aGVsbG8="}]}')
    else if (req.url === '/videos/generations') res.end('{"video_url":"https://example.com/final.mp4"}')
    else res.end('{}')
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const config = { provider: 'compatible', demoMode: false, testAgentPlan, baseUrl, apiKey: 'test', authMode: 'bearer', videoProtocol: 'json', imageModels: 'image-a,image-b', videoModels: 'video-a,video-b', imagePath: '/missing-image\n/images/generations', videoPath: '/missing-video\n/videos/generations' }
  const created = createWorkflowJob({ brief: { name: '测试商品', sellingPoints: '真实卖点', assets: [] }, config })
  let job
  for (let attempt = 0; attempt < 100; attempt += 1) { job = getWorkflowJob(created.id); if (['completed', 'failed'].includes(job.status)) break; await new Promise((resolve) => setTimeout(resolve, 20)) }
  assert.equal(job.status, 'completed', job.error)
  assert.equal(job.result.strategy.shots.length, 8)
  assert.equal(job.result.providerTrace.text, undefined)
  assert.ok(!calls.some((url) => url.includes('responses') || url.includes('chat/completions')))
  assert.ok(job.result.providerTrace.image.fallbacks.some((item) => item.status === 404))
  assert.equal(job.result.providerTrace.video.endpoint, '/videos/generations')
  assert.ok(calls.some((url) => url === '/videos/generations'))
})

test('generic media task protocol polls image and video result URLs', async (t) => {
  const submitted = []
  let videoPolls = 0
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/media/status') {
      const id = url.searchParams.get('task_id')
      res.writeHead(200, { 'content-type': 'application/json' })
      if (id.startsWith('vid') && videoPolls++ === 0) res.end(JSON.stringify({ task_id: id, state: 'running', is_final: false, progress: '40%', result_url: '' }))
      else res.end(JSON.stringify({ task_id: id, state: 'success', is_final: true, progress: '100%', result_url: id.startsWith('img') ? 'https://example.com/character.png' : 'https://example.com/video.mp4' }))
      return
    }
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}
      submitted.push({ path: url.pathname, body })
      res.writeHead(200, { 'content-type': 'application/json' })
      if (url.pathname === '/media/generate') res.end(JSON.stringify({ data: { task_id: body.model.includes('image') ? 'img-1' : 'vid-1' } }))
      else res.end('{}')
    })
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const config = { provider: 'compatible', demoMode: false, testAgentPlan, baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', authMode: 'bearer', imageSource: 'agent', imageProtocol: 'media', videoProtocol: 'media', imageModels: 'gpt-image-2', videoModels: 'kling-v3-video', imagePath: '/media/generate', imageStatusPath: '/media/status?task_id={id}', videoPath: '/media/generate', videoStatusPath: '/media/status?task_id={id}', pollInitialDelayMs: 1, pollIntervalMs: 1 }
  const created = createWorkflowJob({ brief: { name: '媒体商品', sellingPoints: '真实卖点', assets: [] }, config })
  let intermediate
  for (let attempt = 0; attempt < 100; attempt += 1) { intermediate = getWorkflowJob(created.id); if (intermediate?.stage === 5 && intermediate?.result?.characterUrl) break; await new Promise((resolve) => setTimeout(resolve, 10)) }
  assert.equal(intermediate.status, 'running')
  assert.equal(intermediate.result.characterUrl, 'https://example.com/character.png')
  assert.equal(intermediate.result.videoUrl, null)
  let job
  for (let attempt = 0; attempt < 160; attempt += 1) { job = getWorkflowJob(created.id); if (['completed', 'failed'].includes(job.status)) break; await new Promise((resolve) => setTimeout(resolve, 20)) }
  assert.equal(job.status, 'completed', job.error)
  assert.equal(job.result.characterUrl, 'https://example.com/character.png')
  assert.equal(job.result.videoUrl, 'https://example.com/video.mp4')
  assert.equal(job.result.providerTrace.image.model, 'gpt-image-2')
  const imageBody = submitted.find((item) => item.body.model === 'gpt-image-2').body
  const videoBody = submitted.find((item) => item.body.model === 'kling-v3-video').body
  assert.equal(imageBody.params.quality, 'auto')
  assert.equal(videoBody.params.mode, 'std')
  assert.equal(videoBody.params.aspect_ratio, '9:16')
})

test('Grok media request sends one image URL in params and keeps notify_url at top level', async (t) => {
  const submitted = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/media/status') {
      const id = url.searchParams.get('task_id')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ task_id: id, state: 'success', is_final: true, result_url: id === 'image-task' ? 'https://cdn.example.com/first-frame.png' : 'https://cdn.example.com/final.mp4' }))
      return
    }
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const body = JSON.parse(raw || '{}'); submitted.push(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ task_id: body.model === 'gpt-image-2' ? 'image-task' : 'video-task' }))
    })
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const config = { provider: 'compatible', demoMode: false, testAgentPlan, baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', authMode: 'bearer', imageProtocol: 'media', videoProtocol: 'media', imageModels: 'gpt-image-2', videoModels: 'wan2.6-flash, grok-imagine-video-1.5-preview', videoProfile: 'grok-imagine-video-1.5-preview', videoDuration: '7', videoResolution: '480p', videoAspectRatio: '2:3', imagePath: '/media/generate', imageStatusPath: '/media/status?task_id={id}', videoPath: '/media/generate', videoStatusPath: '/media/status?task_id={id}', notifyUrl: 'https://merchant.example.com/webhook', pollInitialDelayMs: 1, pollIntervalMs: 1 }
  const created = createWorkflowJob({ brief: { name: '测试商品', sellingPoints: '真实卖点', assets: [] }, config })
  let job
  for (let attempt = 0; attempt < 160; attempt += 1) { job = getWorkflowJob(created.id); if (['completed', 'failed'].includes(job.status)) break; await new Promise((resolve) => setTimeout(resolve, 20)) }
  assert.equal(job.status, 'completed', job.error)
  const body = submitted.find((item) => item.model === 'grok-imagine-video-1.5-preview')
  assert.deepEqual(Object.keys(body).sort(), ['model', 'notify_url', 'params', 'prompt'])
  assert.equal(body.notify_url, 'https://merchant.example.com/webhook')
  assert.equal(body.params.notify_url, undefined)
  assert.deepEqual(body.params, { aspect_ratio: '2:3', resolution: '480p', duration: '7', images: 'https://cdn.example.com/first-frame.png' })
})

test('Grok relay alias overrides a stale /videos route with the standard generations endpoint', async (t) => {
  let submitted
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/models')) return sendJson(res, { data: [{ id: 'grok-video-1.5-preview' }] })
    if (req.method === 'POST' && req.url === '/videos/generations') { submitted = await readJson(req); return sendJson(res, { id: 'video-1' }) }
    if (req.method === 'GET' && req.url === '/videos/generations/video-1') return sendJson(res, { status: 'completed', video: { url: 'https://cdn.example.com/video.mp4' } })
    return sendJson(res, { error: { message: 'wrong endpoint' } }, 404)
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const config = { provider: 'compatible', demoMode: false, testAgentPlan, baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', authMode: 'bearer', imageSource: 'reference', videoProtocol: 'auto', videoModels: 'grok-video-1.5-preview', videoProfile: 'grok-video-1.5-preview', videoDuration: '7', videoResolution: '480p', videoAspectRatio: '2:3', videoPath: '/videos', videoStatusPath: '/media/status?task_id={id}', pollInitialDelayMs: 1, pollIntervalMs: 1 }
  const created = createWorkflowJob({ brief: { name: '商品', sellingPoints: '卖点', assets: [{ url: 'https://cdn.example.com/ref.png' }] }, config })
  const job = await waitForJob(created.id)
  assert.equal(job.status, 'completed')
  assert.equal(submitted.model, 'grok-video-1.5-preview')
  assert.deepEqual(submitted.image_urls, ['https://cdn.example.com/ref.png'])
  assert.deepEqual(submitted.images, ['https://cdn.example.com/ref.png'])
  assert.equal(submitted.input_reference, 'https://cdn.example.com/ref.png')
  assert.equal(submitted.image, 'https://cdn.example.com/ref.png')
})

test('Grok Video 3 follows the documented images array and metadata resolution schema', async (t) => {
  let submitted
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/videos/generations') { submitted = await readJson(req); return sendJson(res, { id: 'grok3-task' }) }
    if (req.method === 'GET' && req.url === '/videos/generations/grok3-task') return sendJson(res, { status: 'completed', result: { data: [{ url: 'https://cdn.example.com/grok3.mp4' }] } })
    return sendJson(res, { error: { message: 'wrong endpoint' } }, 404)
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const config = { provider: 'compatible', demoMode: false, testAgentPlan, baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', authMode: 'bearer', imageSource: 'reference', videoProtocol: 'json', videoModels: 'grok-video-3', videoProfile: 'grok-video-3', videoDuration: '15', videoResolution: '1080P', videoAspectRatio: '9:16', videoPath: '/videos/generations', videoStatusPath: '/videos/generations/{id}', pollInitialDelayMs: 1, pollIntervalMs: 1 }
  const created = createWorkflowJob({ brief: { name: '商品', sellingPoints: '卖点', assets: [{ url: 'https://cdn.example.com/ref.png' }] }, config })
  const job = await waitForJob(created.id)
  assert.equal(job.status, 'completed', job.error)
  assert.deepEqual(submitted.images, ['https://cdn.example.com/ref.png'])
  assert.deepEqual(submitted.metadata, { resolution: '1080P' })
  assert.equal(submitted.duration, 15)
  assert.equal(submitted.aspect_ratio, '9:16')
  assert.equal(submitted.resolution, undefined)
})

test('product reference uses multipart image edit before video generation', async (t) => {
  const calls = []
  const server = http.createServer((req, res) => {
    calls.push({ path: req.url, type: req.headers['content-type'] || '' })
    req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(req.url === '/images/edits' ? '{"data":[{"url":"https://cdn.example.com/ugc-product.png"}]}' : '{"video_url":"https://cdn.example.com/final.mp4"}') })
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const config = { provider: 'compatible', demoMode: false, testAgentPlan, baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', authMode: 'bearer', imageSource: 'api', imageProtocol: 'openai', videoProtocol: 'json', imageModels: 'gpt-image-1', videoModels: 'video-a', imagePath: '/images/edits\n/images/generations', videoPath: '/videos/generations' }
  const created = createWorkflowJob({ brief: { name: '参考商品', sellingPoints: '真实卖点', assets: [{ name: 'product.png', type: 'image/png', size: 5, dataUrl: 'data:image/png;base64,aGVsbG8=' }] }, config })
  let job
  for (let attempt = 0; attempt < 100; attempt += 1) { job = getWorkflowJob(created.id); if (['completed', 'failed'].includes(job.status)) break; await new Promise((resolve) => setTimeout(resolve, 20)) }
  assert.equal(job.status, 'completed', job.error)
  assert.equal(job.result.characterUrl, 'https://cdn.example.com/ugc-product.png')
  assert.match(calls.find((item) => item.path === '/images/edits').type, /^multipart\/form-data; boundary=/)
  assert.ok(!calls.some((item) => item.path === '/images/generations'))
})
