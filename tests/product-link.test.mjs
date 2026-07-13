import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductPage } from '../server/product-link.mjs'

test('extracts product title, selling points and absolute main image from page metadata', () => {
  const result = parseProductPage('<meta property="og:title" content="轻薄防晒"><meta name="description" content="清爽成膜，不黏腻"><meta property="og:image" content="/main.webp">', 'https://shop.example.com/item/1')
  assert.deepEqual(result, { url: 'https://shop.example.com/item/1', name: '轻薄防晒', sellingPoints: '清爽成膜，不黏腻', image: 'https://shop.example.com/main.webp' })
})
