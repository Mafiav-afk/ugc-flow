import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MERCHANT_TEMPLATES } from '../src/data/merchantTemplates.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'skills', 'merchant-ugc-campaign', 'assets', 'merchant-templates.json')
await fs.mkdir(path.dirname(out), { recursive: true })
await fs.writeFile(out, `${JSON.stringify({ version: 1, count: MERCHANT_TEMPLATES.length, templates: MERCHANT_TEMPLATES }, null, 2)}\n`)
console.log(`Exported ${MERCHANT_TEMPLATES.length} templates to ${out}`)
