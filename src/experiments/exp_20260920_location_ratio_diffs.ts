// @ts-expect-error - lb-ratio (LarryBattle/Ratio.js) ships no type declarations
import Ratio from 'lb-ratio'
import _l from 'lodash'
import { sumsToFair, sumsToG } from '../lib/Combinatorics'

const { range, shuffle, sortBy, uniqBy } = _l

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

// Every Locations distance is a whole number of twelfths, so decompositions are
// computed over integer twelfths and rendered back as fractions.
const UNIT = 12

/**
 * Inventory for sumsToFair: every twelfth 1/12..12/12, all inexhaustible
 * (negative = unlimited supply). Denominations that cannot sum to a target
 * simply never appear in that target's variants.
 */
export const INVENTORY = Array.from({ length: UNIT }, (_, i) => -(i + 1))

/** n twelfths as a simplified fraction string, e.g. 5 -> "5/12", 6 -> "1/2". */
export function twelfthsToFraction(n: number): string {
  return Ratio.parse(n, UNIT).simplify().toString()
}

/** Denominator of n twelfths once simplified: 6 -> 2, 3 -> 4, 5 -> 12. */
function denominator(n: number): number {
  return Number(twelfthsToFraction(n).split('/')[1])
}

/**
 * Sort key for a decomposition: term count first, then the smallest
 * denominator it uses. Coarse divisions of the bow come first, so a way built
 * from halves and thirds outranks one that needs twelfths.
 */
function waySortKey(multiset: number[]): [number, number] {
  return [multiset.length, Math.min(...multiset.map(denominator))]
}

/** `diff` as a whole number of twelfths. */
function targetOf(diff: string): number {
  return Math.round(Ratio.parse(diff).valueOf() * UNIT)
}

/**
 * Every distinct way to build `diff` as a sum of twelfths, as multisets.
 *
 * These are absolute differences, so order carries no meaning: 1/12 + 1/4 and
 * 1/4 + 1/12 are the same decomposition. sumsToG groups the orderings that
 * sumsToFair would interleave, leaving one entry per genuinely distinct way.
 *
 * Single-term multisets are dropped: [n] is just the distance restated, the
 * same in every row, so it carries nothing to inspect.
 */
export function decompositions(diff: string): string[] {
  const target = targetOf(diff)
  if (target === 0) return []

  const multisets = sumsToG(target, INVENTORY)
    .map(([multiset]) => multiset)
    .filter(m => m.length > 1)
  return sortBy(multisets, waySortKey)
    .map(m => sortBy(m).map(twelfthsToFraction).join(' + '))
}

/** How many decompositions each row shows. Rows with fewer ways show all of them. */
export const SAMPLES = 3

/**
 * Up to `SAMPLES` distinct decompositions of `diff`.
 *
 * sumsToFair interleaves the multisets round-robin, so consecutive entries come
 * from different groups and the head is already spread across shapes rather
 * than piling up permutations of one. Shuffling inside the interleave varies
 * which representative and which group order each run; uniqBy then drops the
 * repeats zipLongest introduces when it recycles the smaller groups.
 *
 * The picked groups are then ordered by term count, then by the smallest
 * denominator used, so each row reads from fewest and coarsest parts to most
 * and finest.
 *
 * The single-term way is filtered out before the pick, not after, so dropping
 * it never costs one of the `n` slots.
 */
export function sumsToFairSamples(diff: string, n: number = SAMPLES): string[] {
  const target = targetOf(diff)
  if (target === 0) return []

  const fair = sumsToFair(target, INVENTORY, l => shuffle(l))
  const picked = uniqBy(fair, w => sortBy(w).join(','))
    .filter(w => w.length > 1)
    .slice(0, n)
  return sortBy(picked, waySortKey)
    .map(w => sortBy(w).map(twelfthsToFraction).join(' + '))
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

/**
 * Samples are drawn once per distance and reused for both measuring and
 * rendering — drawing again per call would measure a different draw than the
 * one printed, and the widest cell would overflow its column.
 */
function drawSamples(diffs: Diff[]): Map<string, string[]> {
  return new Map(diffs.map(d => [d.diff, sumsToFairSamples(d.diff)]))
}

/** Width of the widest cell drawn, so the Nth sample sits at one offset. */
function sampleWidth(draws: Map<string, string[]>): number {
  const cells = [...draws.values()].flat()
  return Math.max(0, ...cells.map(c => c.length)) + 2
}

/** The samples as fixed-width columns, so they align down the page. */
function renderSamples(draws: Map<string, string[]>, diff: string, width: number): string {
  return (draws.get(diff) ?? []).map(c => pad(c, width)).join('').trimEnd()
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

/** Every pair, sorted by distance ascending, with a sampled fair decomposition. */
export function renderSorted(diffs: Diff[]): string {
  const draws = drawSamples(diffs)
  const w = sampleWidth(draws)
  const header = `${pad('pair', 16)}${pad('diff', 10)}${pad('value', 12)}${pad('ways', 6)}`
    + range(SAMPLES).map(i => pad(`sample ${i + 1}`, w)).join('').trimEnd()
  const rows = [...diffs]
    .sort((x, y) => x.value - y.value)
    .map(d =>
      `${pad(`${d.a} - ${d.b}`, 16)}${pad(d.diff, 10)}${pad(d.value.toFixed(6), 12)}`
      + `${pad(String(decompositions(d.diff).length), 6)}${renderSamples(draws, d.diff, w)}`)
  return [header, ...rows].join('\n')
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
  const draws = drawSamples(diffs)
  const w = sampleWidth(draws)
  const header = `${pad('diff', 10)}${pad('value', 12)}${pad('n', 5)}${pad('pairs', 34)}${pad('ways', 6)}`
    + range(SAMPLES).map(i => pad(`sample ${i + 1}`, w)).join('').trimEnd()
  const rows = [...counts.entries()]
    .sort((x, y) => x[1].value - y[1].value)
    .map(([diff, e]) =>
      `${pad(diff, 10)}${pad(e.value.toFixed(6), 12)}${pad(`x${e.count}`, 5)}${pad(e.pairs.join(' '), 34)}`
      + `${pad(String(decompositions(diff).length), 6)}${renderSamples(draws, diff, w)}`)
  return [header, ...rows].join('\n')
}

/** Every distinct decomposition of every distinct distance, nothing sampled. */
export function renderAllWays(diffs: Diff[]): string {
  const seen = [...new Map(diffs.map(d => [d.diff, d.value]))]
    .sort((x, y) => x[1] - y[1])
  return seen
    .map(([diff]) => {
      const ways = decompositions(diff)
      return [`${diff}  (${ways.length} ways)`, ...ways.map(w => `    ${w}`)].join('\n')
    })
    .join('\n\n')
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
    `Decompositions: over twelfths, inventory 1/12..12/12 (unlimited). These are`,
    `absolute differences, so order is meaningless — 1/12 + 1/4 and 1/4 + 1/12 are`,
    `one way, not two. \`ways\` counts the distinct multisets; up to ${SAMPLES} of them`,
    `are shown per row, taken from sumsToFair's round-robin over groups so they are`,
    `always distinct shapes, ordered by term count then by smallest denominator,`,
    `so the coarsest divisions come first. The one-term way is excluded — it only`,
    `restates the distance. Re-run for a different draw.`,
    ``,
    `## All pairs, by distance ascending`,
    ``,
    renderSorted(diffs),
    ``,
    `## Distinct distances`,
    ``,
    renderDistinct(diffs),
    ``,
    `## Every decomposition, per distinct distance`,
    ``,
    renderAllWays(diffs),
    ``,
  ].join('\n')
}

console.log(report())
