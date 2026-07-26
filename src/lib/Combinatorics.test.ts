import { describe, expect, test } from 'vitest'
import { sumsFromTo, sumsFromToU, uniqueShifts, uniqueShiftsD, uniqueShiftsDF, uniqueShiftsF } from './Combinatorics.ts'

describe('Combinatorics', () => {
  test('sumsFromTo base: no step fits', () => {
    expect(sumsFromToU(3, 2, [1])).toEqual([])
  })

  test('sumsFromTo base: single step landing exactly', () => {
    expect(sumsFromToU(1, 3, [2])).toEqual([[2]])
  })

  test('sumsFromTo: step 2 up to 5', () => {
    expect(sumsFromToU(1, 5, [2])).toEqual([[2, 2]])
  })

  test('sumsFromTo: steps 1 and 2 up to 3', () => {
    expect(sumsFromToU(1, 3, [1, 2])).toEqual([[2], [1, 1]])
  })

  test('sumsFromTo: steps 2 and 3 up to 5', () => {
    expect(sumsFromToU(2, 5, [2, 3])).toEqual([[3]])
  })

  test('sumsFromTo: every way sums to y - x', () => {
    for (const way of sumsFromTo(1, 7, [2, 3]))
      expect(way.reduce((a, b) => a + b, 0)).toBe(6)
  })

  test('sumsFromTo: no duplicate multisets', () => {
    const ways = sumsFromToU(1, 6, [1, 2, 3])
    const keys = ways.map(w => [...w].sort((a, b) => a - b).join(','))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('sumsFromTo: sorted by size', () => {
    const ways = sumsFromToU(2, 9, [2, 3, 4])
    const sizes = ways.map(w => w.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  test('uniqueShifts 1,7', () => {
    expect(uniqueShifts()).toStrictEqual(
      [
        [1, 2, 2, 2,],
        [1, 3, 3,],
        [2, 1, 2, 2,],
        [2, 2, 1, 2,],
        [2, 2, 2, 1,],
        [2, 2, 3,],
        [2, 3, 2,],
        [3, 1, 3,],
        [3, 2, 2,],
        [3, 3, 1,],
      ]
    )
  })

  test('uniqueShiftsF', () => {
    expect(uniqueShiftsF()).toStrictEqual(
      [
        "1222",
        "133",
        "2122",
        "2212",
        "2221",
        "223",
        "232",
        "313",
        "322",
        "331",
      ]
    )
  })

  test('uniqueShiftsDF', () => {
    expect(uniqueShiftsDF()).toStrictEqual(
      [
        "1+222",
        "1+33",
        "1+222",
        "1+222",
        "1+222",
        "0+223",
        "0+232",
        "1+33",
        "0+322",
        "1+33",
      ]
    )
  })
})
