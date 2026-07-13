import test from 'node:test'
import assert from 'node:assert/strict'
import { configuredVideoParams, jsonVideoParams, mediaParamsFor, parseParamsJson } from '../server/media-profiles.mjs'
import { VIDEO_MODEL_PROFILES, getVideoModelProfile, normalizeVideoSelection, videoSelectionParams } from '../shared/video-models.mjs'

test('builds model-family media params while allowing JSON overrides', () => {
  assert.deepEqual(mediaParamsFor({ kind: 'video', model: 'grok-video-1.5-preview', references: ['https://cdn.example.com/ref.png'] }), { aspect_ratio: '9:16', resolution: '720p', duration: '15', images: 'https://cdn.example.com/ref.png' })
  assert.deepEqual(mediaParamsFor({ kind: 'video', model: 'grok-imagine-video-1.5-preview', references: ['https://cdn.example.com/ref.png'] }), { aspect_ratio: '9:16', resolution: '720p', duration: '15', images: 'https://cdn.example.com/ref.png' })
  assert.deepEqual(mediaParamsFor({ kind: 'video', model: 'sora-2', references: ['ref.png'], overrides: { duration: '8' } }), { duration: '8', orientation: 'portrait', aspect_ratio: '9:16', size: '720x1280', seconds: '12', input_reference: 'ref.png' })
  assert.equal(mediaParamsFor({ kind: 'video', model: 'kling-v3-video' }).mode, 'std')
  assert.equal(mediaParamsFor({ kind: 'video', model: 'wan2.7-cankaosheng', references: ['ref.png'] })._mode, 'wan2.7-r2v')
  assert.equal(mediaParamsFor({ kind: 'image', model: 'gpt-image-2' }).quality, 'auto')
  assert.deepEqual(parseParamsJson('{"duration":"10"}'), { duration: '10' })
  assert.throws(() => parseParamsJson('[]'), /JSON 对象/)
})

test('normalizes known Veo constraints and integer JSON duration fields', () => {
  assert.deepEqual(configuredVideoParams({ videoModels: 'veo3.1-quality', videoProfile: 'custom', videoDuration: '15', videoResolution: '720p', videoAspectRatio: '9:16' }, 'veo3.1-quality'), { duration: '8', seconds: '8', size: '720x1280', aspect_ratio: '9:16', orientation: 'portrait' })
  assert.deepEqual(jsonVideoParams({ duration: '6s', seconds: '8', resolution: '720p' }), { duration: 6, seconds: 8, resolution: '720p' })
})

test('video model options follow documented duration, resolution, ratio, and version constraints', () => {
  assert.equal(VIDEO_MODEL_PROFILES.length, 14)
  const grok3 = getVideoModelProfile('grok-video-3')
  assert.deepEqual(grok3.durations, ['10', '15'])
  assert.deepEqual(grok3.resolutions, ['720P', '1080P'])
  assert.deepEqual(grok3.ratios, ['16:9', '9:16'])
  const relayGrok = getVideoModelProfile('grok-video-1.5-preview')
  assert.equal(relayGrok.id, 'grok-video-1.5-preview')
  assert.equal(relayGrok.audio, true)
  const grok = getVideoModelProfile('grok-imagine-video-1.5-preview')
  assert.equal(grok.requiresImage, true)
  assert.deepEqual(grok.durations, Array.from({ length: 15 }, (_, index) => String(index + 1)))
  assert.deepEqual(grok.resolutions, ['720p', '480p', '1080p'])
  assert.deepEqual(grok.ratios, ['16:9', '9:16', '1:1', '3:2', '2:3'])
  assert.deepEqual(videoSelectionParams(grok.id, { duration: '7', resolution: '480p', aspectRatio: '2:3' }), { duration: '7', resolution: '480p', aspect_ratio: '2:3' })
  assert.deepEqual(getVideoModelProfile('sora-2').durations, ['4', '8', '12'])
  assert.deepEqual(getVideoModelProfile('kling-v3-video').durations, ['5', '10', '15'])
  assert.deepEqual(getVideoModelProfile('gemini_omni_flash').durations, ['6', '10'])
  assert.equal(getVideoModelProfile('viduq3-pro').audio, true)
  const seedance = getVideoModelProfile('kwvideo-v2-ref')
  assert.ok(seedance.resolutions.includes('4K'))
  assert.equal(normalizeVideoSelection(seedance, { resolution: '4K', mode: '快速' }).mode, '标准')
  assert.deepEqual(videoSelectionParams('happyhorse-1.1-t2v', { duration: '15', resolution: '1080P', aspectRatio: '9:16' }), { duration: '15', resolution: '1080P', ratio: '9:16' })
})

test('custom video profile preserves manually entered duration, size, ratio, and quality', () => {
  assert.deepEqual(videoSelectionParams('vendor-kling-alias', { duration: '7.5', resolution: '1440x2560', aspectRatio: '9:16', mode: 'ultra' }, 'custom'), { duration: '7.5', resolution: '1440x2560', aspect_ratio: '9:16', mode: 'ultra' })
})

test('manual model change ignores a stale incompatible profile', () => {
  assert.deepEqual(configuredVideoParams({ videoModels: 'grok-video-3', videoProfile: 'grok-video-1.5-preview', videoDuration: '15', videoResolution: '720p', videoAspectRatio: '9:16' }, 'grok-video-3'), { duration: '15', resolution: '720P', aspect_ratio: '9:16' })
})
