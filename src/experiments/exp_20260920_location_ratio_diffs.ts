// @ts-expect-error - lb-ratio (LarryBattle/Ratio.js) ships no type declarations
import Ratio from 'lb-ratio'

// The bow-location points from `Locations:` in exercises/full.rndl:
//   Locations: [zipLongest(shuffleX(`0/1 1/1 1/2 1/4 3/4 1/3 2/3`, 4), ss(`GDAE`))] [`f`]next
export const LOCATIONS = ['0/1', '1/1', '1/2', '1/4', '3/4', '1/3', '2/3'] as const

export type Diff = {
  a: string
  b: string
  /** |a - b| as a simplified fraction, e.g. "5/12" */
  diff: string
  /** |a - b| as a decimal */
  value: number
}

/** Absolute difference between two fractions, simplified. */
export function absDiff(a: string, b: string): Diff {
  const r = Ratio.parse(a).subtract(Ratio.parse(b)).abs().simplify()
  return { a, b, diff: r.toString(), value: r.valueOf() }
}

/** All unordered pairs (a < b by index), including the zero-distance identity pairs excluded. */
export function allAbsDiffs(points: readonly string[]): Diff[] {
  const out: Diff[] = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      out.push(absDiff(points[i], points[j]))
    }
  }
  return out
}

function pad(s: string, n: number): string {
  return s + ' '.repeat(Math.max(0, n - s.length))
}

/** Full n*n matrix of absolute differences, as fraction strings. */
export function renderMatrix(points: readonly string[]): string {
  const w = 7
  const header = pad('', w) + points.map(p => pad(p, w)).join('')
  const rows = points.map(a =>
    pad(a, w) + points.map(b => pad(absDiff(a, b).diff, w)).join(''),
  )
  return [header, ...rows].join('\n')
}

/** Every pair, sorted by distance ascending. */
export function renderSorted(diffs: Diff[]): string {
  return [...diffs]
    .sort((x, y) => x.value - y.value)
    .map(d => `${pad(`${d.a} - ${d.b}`, 16)}${pad(d.diff, 10)}${d.value.toFixed(6)}`)
    .join('\n')
}

/** Distinct distances with how many pairs produce each. */
export function renderDistinct(diffs: Diff[]): string {
  const counts = new Map<string, { value: number; count: number; pairs: string[] }>()
  for (const d of diffs) {
    const e = counts.get(d.diff) ?? { value: d.value, count: 0, pairs: [] }
    e.count++
    e.pairs.push(`${d.a}-${d.b}`)
    counts.set(d.diff, e)
  }
  return [...counts.entries()]
    .sort((x, y) => x[1].value - y[1].value)
    .map(([diff, e]) => `${pad(diff, 10)}${pad(e.value.toFixed(6), 12)}x${pad(String(e.count), 4)}${e.pairs.join(' ')}`)
    .join('\n')
}

export function report(points: readonly string[] = LOCATIONS): string {
  const diffs = allAbsDiffs(points)
  return [
    `# Locations — absolute differences between all points`,
    ``,
    `Points (from exercises/full.rndl, \`Locations:\`): ${points.join(' ')}`,
    `Pairs: ${diffs.length}`,
    ``,
    `## Matrix |a - b|`,
    ``,
    renderMatrix(points),
    ``,
    `## All pairs, by distance ascending`,
    ``,
    renderSorted(diffs),
    ``,
    `## Distinct distances`,
    ``,
    renderDistinct(diffs),
    ``,
  ].join('\n')
}

console.log(report())
