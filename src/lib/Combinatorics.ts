import { sortBy, uniqBy } from 'lodash'

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

export function uniqueShiftsF(target: number = 7, inv: number[] = [-1, -2, -3]): string[] {
  return uniqueShifts(target, inv).map((r) => r.join(''))
}
