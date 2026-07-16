// Runs after `vite build`. Walks dist/, builds a precache manifest of every
// built file (content-hashed filenames mean the list can't be static), hashes
// the manifest itself into a cache version, and writes the final dist/sw.js
// from the sw.js template with placeholders substituted.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const BASE = '/perflab/'
const DIST_DIR = new URL('../dist', import.meta.url).pathname
const SW_TEMPLATE = new URL('../sw.js', import.meta.url).pathname

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(DIST_DIR)
const urls = files
  .map(full => BASE + relative(DIST_DIR, full).split(sep).join('/'))
  .sort()

const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12)

const template = readFileSync(SW_TEMPLATE, 'utf8')
const output = template
  .replace('__CACHE_VERSION__', version)
  .replace('__PRECACHE_URLS__', JSON.stringify(urls))

writeFileSync(join(DIST_DIR, 'sw.js'), output)
console.log(`Wrote dist/sw.js (cache prfl-${version}, ${urls.length} precached files)`)
