import { extractModelIds, requestCompatible, splitPool } from './adapters.mjs'

const definitionCache = new Map()
const DEFINITION_TTL = 30 * 60 * 1000

const detail = (data) => data?.data && !Array.isArray(data.data) ? data.data : data
const modelName = (item) => typeof item === 'string' ? item : item?.name || item?.id || item?.model
const isTextVideoName = (value) => /(?:^|[-_.])t2v(?:$|[-_.])|text[-_. ]?to[-_. ]?video|文生视频/i.test(String(value || ''))

export function requiredUploadParams(data) {
  const model = detail(data) || {}
  return (Array.isArray(model.params) ? model.params : []).filter((param) => {
    const type = String(param.type || param.leixing || '').toLowerCase()
    return ['upload', 'file', 'image'].includes(type) && Boolean(param.required ?? param.bixian)
  }).map((param) => param.name || param.mingcheng).filter(Boolean)
}

export async function fetchModelDefinition(config, model, signal) {
  const key = `${config.baseUrl || ''}|${model}`
  const cached = definitionCache.get(key)
  if (cached && Date.now() - cached.at < DEFINITION_TTL) return cached.value
  const checked = await requestCompatible(config, {
    endpoints: config.videoModelDetailPath || '/v1/skills/models/{model}', models: [model],
    makeOptions: async () => ({ method: 'GET', signal, headers: { 'content-type': undefined }, timeoutMs: 20_000 }),
  })
  const value = detail(checked.data); definitionCache.set(key, { at: Date.now(), value }); return value
}

export async function discoverTextVideoModel(config, preferredModels, signal) {
  let catalog = []
  try {
    const checked = await requestCompatible(config, {
      endpoints: config.videoModelsPath || '/v1/skills/models?type=video\n/v1/media/models', models: ['video-catalog'],
      makeOptions: async () => ({ method: 'GET', signal, headers: { 'content-type': undefined }, timeoutMs: 20_000 }),
    })
    const rows = Array.isArray(checked.data?.data) ? checked.data.data : Array.isArray(checked.data?.models) ? checked.data.models : Array.isArray(checked.data?.data?.models) ? checked.data.data.models : []
    catalog = rows.map(modelName).filter(Boolean)
  } catch {}
  const candidates = [...new Set([...splitPool(preferredModels), ...catalog.filter(isTextVideoName)])].slice(0, 16)
  for (const model of candidates) {
    if (!isTextVideoName(model) && !catalog.includes(model)) continue
    try {
      const definition = await fetchModelDefinition(config, model, signal)
      if (String(definition?.type || '').toLowerCase() === 'video' && requiredUploadParams(definition).length === 0) return { model, definition, source: 'provider-catalog' }
    } catch {}
  }
  const heuristic = candidates.find(isTextVideoName)
  return heuristic ? { model: heuristic, definition: null, source: 'name-fallback' } : null
}

export async function modelRequiresPublicReference(config, model, signal) {
  try {
    const definition = await fetchModelDefinition(config, model, signal)
    return { required: requiredUploadParams(definition).length > 0, params: requiredUploadParams(definition), definition }
  } catch {
    return { required: /grok.*(?:imagine|video)/i.test(model), params: /grok/i.test(model) ? ['images'] : [], definition: null }
  }
}
