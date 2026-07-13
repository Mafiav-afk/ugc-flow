import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const target=process.argv[2], root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
if(!['codex','claude'].includes(target)){console.error('Usage: npm run deploy:codex | npm run deploy:claude');process.exit(1)}
const base=process.env.UGC_FLOW_DEPLOY_ROOT || (target==='codex'?path.join(os.homedir(),'.codex','skills'):path.join(os.homedir(),'.claude','skills'))
for(const name of ['ai-ugc-realism','winning-ad-formats','merchant-ugc-campaign','ugc-flow-agent'])await fs.cp(path.join(root,'skills',name),path.join(base,name),{recursive:true,force:true})
console.log(`UGC Flow skills installed to ${base}`)
