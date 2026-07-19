import { expect, test } from 'vitest'
import { Direction, linearSeek, linearSeekFull, linearSeekFullNext, linearSeekNext, linearSeekPast } from './LinearSeek'

const { Forward, Backward } = Direction

const never = () => false
const always = () => true

test('current included when exclude(current) is true, loop items skipped', () => {
  expect(linearSeek(['a', 'b', 'c'], 0, Forward, always)).toStrictEqual([])

  expect(linearSeek(['a', 'b'], 1, Forward, never)).toStrictEqual([1])
  expect(linearSeek(['a', 'b'], 0, Backward, never)).toStrictEqual([0])

  expect(linearSeek(['a', 'b', 'c'], 0, Forward, never)).toStrictEqual([0, 1, 2])
  expect(linearSeek(['a', 'b', 'c'], 2, Backward, never)).toStrictEqual([2, 1, 0])
})

test('collects non-excluded items between excluded ones', () => {
  const exclude = (a: number) => new Set([1, 3]).has(a)
  expect(linearSeek([0, 1, 2, 3, 4], 0, Forward, exclude)).toStrictEqual([0, 2, 4])

  expect(linearSeekNext([0, 1, 2, 3, 4], 0, Forward, exclude)).toStrictEqual([2, 4])
  expect(linearSeekNext([0, 1, 2, 3, 4], 0, 2 as Direction, never)).toStrictEqual([1, 2, 3, 4])
})

test('linearSeekFull collects in both directions', () => {
  const exclude = (a: number) => new Set([1, 5]).has(a)
  expect(linearSeekFull([0, 1, 2, 3, 4, 5, 6], 3, Forward, exclude)).toStrictEqual([3, 4, 6, 2, 0])
  expect(linearSeekFull([0, 1, 2, 3, 4, 5, 6], 3, Backward, exclude)).toStrictEqual([3, 2, 0, 4, 6])
})

test('linearSeekFullNext collects in both directions', () => {
  const exclude = (a: number) => new Set([1, 5]).has(a)
  expect(linearSeekFullNext([0, 1, 2, 3, 4, 5, 6], 3, Forward, exclude)).toStrictEqual([4, 6, 3, 2, 0])
  expect(linearSeekFullNext([0, 1, 2, 3, 4, 5, 6], 3, Backward, exclude)).toStrictEqual([2, 0, 3, 4, 6])
})

test('linearSeekPast emits out', () => {
  const exclude = (a: number) => new Set([1, 3]).has(a)
  expect(linearSeekPast([0, 1, 2, 3, 4], 0, Forward, exclude, 1)).toStrictEqual([0, 2, 4, 5])
  expect(linearSeekPast([0, 1, 2, 3, 4], 0, Forward, exclude, 1, 1)).toStrictEqual([2, 4, 5])
})

test('linearSeekPast emits out, pathological cases', () => {
  const exclude = (a: number) => new Set([1, 3]).has(a)
  expect(linearSeekPast([0], 0, Forward, exclude, 1, 1)).toStrictEqual([1])
  expect(linearSeekPast([0, 1, 2, 3, 4, 5], 0, Forward, always, 1, 1)).toStrictEqual([6])
})
