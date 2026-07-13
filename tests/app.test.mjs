import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.mjs'
import { clearWorkflowJobs } from '../server/workflow.mjs'

test.afterEach(() => clearWorkflowJobs())

test('HTTP API exposes health and creates a demo job', async (t) => {
  const server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => server.close())
  const address = server.address()
  const base = `http://127.0.0.1:${address.port}`
  const health = await fetch(`${base}/api/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).service, 'ugc-flow')
  const installer = await fetch(`${base}/downloads/UGC-Flow-Mac-1.3.0-arm64.dmg`, { method: 'HEAD' })
  assert.equal(installer.status, 200)
  assert.match(installer.headers.get('content-disposition') || '', /UGC-Flow-Mac-1\.3\.0-arm64\.dmg/)
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief: { name: '测试商品', sellingPoints: '真实卖点', assets: [] }, config: { demoMode: true } }) })
  assert.equal(response.status, 202)
  const job = await response.json()
  assert.ok(job.id)
  assert.match(job.status, /queued|running/)
})
