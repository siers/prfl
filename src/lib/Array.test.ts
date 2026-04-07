import { expect, test } from 'vitest'
import { interleavingEvery, intersperse, interspersing, zipT, arrayMove } from './Array'

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


test('arrayMove', () => {
  const a = [1, 2, 3]

  expect(arrayMove([1], 0, 0)).toStrictEqual([1])

  expect(arrayMove(a, 1, 1)).toStrictEqual([1, 2, 3])
  expect(arrayMove(a, 0, 0)).toStrictEqual([1, 2, 3])

  expect(arrayMove(a, 1, 2)).toStrictEqual([1, 3, 2])
  expect(arrayMove(a, 2, 1)).toStrictEqual([1, 3, 2])
  expect(arrayMove(a, 2, 0)).toStrictEqual([3, 1, 2])

  expect(arrayMove(a, 9, 12)).toStrictEqual([1, 2, 3])
  expect(arrayMove(a, 12, 1)).toStrictEqual([1, 2, 3])
  expect(arrayMove(a, 1, 12)).toStrictEqual([1, 2, 3])

  expect(arrayMove([0, 0, 0, 0, 5], 4, 0)).toStrictEqual([5, 0, 0, 0, 0])

  expect(a).toStrictEqual([1, 2, 3])
})
