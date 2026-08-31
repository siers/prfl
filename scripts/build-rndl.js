#!/usr/bin/env node

// Bundles scripts/rndl into a standalone .bin/rndl.mjs that plain `node` can
// run. esbuild strips types without typechecking, so this build is ~15ms; run
// `npm run typecheck` separately when you want the checks.

import { build } from 'esbuild'
import { chmodSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, '.bin/rndl.mjs')

// scripts/rndl starts with a `#!/bin/sh` + `":" //` trampoline so it stays
// directly runnable. Those two lines are shell, not JS, so feed esbuild the
// body with them stripped rather than letting them land in the bundle.
const entry = readFileSync(join(root, 'scripts/rndl'), 'utf-8')
  .split('\n').slice(2).join('\n')

await build({
  stdin: {
    contents: entry,
    resolveDir: join(root, 'scripts'),
    sourcefile: 'rndl.ts',
    loader: 'ts',
  },
  outfile,
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // Dependencies are inlined so the bundle runs from any cwd, not just a
  // directory that can resolve the repo's node_modules.
  banner: { js: '#!/usr/bin/env node' },
})

chmodSync(outfile, 0o755)
console.log(`built ${outfile}`)
