import { describe, expect, test } from 'vitest'
import { initSequences, evalContents, evalContentsMem } from './RandomizeLang.js'

test('initSequences', () => {
  expect(initSequences('abbaccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "abb|acc|adddd".split('|').map(c => c.split(''))
  )

  expect(initSequences('bbaccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "bb|acc|adddd".split('|').map(c => c.split(''))
  )

  expect(initSequences('baccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "b|acc|adddd".split('|').map(c => c.split(''))
  )
})

describe('evalContents', () => {
  test('basic', () => {
    expect(evalContents('')).toStrictEqual([])
    expect(evalContents('a')).toStrictEqual(['a'])
  })

  test('blocks without initial header', () => {
    const text = `
      a
      -=-
      b
      c
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual([
      'a',
      '---',
      'b',
      'c',
    ])
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
      [block('a')]
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual(['[a b]'])
  })

  test('block context explode', () => {
    const text = `
      -=- a
      a
      b
      -=-
      {block('a')}
      -
      {block('a')}
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual(['a', 'b', '-', 'a', 'b'])
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

  test('escaped brackets', () => {
    expect(evalContents('item ["a\\]b"]')).toStrictEqual(['item [a]b]'])
    expect(evalContents('-=-\nitem {s("a\\}b c")}')).toStrictEqual(['item a}b', 'item c'])
  })
})

describe('integration', () => {
  test('aba split', () => {
    const text = `
      -=- a
      1
      2
      -=- b
      3
      4
      -=-
      {[a1,a2]=divide(block('a'), 2); return [...a1, ...block('b'), ...a2];}
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual(['1', '3', '4', '2'])
  })
})


describe('memory', () => {
  test('basic', () => {
    const text = `
      {memory.set('a', (memory.get('a') || 0) + 1);}
    `.replaceAll(/^ */mg, '')

    const [out, mem1] = evalContentsMem(text)
    const [_, mem2] = evalContentsMem(text, mem1)

    expect(out).toStrictEqual([])
    expect(mem1).toStrictEqual(new Map([["a", 1]]))
    expect(mem2).toStrictEqual(new Map([["a", 2]]))
  })
})
