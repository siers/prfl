import { expect, test } from 'vitest'
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
} = randomizeLangUtils(new Map())

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
  expect(parts(4)).toStrictEqual('1/4 2/4 3/4 4/4'.split(' '))
  expect(parts(4, 1)).toStrictEqual('2/4 3/4 4/4 1/4'.split(' '))
})

test('divide', () => {
  expect(divide([1, 2, 3, 4, 5], 5)).toStrictEqual([[1], [2], [3], [4], [5]])
  expect(divide([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4, 5]])
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
