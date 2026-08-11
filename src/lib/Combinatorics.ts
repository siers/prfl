// lodash is CJS-only; the default import keeps Node's ESM interop happy (named
// imports fail to resolve under the tsx/Node loader). Aliased to `_l` because
// `_` is used as a throwaway lambda parameter below.
import _l from 'lodash'
import { times, zipLongest, zipT } from './Array'

const { groupBy, identity, shuffle, sortBy, uniqBy } = _l

type Stock = { value: number, count: number }

function stockFromInventory(inv: number[]): Stock[] {
  const finite = new Map<number, number>()
  const infinite = new Set<number>()

  for (const n of inv)
    if (n < 0)
      infinite.add(-n)
    else
      finite.set(n, (finite.get(n) ?? 0) + 1)

  // Load the exhaustible ones up front, inexhaustible ones after.
  const exhaustible: Stock[] = [...finite].map(([value, count]) => ({ value, count }))
  const inexhaustible: Stock[] = [...infinite].map(value => ({ value, count: Infinity }))
  return [...exhaustible, ...inexhaustible]
}

export function sumsTo(target: number, inv: number[]): number[][] {
  return go(target, stockFromInventory(inv))
}

export function sumsToU(target: number, inv: number[]): number[][] {
  return uniqueSortedBySize(go(target, stockFromInventory(inv)))
}

/** Every distinct variant, grouped by its multiset: [[sortedKey, [orderings]]]. */
export function sumsToG(target: number, inv: number[]): [number[], number[][]][] {
  return groupByMultiset(go(target, stockFromInventory(inv)))
}

function groupByMultiset<A>(ways: A[][]): [A[], A[][]][] {
  const groups = groupBy(ways, way => sortBy(way).join(','))
  return Object.values(groups).map(group => [sortBy(group[0]), group])
}

// All distinct variants, concatenated group by group (each variant exactly once).
// `manip` transforms each variant (identity by default).
export function sumsToFair(
  target: number,
  inv: number[],
  reorder: <A>(variant: A[]) => A[] = identity,
): number[][] {
  const groupings = reorder(reorder(sumsToG(target, inv).map(([, variants]) => reorder(variants))))
  return zipLongest(...groupings).flat()
}

function go(remaining: number, stock: Stock[]): number[][] {
  if (remaining === 0)
    return [[]]

  const ways: number[][] = []

  for (let i = 0; i < stock.length; i++) {
    const { value, count } = stock[i]
    if (count > 0 && value <= remaining) {
      const next = count === Infinity
        ? stock
        : stock.with(i, { value, count: count - 1 })
      for (const rest of go(remaining - value, next))
        ways.push([value, ...rest])
    }
  }

  return ways
}

function uniqueSortedBySize(ways: number[][]): number[][] {
  const unique = uniqBy(ways, way => sortBy(way).join(','))
  return sortBy(unique, way => way.length)
}

export function uniqueShifts(target: number = 7, inv: number[] = [-1, -2, -3]): number[][] {
  return sumsTo(target, inv)
}

// Fairly interleaved variants with each variant's order shuffled.
export function shifts(target: number = 7, inv: number[] = [-1, -2, -3]): number[][] {
  return sumsToFair(target, inv, l => shuffle(l).slice(0, 50))
}

export function uniqueShiftsF(target: number = 7, inv: number[] = [-1, -2, -3]): string[] {
  return uniqueShifts(target, inv).map((r) => r.join(''))
}

export function shiftFormat(s: number[][]): string[] {
  return s.map(r => r.join(''))
}

export function shiftStrings(distrib: string, shifts: number): string[] {
  const strings = times(10).flatMap(_ => distrib.split(''))
  return shuffle(strings).slice(0, shifts).sort().map(st => `GDAE`.split('')[+st])
}

export function shiftsDistributed(target: number = 7, inv: number[] = [-1, -2, -3], distrib: string): string[] {
  return shifts(target, inv).map(fs => {
    const shiftLetters = zipT(fs.map(f => `${f}`), shiftStrings(distrib, fs.length))
    return shiftLetters.map(sl => sl.join('')).join('-')
  })
}
