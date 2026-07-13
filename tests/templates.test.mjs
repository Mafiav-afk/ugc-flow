import test from 'node:test'
import assert from 'node:assert/strict'
import { MERCHANT_TEMPLATES, TEMPLATE_CATEGORIES } from '../src/data/merchantTemplates.js'
import { buildDemoStrategy } from '../server/demo.mjs'

test('merchant catalog covers broad categories with complete replication data', () => {
  assert.equal(MERCHANT_TEMPLATES.length, 25)
  assert.ok(TEMPLATE_CATEGORIES.length >= 12)
  for (const item of MERCHANT_TEMPLATES) {
    assert.equal(item.brief.replication.shots.length, 8)
    assert.ok(item.brief.replication.structure)
    assert.ok(item.brief.notes)
    assert.ok(item.tags.includes(item.category))
  }
})

test('demo workflow fully adopts the selected merchant template', () => {
  const selected = MERCHANT_TEMPLATES.find((item) => item.id === 'pet-toy')
  const strategy = buildDemoStrategy(selected.brief)
  assert.equal(strategy.shots[0], selected.hook)
  assert.equal(strategy.shots.length, 8)
  assert.equal(strategy.replication.category, '宠物用品')
  assert.equal(strategy.replication.templateId, 'pet-toy')
})
