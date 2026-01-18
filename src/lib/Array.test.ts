import { expect, test } from 'vitest'
import { intersperse } from './Array'

test('intersperse', () => {
  expect(intersperse([1, 2, 3], 0)).toStrictEqual([1, 0, 2, 0, 3])
})
