import { describe, expect, test } from 'vitest'
import { parseContents, generateCombinations, localCombinations } from './RandomizeLang.js'

describe('parseContents', () => {
  test('basic', () => {
    expect(parseContents('')).toStrictEqual([[]])
    expect(parseContents('a')).toStrictEqual([[[0, 'a']]])
  })

  test('copies', () => {
    const text = `
      a
      2x b
    `.replaceAll(/^ */mg, '')

    expect(parseContents(text)).toStrictEqual([[
      [0, 'a'],
      [1, 'b'],
      [1, 'b'],
    ]])
  })

  test('groups', () => {
    expect(parseContents('{a,b}')).toStrictEqual([[
      [0, 'a'],
      [1, 'b'],
    ]])
  })

  test('groups multiplied', () => {
    expect(parseContents('1x {a,b}')).toStrictEqual([[
      [0, 'a'],
      [1, 'b'],
    ]])

    expect(parseContents('2x {a,b}')).toStrictEqual([[
      [0, 'a'],
      [0, 'a'],
      [1, 'b'],
      [1, 'b'],
    ]])
  })

  test('chunks', () => {
    const text = `
      a
      ---
      2x b
    `.replaceAll(/^ */mg, '')

    expect(parseContents(text)).toStrictEqual([
      [
        [0, 'a'],
      ],
      [
        [0, 'b'],
        [0, 'b'],
      ],
    ])
  })
})

describe('generateCombinations', () => {
  test('basic', () => {
    expect(generateCombinations('a')).toStrictEqual(['a'])
  })

  test('group', () => {
    expect(generateCombinations('a {thing1,thing2}')).toStrictEqual([
      'a thing1',
      'a thing2',
    ])
  })

  test('two groups', () => {
    expect(generateCombinations('a {thing1,thing2} b {2,3,4}')).toStrictEqual([
      'a thing1 b 2',
      'a thing2 b 2',
      'a thing1 b 3',
      'a thing2 b 3',
      'a thing1 b 4',
      'a thing2 b 4',
    ])
  })
})

describe('localCombinations', () => {
  test('basic', () => {
    expect(localCombinations('a')).toStrictEqual('a')
  })

  test('trivial shuffle', () => {
    expect(localCombinations('a [123]')).toStrictEqual('a [123]')
  })

  test('shuffle', () => {
    const possibilities = [
      'a [1 2 3]',
      'a [1 3 2]',
      'a [2 1 3]',
      'a [3 1 2]',
      'a [2 3 1]',
      'a [3 2 1]',
    ]
    const out = localCombinations('a [1 2 3]')
    expect(possibilities.indexOf(out)).not.equal(-1)
  })

  test('shuffle twice', () => {
    const possibilities = [
      'a [1 2] [a b]',
      'a [2 1] [a b]',
      'a [1 2] [b a]',
      'a [2 1] [b a]',
    ]
    const out = localCombinations('a [1 2] [a b]')
    expect(possibilities.indexOf(out)).not.equal(-1)
  })

  test('combinations', () => {
    const pattern = /a \[(1a|1b|2a|2b) (1a|1b|2a|2b) (1a|1b|2a|2b) (1a|1b|2a|2b)\]/
    const out = localCombinations('a [{1,2}{a,b}]')
    expect(out.match(pattern)).not.equal(null)
  })
})
