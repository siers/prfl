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
    expect(evalContents('a')).toStrictEqual([[0, 'a']])
  })

  test('copies', () => {
    const text = `
      a
      2x b
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual([
      [0, 'a'],
      [1, 'b'],
      [2, 'b'],
    ])
  })

  // test('blocks', () => {
  //   expect(evalContents('1x a')).toStrictEqual([
  //     [0, 'a'],
  //     [1, 'a'],
  //   ])

  //   expect(evalContents('2x a')).toStrictEqual([
  //     [0, 'a'],
  //     [1, 'a'],
  //   ])
  // })
})
