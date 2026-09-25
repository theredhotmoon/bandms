import { readFileSync } from 'node:fs'
import { copyHits } from './lib/template-scan.mjs'
for (const f of process.argv.slice(2)) {
  console.log(`--- ${f} ---`)
  for (const h of copyHits(readFileSync('src/'+f,'utf8'), { isTs: f.endsWith('.ts') }))
    for (const t of h.hits) console.log(String(h.line).padStart(5), JSON.stringify(t))
}
