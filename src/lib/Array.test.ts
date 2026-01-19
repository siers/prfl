import { expect, test } from 'vitest'
import { interleavingEvery, intersperse, interspersing } from './Array'

test('intersperse', () => {
  expect(intersperse([1, 2, 3], 0)).toStrictEqual([1, 0, 2, 0, 3])
})

test('interspersing', () => {
  expect(interspersing([1, 2, 3], [0, 0])).toStrictEqual([1, 0, 0, 2, 0, 0, 3])
})

test('interleavingEvery', () => {
  expect(interleavingEvery([1, 2, 3], [0], 2)).toStrictEqual([1, 2, 0, 3])
})
