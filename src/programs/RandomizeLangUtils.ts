import { pick as pickArray, shuffleArray, shuffleMinDistance } from "../lib/Random"
import { intersperse, interspersing, interleavingEvery, zipT } from '../lib/Array'
import _ from 'lodash'

function roundToNaive(num: number, decimalPlaces: number = 0): number {
  var p = Math.pow(10, decimalPlaces)
  return Math.round(num * p) / p
}

export type Interface = {
  // DSL
  s: (s: string) => string[],
  ss: (s: string) => string[],
  cross: (sentence: string) => string[],

  // array
  times: <A>(a: A, n: number) => A[],
  indices: (until: number) => string[],
  parts: (n: number, m?: number) => string[],
  partsShuf: (n: number, m?: number) => string[],
  divide: <A>(as: A[], parts: number) => A[][],
  partChunks: (part: number, chunk: number, offset?: number) => string[][],
  partChunksShuf: (part: number, chunk: number, offset?: number) => string[][],
  // mj: <A>(ass: A[][]) => string[],
  j: <A>(as: A[]) => string,
  jj: <A>(as: A[][]) => string,
  zip: (...as: string[][]) => string[],
  zipSpace: (...as: string[][]) => string[],
  zipT: <A>(...ass: A[][]) => A[][],
  intersperse: <A>(arr: A[], sep: A) => A[],
  interspersing: <A>(arr: A[], sep: A[]) => A[],
  interleavingEvery: <A>(into: A[], what: A[], every: number) => A[],
  shuffle: <A>(a: A[]) => A[],
  shuffleM: <A>(a: A[]) => A[],
  shuffleX: <A>(a: A[] | string, number: number) => A[],
  pick: <A>(array: A[] | string) => A | string,
  pickMem: <A>(array: A[] | string, n: number | null) => A | string,

  progress: (start: string, end: string) => number,
  progressClamp: (start: string, end: string, from: number, to: number) => number,

  // block operations
  context: Map<string, string[]> | null,
  block: (name: string) => any | undefined,
  aba: (as: string[], bs: string[]) => string[],

  // domain specific
  scalePositions: () => string,
  scalePositionsDbl: () => string[],
}

export function randomizeLangUtils(context: Map<string, string[]>, memory: Map<string, any>): Interface {
  function s(s: string): string[] {
    if (s.indexOf(',') !== -1) return s.split(/ *, */)
    if (s.indexOf(' ') !== -1) return s.split(' ')
    else return s.split('')
  }

  function ss(sentence: string): string[] {
    return shuffle(s(sentence))
  }

  function cross(sentence: string): string[] {
    const arrays = sentence.split(/ *x */).map(s)
    if (arrays.length > 1) {
      const [first, ...rest] = arrays
      return rest.reduce((as, others) => as.flatMap(a => others.map(o => `${a}${o}`)), first)
    } else {
      return []
    }
  }

  function times<A>(a: A, n: number): A[] {
    return Array(n).fill(a)
  }

  function indices(until: number): string[] {
    return times(0, until).map((_, i) => '' + (i + 1))
  }

  function parts(parts: number, offset?: number): string[] {
    return Array(parts).fill(null).map((_, i) => `${(i + (offset || 0)) % parts + 1}`)
    // return Array(parts).fill(null).map((_, i) => `${(i + (offset || 0)) % parts + 1}/${parts}`)
    // return Array(parts).fill(null).map((_, i) => `${100 * (i + (offset || 0) / 100 * parts) / parts}%`)
  }

  function partsShuf(ps: number, offset?: number): string[] {
    return shuffle(parts(ps, offset))
  }

  function divide<A>(as: A[], parts: number): A[][] {
    const part = Math.floor(as.length / parts)
    const starts = Array(parts).fill(null).map((_, idx) => idx * part)
    return starts.map((start, idx) => as.slice(start, idx + 1 == starts.length ? undefined : start + part))
  }

  function partChunks(part: number, chunk: number, offset?: number): string[][] {
    return divide(parts(part, offset), chunk)
  }

  // Bug: offset screws it up
  function partChunksShuf(part: number, chunk: number, offset?: number): string[][] {
    return divide(shuffle(parts(part, offset)), chunk)
  }

  // function mj<A>(ass: A[][]): string[] {
  //   return ass.map(as => as.join(' '))
  // }

  function j<A>(as: A[]): string {
    return as.join(' ')
  }

  function jj<A>(as: A[][]): string {
    return as.map(a => a.join(' ')).join(', ')
  }

  function zipGen(ass: string[][], sep: string = ''): string[] {
    const minLength = ass.map(as => as.length).reduce((prev, next) => Math.min(prev, next), 100000)
    const width = Array(ass.length).fill(null).map((_, idx) => idx)
    return Array(minLength).fill(null).map((_, idx) => width.map(w => ass[w][idx]).join(sep))
  }

  function zip(...ass: string[][]): string[] {
    return zipGen(ass, '')
  }

  function zipSpace(...ass: string[][]): string[] {
    return zipGen(ass, ' ')
  }

  function shuffleM<A>(a: A[]): A[] {
    return shuffleMinDistance(a, 1)
  }

  function shuffle<A>(a: A[]): A[] {
    return shuffleArray(a)
  }

  function shuffleConstraintFirst<A>(shouldntBe: A[], b: A[]): A[] {
    const [shouldnts, rests] = _.partition(b, x => shouldntBe.indexOf(x) !== -1)
    if (rests.length == 0) {
      return []
    } else {
      const restRests = rests.slice(0, -1)
      const last = rests.at(-1)!
      return [last, ...shuffle(restRests.concat(shouldnts))]
    }
  }

  function shuffleX<A>(a: A[] | string, number: number): A[] {
    const list: A[] = shuffle(typeof a === 'string' ? (s(a) as A[]) : a)
    return times(list, number).reduce((list, addition) => list.concat(shuffleConstraintFirst(list.slice(-1), addition)))
  }

  function pick<A>(array: A[] | string): A | string {
    if (typeof array === 'string') return pickArray(ss(array))
    else return pickArray(array)
  }

  function pickMem(array: any[] | string, n: number | null): any {
    const items = (typeof array === 'string') ? s(array) : array
    const memoryKey = items.sort().join('||')

    const storedStats = memory.get(memoryKey) || {}
    const itemFrequencies: [any, number][] = items.map(item => {
      return [item, (storedStats[item] || 0)] satisfies [any, number]
    })
    const frequencies = _.sortBy(itemFrequencies, 1)
    const item = frequencies[0][0]

    const nextStats = Object.fromEntries(frequencies)
    nextStats[item] = (nextStats[item] || 0) + 1
    memory.set(memoryKey, nextStats)

    return item
  }

  function progress(start: string, end: string) {
    const now = new Date().getTime()
    const startDate = new Date(start).getTime()
    const endDate = new Date(end).getTime()

    const perc = (now - startDate) / (endDate - startDate)

    return roundToNaive(Math.max(0, Math.min(1, perc)), 3)
  }

  function progressClamp(start: string, end: string, from: number, to: number) {
    const diff = to - from
    return from + progress(start, end) * diff
  }

  function block(name: string): any {
    return context.get(name)
  }

  function aba(as: string[], bs: string[]): string[] {
    const [a1, a2] = divide(as, 2)
    return [...a1, '---', ...bs, '---', ...a2]
  }

  // add upwards/downwards buttons, shuffleX(uudd, 2)
  // Bug: G/E doesn't need direction
  function scalePositions() {
    return zip(ss('123456'), shuffleX(`GDAE`, 2), shuffleX('uudd', 2), shuffleX('↑↑↓↓', 2)).map(example =>
      example.replace(/([GE].)[↑↓]/, (_, withoutDirection) => withoutDirection)
    ).join(' ')
  }

  // add upwards/downwards buttons + upbow downbow
  // for downwards scales, it makes sense to add +2 to the position
  function scalePositionsDbl() {
    return zip(ss('123456'), shuffleX(`GD DA AE`, 2), shuffleX('uudd', 2), shuffleX('↓↓↑↑↑', 2)).map(example =>
      example.replace(/((GD|AE).)[↑↓]/, (_, withoutDirection) => withoutDirection)
    )
  }

  return {
    s,
    ss,
    cross,
    times,
    indices,
    parts,
    partsShuf,
    divide,
    partChunks,
    partChunksShuf,
    shuffle,
    shuffleM,
    shuffleX,
    zip,
    zipSpace,
    zipT,
    intersperse,
    interspersing,
    interleavingEvery,
    pick,
    pickMem,
    progress,
    progressClamp,
    j,
    jj,
    context,
    block,
    aba,
    scalePositions,
    scalePositionsDbl,
  }
}
