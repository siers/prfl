import { expect, test } from 'vitest'
import { mapCopy } from './Map.ts'

test('mapCopy', () => {
  const m = new Map([[1, 2]])
  const m2 = mapCopy(m)
  m2.set(1, 3)
  expect(m.get(1)).toEqual(2)
})
