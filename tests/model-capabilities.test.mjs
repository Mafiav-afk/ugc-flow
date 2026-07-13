import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { discoverTextVideoModel, requiredUploadParams } from '../server/model-capabilities.mjs'

test('detects required public upload parameters', () => {
  assert.deepEqual(requiredUploadParams({ params: [{ name: 'images', type: 'upload', required: true }, { name: 'duration', type: 'select', required: true }] }), ['images'])
})

test('discovers and verifies a text-to-video fallback from provider catalog', async (t) => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    if (req.url === '/v1/skills/models?type=video') return res.end(JSON.stringify({ data: [{ name: 'image-video', type: 'video' }, { name: 'safe-t2v', type: 'video' }] }))
    if (req.url === '/v1/skills/models/safe-t2v') return res.end(JSON.stringify({ data: { name: 'safe-t2v', type: 'video', params: [{ name: 'duration', type: 'select', required: true }] } }))
    return res.end(JSON.stringify({ code: 404, msg: 'not found' }))
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const found = await discoverTextVideoModel({ baseUrl: `http://127.0.0.1:${server.address().port}`, videoModelsPath: '/v1/skills/models?type=video', videoModelDetailPath: '/v1/skills/models/{model}' }, 'image-video')
  assert.equal(found.model, 'safe-t2v')
  assert.equal(found.source, 'provider-catalog')
})
