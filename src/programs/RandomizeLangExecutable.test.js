import { describe, expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const rndl = path.resolve(import.meta.dirname, '../../scripts/rndl')
const basic = path.resolve(import.meta.dirname, '../../exercises/basic.rndl')


describe('rndl', () => {
  test('evaluates basic', () => {
    // scripts/rndl exercises/basic.rndl
    const output = execFileSync(rndl, [basic], { encoding: 'utf-8' })

    expect(output).toBe(
      `
        1 [aY bZ]
        2 [aY bZ]
        3 [aY bZ]
      `.replaceAll(/^ */mg, '')
    )
  })
})
