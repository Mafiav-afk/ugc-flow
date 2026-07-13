import test from 'node:test'
import assert from 'node:assert/strict'
import { compactMediaReference, compactPrompt } from '../server/media-input.mjs'

test('removes embedded media and caps prompts before upstream submission', () => {
  const prompt = `start data:image/png;base64,${'a'.repeat(2000)} end`
  const compacted = compactPrompt(prompt, 120)
  assert.ok(compacted.length <= 120)
  assert.doesNotMatch(compacted, /base64/)
})

test('keeps URLs and small data references unchanged', async () => {
  assert.equal(await compactMediaReference('https://example.com/reference.png'), 'https://example.com/reference.png')
  const small = 'data:image/png;base64,aGVsbG8='
  assert.equal(await compactMediaReference(small), small)
})
