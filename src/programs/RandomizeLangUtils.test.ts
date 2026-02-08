import { describe, expect, test } from 'vitest'
import { randomizeLangUtils } from './RandomizeLangUtils'

const {
  s,
  cross,
  times,
  parts,
  divide,
  // partChunks,
  // mj,
  j,
  jj,
  zip,
  shuffle,
} = randomizeLangUtils(new Map(), new Map())

test('s', () => {
  expect(s('')).toStrictEqual([])
  expect(s('GDAE')).toStrictEqual(['G', 'D', 'A', 'E'])
  expect(s('one two three')).toStrictEqual(['one', 'two', 'three'])
  expect(s('one two, three four')).toStrictEqual(['one two', 'three four'])
})

test('cross', () => {
  expect(cross('12 x ab')).toStrictEqual(s('1a 1b 2a 2b'))
})

test('times', () => {
  expect(times('f', 3)).toStrictEqual(['f', 'f', 'f'])
})

test('parts', () => {
  // expect(parts(4)).toStrictEqual(['0%', '25%', '50%', '75%'])
  // expect(parts(4, 10)).toStrictEqual(['10%', '35%', '60%', '85%'])
  // expect(parts(4)).toStrictEqual('1/4 2/4 3/4 4/4'.split(' '))
  // expect(parts(4, 1)).toStrictEqual('2/4 3/4 4/4 1/4'.split(' '))
  expect(parts(4)).toStrictEqual('1 2 3 4'.split(' '))
  expect(parts(4, 1)).toStrictEqual('2 3 4 1'.split(' '))
})

test('divide', () => {
  expect(divide([1, 2, 3, 4, 5], 5)).toStrictEqual([[1], [2], [3], [4], [5]])
  expect(divide([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2, 3], [4, 5]])
  expect(divide([1], 2)).toStrictEqual([[1], []])
  expect(divide([1], 5)).toStrictEqual([[1], [], [], [], []])
  expect(divide([1, 2], 5)).toStrictEqual([[1], [2], [], [], []])
  expect(divide([1, 2, 3], 2)).toStrictEqual([[1, 2], [3]])
})

// test('partChunks', () => {
//   expect(partChunks(5, 2)).toStrictEqual([['0%', '20%'], ['40%', '60%', '80%']])
//   expect(mj(partChunks(5, 2))).toStrictEqual(['0% 20%', '40% 60% 80%'])
// })

test('shuffle', () => {
  const long = 'kdnwjertnblrekjnfqlekjfnqlkewjfnqwelkjfnqwelkjnfq'

  expect(shuffle(s('a'))).toStrictEqual(s('a'))
  expect(Array(...shuffle(s(long))).toSorted()).toStrictEqual(Array(...s(long)).toSorted())
  expect(shuffle(s(long))).not.toStrictEqual(s(long))
})

test('zip', () => {
  expect(zip(s('123'), s('ab'))).toStrictEqual(['1a', '2b'])
  expect(zip(s('ab'), s('123'))).toStrictEqual(['a1', 'b2'])
})

test('j & jj', () => {
  expect(j([1, 2])).toStrictEqual('1 2')
  expect(jj([[1, 2], [3, 4]])).toStrictEqual('1 2, 3 4')
})

describe('pickMemK', () => {
  type Memory = Map<string, any>
  type Sig =
    (m: Memory, key: string | undefined, array: any[] | string, n: number | undefined, stats: any)
      => [string[], Memory]

  const pmk: Sig = (m, a, b, c, d) => [randomizeLangUtils(new Map(), m).pickMemK(a, b, c, d), m]

  test('basic', () => {
    const m: Memory = new Map()
    expect(pmk(m, '', '1', 1, undefined)).toEqual([["1"], m])
  })

  test('make a key if it is missing', () => {
    const m: Memory = new Map([["1||2||2", { "2": 1 }]])
    expect(pmk(m, '', '212', 1, undefined)).toEqual([["1"], m])
  })

  test('use stats', () => {
    const m: Memory = new Map([["choice", { "2": 1 }]])
    expect(pmk(m, 'choice', '212', 1, undefined)).toEqual([["1"], m])
  })

  test('update stats', () => {
    const m: Memory = new Map([["stuff", { "2": 1 }]])
    expect(pmk(m, 'stuff', '212', 1, undefined)).toEqual([["1"], m])
    expect(m.get('stuff')).toStrictEqual({ "2": 1, "1": 1 })
  })
})
