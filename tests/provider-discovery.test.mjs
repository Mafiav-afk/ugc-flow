import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { clearProviderDiscoveryCache, discoverApiBaseUrl, extractApiBaseCandidates } from '../server/provider-discovery.mjs'

const listen = async (server) => { server.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); return `http://127.0.0.1:${server.address().port}` }

test.afterEach(() => clearProviderDiscoveryCache())

test('extracts generic API base declarations without vendor hardcoding', () => {
  assert.deepEqual(extractApiBaseCandidates('const config={baseURL:`https://api.example.test`};'), ['https://api.example.test'])
  assert.deepEqual(extractApiBaseCandidates('api_base="https://gateway.example.test/v1"'), ['https://gateway.example.test/v1', 'https://gateway.example.test'])
})

test('normalizes a pasted full media endpoint back to an API root', async () => {
  const apiServer = http.createServer((req, res) => {
    if (req.url === '/v1/models') { res.writeHead(401, { 'content-type': 'application/json' }); res.end('{"error":"missing key"}'); return }
    res.writeHead(404).end()
  })
  const apiBase = await listen(apiServer)
  const result = await discoverApiBaseUrl(`${apiBase}/v1/media/generate`)
  apiServer.close()
  assert.equal(result.baseUrl, apiBase)
  assert.equal(result.source, 'direct-probe')
})

test('discovers an API origin from a documentation frontend bundle', async (t) => {
  const apiServer = http.createServer((req, res) => {
    if (req.url === '/v1/models') { res.writeHead(401, { 'content-type': 'application/json' }); res.end('{"error":"missing key"}'); return }
    res.writeHead(404).end()
  })
  const apiBase = await listen(apiServer); t.after(() => apiServer.close())
  const docServer = http.createServer((req, res) => {
    if (req.url === '/assets/app.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(`const client={baseURL:\`${apiBase}\`}`); return }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html><script src="/assets/app.js"></script></html>')
  })
  const docBase = await listen(docServer); t.after(() => docServer.close())
  const result = await discoverApiBaseUrl(`${docBase}/apidoc#model/example`)
  assert.equal(result.baseUrl, apiBase)
  assert.equal(result.changed, true)
  assert.equal(result.source, 'document-discovery')
})
