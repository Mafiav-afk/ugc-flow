import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('Codex output schema requires every declared root property', async () => {
  const schema = JSON.parse(await fs.readFile(new URL('../server/agent-output.schema.json', import.meta.url), 'utf8'))
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort())
  assert.ok(schema.required.includes('imageUrl'))
})
