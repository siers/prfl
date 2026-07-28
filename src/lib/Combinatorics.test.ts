import { describe, expect, test } from 'vitest'
import { shifts, sumsTo, sumsToFair, sumsToG, sumsToU, uniqueShifts, uniqueShiftsF } from './Combinatorics.ts'

describe('Combinatorics', () => {
  test('sumsTo base: negative target', () => {
    expect(sumsToU(-1, [-1])).toEqual([])
  })

  test('sumsTo base: single step landing exactly', () => {
    expect(sumsToU(2, [-2])).toEqual([[2]])
  })

  test('sumsTo: step 2 up to 4', () => {
    expect(sumsToU(4, [-2])).toEqual([[2, 2]])
  })

  test('sumsTo: steps 1 and 2 up to 2', () => {
    expect(sumsToU(2, [-1, -2])).toEqual([[2], [1, 1]])
  })

  test('sumsTo: steps 2 and 3 up to 3', () => {
    expect(sumsToU(3, [-2, -3])).toEqual([[3]])
  })

  test('sumsTo: every way sums to the target', () => {
    for (const way of sumsTo(6, [-2, -3]))
      expect(way.reduce((a, b) => a + b, 0)).toBe(6)
  })

  test('sumsTo: no duplicate multisets', () => {
    const ways = sumsToU(5, [-1, -2, -3])
    const keys = ways.map(w => [...w].sort((a, b) => a - b).join(','))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('sumsTo: sorted by size', () => {
    const ways = sumsToU(7, [-2, -3, -4])
    const sizes = ways.map(w => w.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  test('sumsTo: finite inventory limits repeats', () => {
    expect(sumsToU(6, [2, 2])).toEqual([])
    expect(sumsToU(4, [2, 2])).toEqual([[2, 2]])
  })

  test('sumsTo: mixed finite and inexhaustible', () => {
    expect(sumsToU(5, [1, -2])).toEqual([[1, 2, 2]])
    expect(sumsToU(4, [1, -2])).toEqual([[2, 2]])
  })

  test('sumsTo: exhaustible values are tried before inexhaustible ones', () => {
    const ways = sumsTo(4, [3, -1])
    expect(ways[0]).toEqual([3, 1])
    expect(ways).toEqual([[3, 1], [1, 3], [1, 1, 1, 1]])
  })

  test('sumsToG: groups distinct variants by multiset', () => {
    // target 4 with unlimited 1s and 3s: {1,1,1,1} has one ordering, {1,3} has two.
    // groups appear in first-seen (DFS) order, so the all-1s way comes first.
    expect(sumsToG(4, [-1, -3])).toEqual([
      [[1, 1, 1, 1], [[1, 1, 1, 1]]],
      [[1, 3], [[1, 3], [3, 1]]],
    ])
  })

  test('sumsToFair: interleaves groups round-robin, recycling smaller ones', () => {
    // groups: [{1,1,1,1}: [[1,1,1,1]]], [{1,3}: [[1,3],[3,1]]]
    // zipLongest recycles the size-1 group to length 2, then flattens.
    expect(sumsToFair(4, [-1, -3])).toEqual([
      [1, 1, 1, 1],
      [1, 3],
      [1, 1, 1, 1],
      [3, 1],
    ])
  })

  test('sumsToFair: consecutive entries come from different multisets', () => {
    // fairness: with >1 group, adjacent picks should alternate group membership
    const key = (w: number[]) => [...w].sort((a, b) => a - b).join(',')
    const fair = sumsToFair(9, [-2, -3, -4])
    const groupCount = sumsToG(9, [-2, -3, -4]).length
    expect(groupCount).toBeGreaterThan(1)
    // first `groupCount` entries are one representative from each distinct group
    const firstRound = fair.slice(0, groupCount).map(key)
    expect(new Set(firstRound).size).toBe(groupCount)
  })

  test('sumsToFair: manip transforms each variant, default is identity', () => {
    // identity default equals passing identity explicitly
    expect(sumsToFair(4, [-1, -3])).toEqual(sumsToFair(4, [-1, -3], x => x))
    // manip is applied to every emitted variant
    const reversed = sumsToFair(4, [-1, -3], v => [...v].reverse())
    expect(reversed).toEqual([
      [1, 1, 1, 1],
      [3, 1],
      [1, 1, 1, 1],
      [1, 3],
    ])
  })

  test('shifts: same multisets and count as sumsToFair, orders shuffled', () => {
    const key = (w: number[]) => [...w].sort((a, b) => a - b).join(',')
    const base = sumsToFair(7, [-1, -2, -3])
    const shifted = shifts()
    // shuffle only reorders within a variant, so length and multisets are preserved
    expect(shifted.length).toBe(base.length)
    expect(shifted.map(key).sort()).toEqual(base.map(key).sort())
    // every shifted variant is a permutation of the corresponding base variant
    shifted.forEach((s, i) => expect(key(s)).toBe(key(base[i])))
  })

  test('sumsToG: key is the sorted multiset and every variant is kept', () => {
    const groups = sumsToG(7, [-1, -2, -3])
    for (const [key, variants] of groups) {
      expect(key).toEqual([...key].sort((a, b) => a - b))
      for (const v of variants)
        expect([...v].sort((a, b) => a - b)).toEqual(key)
    }
    // no variant is lost: group sizes sum to the flat count
    const total = groups.reduce((n, [, variants]) => n + variants.length, 0)
    expect(total).toBe(sumsTo(7, [-1, -2, -3]).length)
  })

  test('uniqueShifts 1,7', () => {
    expect(uniqueShifts(7, [1, -2, -3])).toStrictEqual(
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
    expect(uniqueShiftsF(7, [1, -2, -3])).toStrictEqual(
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
})
