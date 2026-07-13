import { joinUrl } from './adapters.mjs'

const CACHE_TTL = 30 * 60 * 1000
const cache = new Map()
const inFlight = new Map()
const unique = (items) => [...new Set(items.filter(Boolean))]

function safeHttpUrl(value, base) {
  try {
    const url = base ? new URL(value, base) : new URL(value)
    return /^https?:$/.test(url.protocol) ? url.toString() : null
  } catch { return null }
}

function normalizeBase(value) {
  const url = safeHttpUrl(String(value || '').trim())
  if (!url) return null
  const parsed = new URL(url)
  parsed.hash = ''; parsed.search = ''
  parsed.pathname = parsed.pathname
    .replace(/\/(?:apidoc|docs?|documentation)\/?$/i, '/')
    .replace(/\/v1\/(?:media|skills|models)(?:\/.*)?$/i, '')
    .replace(/\/(?:media\/generate|media\/status|models)\/?$/i, '')
    .replace(/\/+$/, '')
  return parsed.toString().replace(/\/$/, '')
}

export function extractApiBaseCandidates(text, sourceUrl = '') {
  const source = String(text || '')
  const found = []
  const named = /(?:baseURL|base_url|apiBaseUrl|api_base|apiUrl|api_url)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi
  for (const match of source.matchAll(named)) {
    const value = safeHttpUrl(match[1], sourceUrl)
    if (value) found.push(normalizeBase(value))
  }
  const versioned = /["'`](https?:\/\/[^\s"'`<>]+?)(?:\/v1)(?:\/|["'`])/gi
  for (const match of source.matchAll(versioned)) found.push(normalizeBase(match[1]))
  return unique(found)
}

function scriptUrls(html, pageUrl) {
  const urls = []
  for (const match of String(html || '').matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const url = safeHttpUrl(match[1], pageUrl)
    if (url) urls.push(url)
  }
  for (const match of String(html || '').matchAll(/<link[^>]+(?:rel=["']modulepreload["'][^>]+href|href)=["']([^"']+\.js)["']/gi)) {
    const url = safeHttpUrl(match[1], pageUrl)
    if (url) urls.push(url)
  }
  return unique(urls).slice(0, 12)
}

async function fetchText(url, timeoutMs = 8_000, maxChars = 2_000_000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { accept: 'text/html,application/javascript,application/json;q=0.9,*/*;q=0.5' } })
    const text = (await response.text()).slice(0, maxChars)
    return { response, text }
  } finally { clearTimeout(timer) }
}

async function probeApiBase(baseUrl) {
  for (const endpoint of ['/v1/models', '/models']) {
    try {
      const { response, text } = await fetchText(joinUrl(baseUrl, endpoint), 6_000, 40_000)
      const contentType = response.headers.get('content-type') || ''
      const jsonLike = /json/i.test(contentType) || /^\s*[\[{]/.test(text)
      if ([401, 403].includes(response.status) || response.ok && jsonLike && !/<html/i.test(text)) return { ok: true, endpoint, status: response.status }
    } catch {}
  }
  return { ok: false }
}

export async function discoverApiBaseUrl(inputUrl, { force = false } = {}) {
  const input = normalizeBase(inputUrl)
  if (!input) return { inputUrl, baseUrl: null, changed: false, source: 'invalid', candidates: [] }
  const cached = cache.get(input)
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.value
  if (!force && inFlight.has(input)) return inFlight.get(input)

  const pending = discoverUncached(inputUrl, input)
  inFlight.set(input, pending)
  try { return await pending } finally { inFlight.delete(input) }
}

async function discoverUncached(inputUrl, input) {

  const candidates = [input]
  const direct = await probeApiBase(input)
  if (direct.ok) {
    const value = { inputUrl: input, baseUrl: input, changed: false, source: 'direct-probe', endpoint: direct.endpoint, candidates: [input] }
    cache.set(input, { at: Date.now(), value }); return value
  }

  try {
    const page = await fetchText(input, 10_000, 1_000_000)
    candidates.push(...extractApiBaseCandidates(page.text, page.response.url || input))
    const scripts = scriptUrls(page.text, page.response.url || input)
    const bodies = await Promise.all(scripts.map(async (url) => { try { return (await fetchText(url)).text } catch { return '' } }))
    for (const body of bodies) candidates.push(...extractApiBaseCandidates(body, input))
  } catch {}

  for (const candidate of unique(candidates)) {
    if (candidate === input) continue
    const probe = await probeApiBase(candidate)
    if (probe.ok) {
      const value = { inputUrl: input, baseUrl: candidate, changed: candidate !== input, source: 'document-discovery', endpoint: probe.endpoint, candidates: unique(candidates) }
      cache.set(input, { at: Date.now(), value }); return value
    }
  }
  const value = { inputUrl: input, baseUrl: input, changed: false, source: 'unresolved', candidates: unique(candidates) }
  cache.set(input, { at: Date.now(), value }); return value
}

export async function resolveMediaConfig(config) {
  const next = { ...config }, discoveries = {}
  const keys = ['baseUrl', 'imageBaseUrl', 'videoBaseUrl'].filter((key) => next[key])
  const resolved = await Promise.all(keys.map(async (key) => [key, await discoverApiBaseUrl(next[key])]))
  for (const [key, discovered] of resolved) { discoveries[key] = discovered; if (discovered.baseUrl) next[key] = discovered.baseUrl }
  return { config: next, discoveries }
}

export function clearProviderDiscoveryCache() { cache.clear(); inFlight.clear() }
