import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_CACHE_TTL = 30 * 60 * 1000
const planCache = new Map()
const schemaPath = path.join(root, 'server', 'agent-output.schema.json')
const candidates = {
  codex: ['/Applications/ChatGPT.app/Contents/Resources/codex', '/usr/local/bin/codex', '/opt/homebrew/bin/codex'],
  claude: [path.join(os.homedir(), '.local/bin/claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude'],
}

async function executable(provider) {
  for (const candidate of candidates[provider] || []) {
    try { await fs.access(candidate, 1); return candidate } catch {}
  }
  return null
}

function run(binary, args, { input = '', timeoutMs = 240_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: root, env: { ...process.env, NO_COLOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', settled = false
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('本地智能体执行超时')) }, timeoutMs)
    child.stdout.on('data', (chunk) => { if (stdout.length < 1_000_000) stdout += chunk })
    child.stderr.on('data', (chunk) => { if (stderr.length < 100_000) stderr += chunk })
    child.on('error', (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error) } })
    child.on('close', (code) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error((stderr || stdout || `${providerLabel(binary)} 退出码 ${code}`).trim().slice(-1200)))
    })
    child.stdin.end(input)
  })
}

const providerLabel = (binary) => binary.includes('claude') ? 'Claude' : 'Codex'
const parseJson = (value) => {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('智能体没有返回可识别的 JSON')
  return JSON.parse(text.slice(start, end + 1))
}

function compactBrief(brief, config) {
  const clean = (value, max) => String(value || '').replace(/data:[^\s]+/g, '[media omitted]').slice(0, max)
  return {
    name: clean(brief.name, 200), sellingPoints: clean(brief.sellingPoints, 1800), audience: clean(brief.audience, 600),
    format: clean(brief.format, 160), notes: clean(brief.notes, 1200), url: clean(brief.url, 500),
    references: (brief.assets || []).slice(0, 4).map((item) => ({ name: clean(item.name, 180), type: clean(item.type, 80), size: Number(item.size || 0) })),
    video: { model: clean(config.videoModel || config.videoModels, 300), duration: clean(config.videoDuration, 20), resolution: clean(config.videoResolution, 40), ratio: clean(config.videoAspectRatio, 20), mode: clean(config.videoMode, 40) },
  }
}

function promptFor(provider, brief, config) {
  const invocation = provider === 'claude' ? '/ugc-flow-agent' : '$ugc-flow-agent'
  const imageInstruction = provider === 'codex' && config.imageSource === 'agent' ? ' If an image-generation tool is available, generate the reference image and return its public downloadable URL in imageUrl. Never invent a URL; return an empty string when unavailable.' : ' Always return imageUrl as an empty string.'
  return `${invocation}\nCreate the compact UGC Flow execution JSON for this brief. Use installed merchant UGC skills as needed.${imageInstruction} Never include base64 or full skill text. Return JSON only.\nINPUT=${JSON.stringify(compactBrief(brief, config))}`
}

export async function agentStatuses() {
  const result = {}
  for (const provider of ['codex', 'claude']) {
    const binary = await executable(provider)
    if (!binary) { result[provider] = { installed: false, authenticated: false }; continue }
    try {
      const args = provider === 'codex' ? ['login', 'status'] : ['auth', 'status']
      const checked = await run(binary, args, { timeoutMs: 8_000 })
      const combined = `${checked.stdout}\n${checked.stderr}`
      const authenticated = provider === 'codex' ? /Logged in/i.test(combined) : /"loggedIn"\s*:\s*true/i.test(combined)
      result[provider] = { installed: true, authenticated, path: binary, message: authenticated ? '已连接' : '尚未登录' }
    } catch (error) { result[provider] = { installed: true, authenticated: false, path: binary, message: error.message.slice(0, 300) } }
  }
  return result
}

export async function runAgentPlan(provider, brief, config) {
  if (!['codex', 'claude'].includes(provider)) throw new Error('请选择 Codex 或 Claude 智能体')
  const binary = await executable(provider)
  if (!binary) throw new Error(`${provider === 'codex' ? 'Codex' : 'Claude'} CLI 未安装`) 
  const prompt = promptFor(provider, brief, config)
  if (prompt.length > 12_000) throw new Error('智能体输入过长，请精简商品备注')
  const cacheKey = `${provider}|${prompt}`
  const cached = planCache.get(cacheKey)
  if (cached && Date.now() - cached.at < PLAN_CACHE_TTL) return { plan: cached.plan, provider, cached: true }
  if (provider === 'codex') {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ugc-flow-agent-'))
    const output = path.join(temp, 'result.json')
    try {
      await run(binary, ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--output-schema', schemaPath, '--output-last-message', output, '-C', root, prompt], { timeoutMs: 120_000 })
      const plan = parseJson(await fs.readFile(output, 'utf8')); planCache.set(cacheKey, { at: Date.now(), plan }); return { plan, provider, cached: false }
    } finally { await fs.rm(temp, { recursive: true, force: true }) }
  }
  const schema = await fs.readFile(schemaPath, 'utf8')
  const response = await run(binary, ['--print', '--output-format', 'json', '--json-schema', schema, '--permission-mode', 'dontAsk', '--tools', '', prompt], { timeoutMs: 120_000 })
  const envelope = parseJson(response.stdout)
  const plan = envelope.structured_output || parseJson(envelope.result || response.stdout); planCache.set(cacheKey, { at: Date.now(), plan }); return { plan, provider, cached: false }
}
