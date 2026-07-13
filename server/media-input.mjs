import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const run = (binary, args) => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let error = ''
  child.stderr.on('data', (chunk) => { error += chunk })
  child.on('error', reject)
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(error || `图片压缩失败 (${code})`)))
})

export async function compactMediaReference(value, maxChars = 650_000) {
  if (!String(value || '').startsWith('data:') || value.length <= maxChars) return value
  const match = value.match(/^data:([^;]+);base64,(.+)$/s)
  if (!match) throw new Error('参考图 data URL 格式无效')
  if (process.platform !== 'darwin') throw new Error('参考图体积过大；请上传压缩图或让图片接口返回可访问 URL，避免上游 413')
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ugc-flow-media-'))
  const input = path.join(temp, 'input'), output = path.join(temp, 'reference.jpg')
  try {
    await fs.writeFile(input, Buffer.from(match[2], 'base64'))
    await run('/usr/bin/sips', ['--resampleHeightWidthMax', '1280', '--setProperty', 'format', 'jpeg', '--setProperty', 'formatOptions', '62', input, '--out', output])
    const encoded = (await fs.readFile(output)).toString('base64')
    if (encoded.length > maxChars) throw new Error('参考图压缩后仍过大；请使用 URL 图片或尺寸更小的参考图')
    return `data:image/jpeg;base64,${encoded}`
  } finally { await fs.rm(temp, { recursive: true, force: true }) }
}

export function compactPrompt(value, maxChars) {
  const text = String(value || '').replace(/data:[^\s]+/g, '[image reference omitted]')
  return text.length > maxChars ? `${text.slice(0, maxChars - 32)}\n[truncated locally]` : text
}
