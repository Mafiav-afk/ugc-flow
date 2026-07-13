import test from 'node:test'
import assert from 'node:assert/strict'
import { cancelWorkflowJob, clearWorkflowJobs, createWorkflowJob, getWorkflowJob } from '../server/workflow.mjs'

const brief = { name: '轻薄防晒喷雾', sellingPoints: '轻薄不油腻，快速成膜', audience: '户外通勤人群', format: '自动匹配最佳格式', assets: [] }

async function waitFor(id, expected, timeout = 5_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const job = getWorkflowJob(id)
    if (expected.includes(job.status)) return job
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('job timeout')
}

test.afterEach(() => clearWorkflowJobs())

test('demo workflow completes all six stages with exportable result', async () => {
  const created = createWorkflowJob({ brief, config: { demoMode: true } })
  assert.equal(created.status, 'running')
  const completed = await waitFor(created.id, ['completed'])
  assert.equal(completed.stage, 6)
  assert.equal(completed.logs.length, 6)
  assert.equal(completed.result.mode, 'demo')
  assert.equal(completed.result.strategy.shots.length, 8)
  assert.match(completed.result.prompt, /FORMAT: 9:16/)
  assert.equal(completed.result.previewUrl, '/assets/demo-ugc-frame.png')
})

test('running workflow can be cancelled', async () => {
  const created = createWorkflowJob({ brief, config: { demoMode: true } })
  const cancelled = cancelWorkflowJob(created.id)
  assert.equal(cancelled.status, 'cancelled')
  const final = await waitFor(created.id, ['cancelled'])
  assert.equal(final.status, 'cancelled')
})
