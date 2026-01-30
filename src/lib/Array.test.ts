import { expect, test } from 'vitest'
import { interleavingEvery, intersperse, interspersing, zipT } from './Array'

test('intersperse', () => {
  expect(intersperse([1, 2, 3], 0)).toStrictEqual([1, 0, 2, 0, 3])
})

test('interspersing', () => {
  expect(interspersing([1, 2, 3], [0, 0])).toStrictEqual([1, 0, 0, 2, 0, 0, 3])
})

test('interleavingEvery', () => {
  expect(interleavingEvery([1, 2, 3], [0], 2)).toStrictEqual([1, 2, 0, 3])
})

test('zipT', () => {
  expect(zipT([])).toStrictEqual([])
  expect(zipT([1])).toStrictEqual([[1]])
  expect(zipT([1], [10])).toStrictEqual([[1, 10]])
  expect(zipT([1], [10], [20])).toStrictEqual([[1, 10, 20]])
  expect(zipT([1, 2], [10], [20])).toStrictEqual([[1, 10, 20]])
})
