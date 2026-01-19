import { describe, expect, test } from 'vitest'
import { initSequences, evalContents } from './RandomizeLang.js'

test('initSequences', () => {
  expect(initSequences('abbaccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "abb|acc|adddd".split('|').map(c => c.split(''))
  )
})

describe('evalContents', () => {
  test('basic', () => {
    expect(evalContents('')).toStrictEqual([])
    expect(evalContents('a')).toStrictEqual(['a'])
  })

  test('blocks', () => {
    const text = `
      -=-
      a
      b
      -=-
      c
      d
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual([
      'a',
      'b',
      '---',
      'c',
      'd',
    ])
  })

  test('block context interpolate', () => {
    const text = `
      -=- a
      a
      b
      -=-
      [context.get('a')]
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual(['[a b]'])
  })

  test('block context explode', () => {
    const text = `
      -=- a
      a
      b
      -=-
      {context.get('a')}
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual(['a', 'b'])
  })

  test('copies', () => {
    const text = `
      -=-
      a
      2x b
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual([
      'a',
      'b',
      'b',
    ])
  })

  test('eval interpolate', () => {
    expect(evalContents('item [1]')).toStrictEqual(['item [1]'])
    expect(evalContents('item ["a"]')).toStrictEqual(['item [a]'])
    expect(evalContents('item [s("a b")]')).toStrictEqual(['item [a b]'])
  })

  test('eval explode', () => {
    expect(evalContents('-=-\nitem {s("abc")}')).toStrictEqual(['item a', 'item b', 'item c'])
    expect(evalContents('-=-\nitem {divide(s("ab"), 2)}')).toStrictEqual(['item [a]', 'item [b]'])
    expect(evalContents('-=-\nitem {divide(s("abcd"), 2)}')).toStrictEqual(['item [a b]', 'item [c d]'])
  })
})
