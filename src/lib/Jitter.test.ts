import { expect, test } from 'vitest'
import _ from 'lodash'
import { jitter } from './Jitter'
import { seededRandom } from './Random'

function jitterOrder(items: string[], seed: number, spreadPercent?: number, gain?: number): string {
  return jitter(items, spreadPercent, gain, seededRandom(seed)).join('')
}

const LETTERS = [...'abcdefghijklmno']

// Defaults (100%, gain 0.7, boosted below ~8 items), one line per length 1..15. Each line gets its own
// seed: reusing one would hand the first items the same draws on every line.
test('jitter: seeded defaults by length, seeds 101..115', () => {
  expect(_.range(1, 16).map(n => jitterOrder(LETTERS.slice(0, n), 100 + n))).toStrictEqual([
    'a',
    'ab',
    'acb',
    'abdc',
    'abdce',
    'acbedf',
    'abcdfge',
    'abcefdgh',
    'adbcefhgi',
    'abecfdhgij',
    'cabdghifejk',
    'abedcgfikhlj',
    'abcfdeghijlkm',
    'abcedfjgikhmln',
    'adgbcefhkijlmno',
  ])
})

test('jitter: seeded defaults by length, seeds 201..215', () => {
  expect(_.range(1, 16).map(n => jitterOrder(LETTERS.slice(0, n), 200 + n))).toStrictEqual([
    'a',
    'ab',
    'bac',
    'abcd',
    'acbde',
    'abdcef',
    'abecdgf',
    'abcfdgeh',
    'adbfecghi',
    'cbafdgehij',
    'abdcfehgijk',
    'acfbdheijgkl',
    'aebcgdfjikhml',
    'aebfhcgdijlkmn',
    'aebcghdjflkimno',
  ])
})

test('jitter: seeded showcase, 50% is calmer', () => {
  const items = [...'abcdefghijkl']
  expect(jitterOrder(items, 1, 50)).toBe('abcfdeghikjl')
  expect(jitterOrder(items, 2, 50)).toBe('abcdefghjikl')
  expect(jitterOrder(items, 3, 50)).toBe('abdcefhgijkl')
})

test('jitter: seeded showcase, gain 1 moves the edges more', () => {
  const items = [...'abcdefghijkl']
  expect(jitterOrder(items, 1, 100, 1)).toBe('bacfdgiehklj')
  expect(jitterOrder(items, 2, 100, 1)).toBe('bacdhgfjeilk')
})

test('jitter: 0% or gain 0 keeps the order', () => {
  const items = [...'abcdefghijkl']
  for (let seed = 0; seed < 20; seed++) {
    expect(jitterOrder(items, seed, 0)).toBe('abcdefghijkl')
    expect(jitterOrder(items, seed, 100, 0)).toBe('abcdefghijkl')
  }
})

test('jitter: nothing moves ceil(spreadPercent% of the length) places or more', () => {
  for (const length of [1, 2, 5, 10, 20]) {
    const items = _.range(length)
    const spread = Math.ceil(length * 50 / 100)
    for (let seed = 0; seed < 200; seed++) {
      jitter(items, 50, undefined, seededRandom(seed)).forEach((item, index) => {
        expect(Math.abs(item - index)).toBeLessThan(Math.max(spread, 1))
      })
    }
  }
})
