import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { deliverReferenceImage } from '../server/reference-delivery.mjs'

const DATA = 'data:image/png;base64,aGVsbG8='

test('keeps existing public URLs without uploading', async () => {
  assert.deepEqual(await deliverReferenceImage({}, 'https://cdn.example.com/a.png'), { url: 'https://cdn.example.com/a.png', mode: 'public-url' })
})

test('uploads a local data URL with multipart and extracts nested result URL', async (t) => {
  let contentType = '', body = ''
  const server = http.createServer((req, res) => { contentType = req.headers['content-type'] || ''; req.on('data', (chunk) => { body += chunk }); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"data":{"url":"https://cdn.example.com/uploaded.png"}}') }) }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const result = await deliverReferenceImage({ referenceUploadUrl: `http://127.0.0.1:${server.address().port}/upload`, referenceUploadProtocol: 'multipart', referenceUploadField: 'asset', referenceUploadAuthMode: 'none' }, DATA)
  assert.equal(result.url, 'https://cdn.example.com/uploaded.png')
  assert.match(contentType, /multipart\/form-data/)
  assert.match(body, /name="asset"/)
})

test('supports JSON data_url upload services', async (t) => {
  let parsed
  const server = http.createServer((req, res) => { let body = ''; req.on('data', (chunk) => { body += chunk }); req.on('end', () => { parsed = JSON.parse(body); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"result":{"url":"https://cdn.example.com/json.png"}}') }) }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const result = await deliverReferenceImage({ referenceUploadUrl: `http://127.0.0.1:${server.address().port}/upload`, referenceUploadProtocol: 'json', referenceUploadField: 'image', referenceUploadAuthMode: 'none' }, DATA)
  assert.equal(parsed.image, DATA)
  assert.equal(result.url, 'https://cdn.example.com/json.png')
})

test('discovers a standard same-provider image upload endpoint automatically', async (t) => {
  let uploaded = false
  const server = http.createServer((req, res) => {
    uploaded = req.method === 'POST' && req.url === '/v1/uploads/images' && String(req.headers['content-type']).startsWith('multipart/form-data')
    req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"success":true,"data":{"url":"https://files.example.com/reference.jpg"}}') })
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve)); t.after(() => server.close())
  const result = await deliverReferenceImage({ baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', referenceUploadAuthMode: 'bearer' }, DATA)
  assert.equal(result.url, 'https://files.example.com/reference.jpg')
  assert.equal(result.mode, 'upload-auto')
  assert.equal(uploaded, true)
})
