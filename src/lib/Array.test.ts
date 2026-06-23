import { expect, test } from 'vitest'
import { interleavingEvery, intersperse, interspersing, zipT, zipLongest, timesUntil, cartesian, arrayMove, transpose } from './Array'

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


test('timesUntil recycles to the target length', () => {
  expect(timesUntil(3, ['a', 'b'])).toStrictEqual(['a', 'b', 'a'])
  expect(timesUntil(2, ['a', 'b', 'c'])).toStrictEqual(['a', 'b']) // truncates
  expect(timesUntil(4, ['x'])).toStrictEqual(['x', 'x', 'x', 'x'])
  expect(timesUntil(3, [])).toStrictEqual([]) // empty stays empty
})

test('zipLongest recycles shorter lists up to the longest', () => {
  expect(zipLongest(['a', 'b', 'c'], ['x', 'y'])).toStrictEqual([['a', 'x'], ['b', 'y'], ['c', 'x']])
  expect(zipLongest([1], [10, 20, 30])).toStrictEqual([[1, 10], [1, 20], [1, 30]])
  expect(zipLongest([1, 2], [10, 20])).toStrictEqual([[1, 10], [2, 20]]) // equal length = plain zip
  expect(zipLongest([1])).toStrictEqual([[1]])
})

test('cartesian is the full product, last list varies fastest', () => {
  expect(cartesian<number | string>([1, 2], ['x', 'y'])).toStrictEqual([[1, 'x'], [1, 'y'], [2, 'x'], [2, 'y']])
  expect(cartesian([1, 2, 3])).toStrictEqual([[1], [2], [3]])
  expect(cartesian()).toStrictEqual([[]]) // empty product = one empty combo
  expect(cartesian([1, 2], [])).toStrictEqual([]) // any empty factor = no combos
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

test('transpose', () => {
  expect(transpose<string | number>([[1, 2], ['a', 'b']])).toStrictEqual([[1, 'a'], [2, 'b']])
})
