import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { categorizeModelIds, extractAssetUrl, extractJobId, extractModelIds, extractText, joinUrl, parseStrategy, requestCompatible, shuffledPool, validateProviderConfig } from '../server/adapters.mjs'

test('normalizes common compatible API response shapes', () => {
  assert.equal(extractText({ choices: [{ message: { content: 'hello' } }] }), 'hello')
  assert.equal(extractText({ output_text: 'world' }), 'world')
  assert.equal(extractAssetUrl({ data: [{ url: 'https://example.com/a.png' }] }), 'https://example.com/a.png')
  assert.equal(extractAssetUrl({ result: { video_url: 'https://example.com/a.mp4' } }), 'https://example.com/a.mp4')
  assert.equal(extractAssetUrl({ status: 'done', video: { url: 'https://example.com/xai.mp4' } }), 'https://example.com/xai.mp4')
  assert.equal(extractAssetUrl({ data: { output: { url: 'https://example.com/nested.mp4' } } }), 'https://example.com/nested.mp4')
  assert.equal(extractAssetUrl({ result: { data: [{ url: 'https://example.com/task-result.mp4' }] } }), 'https://example.com/task-result.mp4')
  assert.equal(extractAssetUrl({ output: [{ type: 'image_generation_call', result: 'aGVsbG8=' }] }), 'data:image/png;base64,aGVsbG8=')
  assert.equal(extractJobId({ task_id: 'task-1' }), 'task-1')
})

test('normalizes duplicate v1 paths and randomizes model pools without losing entries', () => {
  assert.equal(joinUrl('https://api.example.com/v1', '/v1/images/generations'), 'https://api.example.com/v1/images/generations')
  assert.deepEqual(shuffledPool('a, b\na', () => 0), ['b', 'a'])
})

test('discovers and categorizes common text, image, and video model IDs', () => {
  const ids = extractModelIds({ data: [{ id: 'gpt-5.5' }, { id: 'gpt-image-1' }, { id: 'sora-2' }] })
  assert.deepEqual(categorizeModelIds(ids), { all: ids, text: ['gpt-5.5'], image: ['gpt-image-1'], video: ['sora-2'] })
})

test('falls back after upstream 404 and supports query-key authentication', async (t) => {
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push(req.url)
    if (req.url.startsWith('/missing')) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"detail":"Not Found"}'); return }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"data":[{"url":"https://example.com/ok.png"}]}')
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const port = server.address().port
  const result = await requestCompatible({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'secret', authMode: 'query' }, { endpoints: '/missing\n/images/generations', models: 'image-a', random: () => 0, makeOptions: async () => ({ method: 'POST', body: '{}' }) })
  assert.equal(result.endpoint, '/images/generations')
  assert.equal(result.attempts[0].status, 404)
  assert.ok(requests.every((url) => url.includes('key=secret')))
})

test('falls back when a wrong candidate returns HTTP 200 HTML', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/videos') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>frontend</html>'); return }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"id":"video-task","status":"queued"}')
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const result = await requestCompatible({ baseUrl: `http://127.0.0.1:${server.address().port}` }, { endpoints: '/videos\n/videos/generations', models: 'video-a', random: () => 0, makeOptions: async () => ({ method: 'POST', body: '{}' }) })
  assert.equal(result.endpoint, '/videos/generations')
  assert.equal(result.attempts[0].status, 502)
})

test('falls back when an upstream candidate drops the network connection', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/broken') { req.socket.destroy(); return }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"id":"video-task","status":"queued"}')
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const result = await requestCompatible({ baseUrl: `http://127.0.0.1:${server.address().port}` }, { endpoints: '/broken\n/videos/generations', models: 'video-a', makeOptions: async () => ({ method: 'POST', body: '{}' }) })
  assert.equal(result.endpoint, '/videos/generations')
  assert.equal(result.attempts[0].status, 503)
  assert.match(result.attempts[0].message, /上游|连接/)
})

test('summarizes model-not-found errors instead of exposing every attempted route', async (t) => {
  const server = http.createServer((_req, res) => { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":{"message":"Model gpt-x not found or disabled"}}') }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  await assert.rejects(() => requestCompatible({ baseUrl: `http://127.0.0.1:${server.address().port}` }, { endpoints: '/responses\n/chat/completions', models: 'gpt-x', makeOptions: async () => ({ method: 'POST', body: '{}' }) }), /模型不可用：gpt-x/)
})

test('summarizes image-to-video reference errors instead of exposing every attempted route', async (t) => {
  const server = http.createServer((_req, res) => { res.writeHead(500, { 'content-type': 'application/json' }); res.end('{"error":{"message":"grok-video-1.5-preview only supports image-to-video; one reference image is required"}}') }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  await assert.rejects(() => requestCompatible({ baseUrl: `http://127.0.0.1:${server.address().port}` }, { endpoints: '/videos/generations\n/v1/videos/generations', models: 'grok-video-1.5-preview', makeOptions: async () => ({ method: 'POST', body: '{}' }) }), /仅支持图生视频.*参考图/)
})

test('treats HTTP 200 responses with business code 400 as API failures', async (t) => {
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"code":400,"msg":"Invalid request parameters","data":{"详情":"缺少必要参数 model"}}') }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  await assert.rejects(() => requestCompatible({ baseUrl: `http://127.0.0.1:${server.address().port}` }, { endpoints: '/v1/media/generate', models: 'video', makeOptions: async () => ({ method: 'POST', body: '{}' }), retryStatuses: new Set() }), /Invalid request parameters/)
})

test('repairs incomplete strategy output to eight shots', () => {
  const strategy = parseStrategy('```json\n{"format":"意外发现","shots":["开场"]}\n```')
  assert.equal(strategy.format, '意外发现')
  assert.equal(strategy.shots.length, 8)
  assert.equal(strategy.shots[0], '开场')
  assert.ok(strategy.shots[7])
})

test('validates live and demo provider configs', () => {
  assert.equal(validateProviderConfig({ demoMode: true }), null)
  assert.equal(validateProviderConfig({ demoMode: false }), '请选择 Codex 或 Claude 智能体')
  assert.equal(validateProviderConfig({ demoMode: false, agentProvider: 'codex' }), '请填写视频 API Base URL')
  assert.equal(validateProviderConfig({ demoMode: false, agentProvider: 'codex', baseUrl: 'invalid' }), '视频 API Base URL 必须以 http:// 或 https:// 开头')
  assert.equal(validateProviderConfig({ demoMode: false, agentProvider: 'codex', baseUrl: 'https://api.example.com', apiKey: 'key', imageModel: 'i', videoModel: 'v' }), null)
})
