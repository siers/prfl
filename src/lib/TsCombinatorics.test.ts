import * as Comb from 'ts-combinatorics'

import { describe, expect, test } from 'vitest'

describe('ts-combinatorics', () => {
  test('perm 2 of 4', () => {
    expect([...new Comb.Permutation("GDAE", 2)].map(p => p.join(''))).toStrictEqual(
      [
        "GD",
        "GA",
        "GE",
        "DG",
        "DA",
        "DE",
        "AG",
        "AD",
        "AE",
        "EG",
        "ED",
        "EA",
      ]
    )
  })
})

