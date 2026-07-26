import { sortBy, uniqBy, uniq } from 'lodash'

export function sumsFromTo(x: number, y: number, steps: number[]): number[][] {
  return go(y - x, steps)
}

export function sumsFromToU(x: number, y: number, steps: number[]): number[][] {
  return uniqueSortedBySize(go(y - x, steps))
}

function go(remaining: number, steps: number[]): number[][] {
  if (remaining === 0)
    return [[]]

  const ways: number[][] = []

  for (const p of steps)
    if (p <= remaining)
      for (const rest of go(remaining - p, steps))
        ways.push([p, ...rest])

  return ways
}

function uniqueSortedBySize(ways: number[][]): number[][] {
  const unique = uniqBy(ways, way => sortBy(way).join(','))
  return sortBy(unique, way => way.length)
}

// function hasConsecutiveOnes(as: number[]): boolean {
//   return as.some((x, idx) => as[idx] == as[idx + 1] && x == 1)
// }

function atMostOneOne(as: number[]): boolean {
  return as.filter(a => a == 1).length <= 1
}

export function uniqueShifts(x: number = 1, y: number = 8, steps: number[] = [1, 2, 3]): number[][] {
  return sumsFromTo(x, y, steps).filter(shift => atMostOneOne(shift))
}

export function uniqueShiftsF(x: number = 1, y: number = 8, steps: number[] = [1, 2, 3]): string[] {
  return uniqueShifts(x, y, steps).map((r) => r.join(''))
}

export function uniqueShiftsD(x: number = 1, y: number = 8, steps: number[] = [1, 2, 3]): [number, number[]][] {
  return uniq(
    sumsFromTo(x, y, steps)
      .filter(shift => atMostOneOne(shift))
      .map(fs => [fs.filter(f => f == 1).length, fs.filter(f => f != 1)])
  )
}

export function uniqueShiftsDF(x: number = 1, y: number = 8, steps: number[] = [1, 2, 3]): string[] {
  return uniqueShiftsD(x, y, steps).map(([ones, r]) => `${ones}+${r.join('')}`)
}
