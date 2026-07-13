import test from 'node:test'
import assert from 'node:assert/strict'
import { userErrorMessage } from '../src/lib/user-error.js'

test('turns verbose image-to-video upstream failures into a short action', () => {
  const message = '所有候选模型或端点均失败：grok-video-1.5-preview @ /videos/generations: 500 grok-video-1.5-preview only supports image-to-video; one reference image is required; grok-video-1.5-preview @ /media/generate: 404 Invalid URL'
  const result = userErrorMessage(message)
  assert.match(result, /上传 1 张参考图/)
  assert.ok(result.length < 100)
})
