import { RenderLine, errorLine } from './RandomizeLangTypes'
import { cardMemory } from './RandomizeTypes'
import type { ImageEntry } from '../lib/PrflAssets'

import { pick as pickArray, shuffleArray, shuffleMinDistance } from '../lib/Random'
import { intersperse, interspersing, interleavingEvery, zipT, zipLongest as zipLongestLib, timesUntil as timesUntilLib, directRange, arrayShift, arrayMove, indices as arrayIndices } from '../lib/Array'
import { keyCenters, keyChunkWeights, majorKeyCentersWeighted, Note, rebase, render, semi } from '../lib/ToneLib'
import { chromaticSlide } from '../lib/ToneLibViolin'
import { roundToNaive } from '../lib/Math'
import * as Comb from 'ts-combinatorics'

import _ from 'lodash'
import murmur from 'murmurhash3js'
import { Picker } from 'bentools-picker'

function s(s: string): string[] {
  let out: string[]

  if (s.indexOf(',') !== -1) out = s.split(/ *, */)
  else if (s.indexOf(' ') !== -1) out = s.split(' ')
  else out = s.split('')

  return out.filter(x => x != '' && x != '-')
}

function ss(sentence: string): string[] {
  return shuffle(s(sentence))
}

function j<A>(as: A[]): string {
  return as.join(' ')
}

// inner join
function ij<A>(i: string, as: A[][]): string[] {
  return as.map(a => a.join(i))
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

function times<A>(n: number, a: A | ((idx?: number) => A)): A[] {
  if (typeof a === 'function') return Array(n).fill(0).map((_, i) => (a as (idx?: number) => A)(i))
  else return Array(n).fill(a)
}

function timesUntil<A>(length: number, a: A[]): A[] {
  return timesUntilLib(length, a)
}

function timesUntilShuf<A>(length: number, a: A[]): A[] {
  if (a.length == 1) return timesUntil(length, a)
  if (a.length == 2) a = shuffle([...a, ...a])
  const out = a.length < length ? shuffleX(a, Math.ceil(length / a.length)) : a
  return out.slice(0, length)
}

function product<A>(...arrays: A[][]): A[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = product(...rest)
  return first.flatMap(a => restProduct.map(rs => [a, ...rs]))
}

function indices(until: number): string[] {
  return times(until, 0).map((_, i) => '' + (i + 1))
}

function parts(parts: number, offset?: number): string[] {
  return Array(parts).fill(null).map((_, i) => `${(i + (offset || 0)) % parts + 1}`)
  // return Array(parts).fill(null).map((_, i) => `${(i + (offset || 0)) % parts + 1}/${parts}`)
  // return Array(parts).fill(null).map((_, i) => `${100 * (i + (offset || 0) / 100 * parts) / parts}%`)
}

function partsShuf(ps: number, offset?: number): string[] {
  return shuffle(parts(ps, offset))
}

// sublists aren't guaranteed to be of the same size
// no elements should be lost
function divide<A>(as: A[], parts: number): A[][] {
  return Array(parts).fill(null).map((_, idx) => {
    const idxScaled = idx / parts
    const idxScaledP = (idx + 1) / parts

    const start = Math.round(idxScaled * as.length)
    const end = Math.round(idxScaledP * as.length)

    return as.slice(start, end)
  })
}

function partChunks(part: number, chunk: number, offset?: number): string[][] {
  return divide(parts(part, offset), chunk)
}

// Bug: offset screws it up
function partChunksShuf(part: number, chunk: number, offset?: number): string[][] {
  return divide(shuffle(parts(part, offset)), chunk)
}

function zipSep(ass: string[][], sep: string = ''): string[] {
  const minLength = ass.map(as => as.length).reduce((prev, next) => Math.min(prev, next), 100000)
  const width = Array(ass.length).fill(null).map((_, idx) => idx)
  return Array(minLength).fill(null).map((_, idx) => width.map(w => ass[w][idx]).join(sep))
}

function zip(...ass: string[][]): string[] {
  return zipSep(ass, '')
}

function zipSpace(...ass: string[][]): string[] {
  return zipSep(ass, ' ')
}

function zipSlash(...ass: string[][]): string[] {
  return zipSep(ass, '/')
}

function zipInterleave<A>(...args: A[][]): A[] {
  const lengths = args.map(l => l.length)
  const div = _.max(lengths) as number
  const zipped = zipT(...args.map(l => divide(l, div)))
  return zipped.flat().flat()
}

function zipLongestGen<A>(timesUntil: (a: number, as: A[]) => A[], ...args: A[][]): A[][] {
  const lengths = args.map(a => a.length)
  const longest = _.max(lengths) || 0

  return zipT(...args.map(a => timesUntil(longest, a)))
}

function zipLongest<A>(...args: A[][]): A[][] {
  return zipLongestLib(...args)
}

function zipLongestShuf<A>(...args: A[][]): A[][] {
  return zipLongestGen(timesUntilShuf, ...args)
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
  return times(number, list).reduce((list, addition) => list.concat(shuffleConstraintFirst(list.slice(-1), addition)), [])
}

function comb<A>(a: A[], n: number): A[][] {
  return [... new Comb.Combination(a, n)]
}

function combMirr<A>(a: A[], n: number): A[][] {
  return _.uniq(comb(a, n).flatMap(c => [c, [...c].reverse()])).sort()
}

function perm<A>(a: A[]): A[][] {
  return [...new Comb.Permutation(a)]
}

function pick<A>(array: A[] | string): A | string {
  if (typeof array === 'string') return pickArray(ss(array))
  else return pickArray(array)
}

function powerBuckets<A>(a: A[]): A[][][] {
  return Object.values(_.groupBy([...(new Comb.PowerSet(a))], 'length'))
}

function power<A>(a: A[]): A[][] {
  return powerBuckets(a).flat()
}

function pickEarlyBias<A>(as: A[]): A {
  const weight = (index: number) => Math.max((as.length - index) - as.length / 1.5, 0)
  const weights: [A, number][] = as.map((a, index) => [a, weight(index)])
  const a: A | undefined = new Picker(as, { weights }).pick()
  return a as A
}

function picksEarlyBias<A>(as: A[]): A[] {
  if (as.length == 0) return []

  const [next, ...rest] = arrayMove(as, pickEarlyBias(arrayIndices(as)), 0)

  return [next, ...picksEarlyBias(rest)]
}

// scheduling

// [0..modulo-1]
function dayRandom(modulo?: number): number {
  return murmur.x86.hash32(new Date().toISOString().slice(0, 10)) % (modulo || 100000)
}

function daysModulo(days: number, modulo: number): number {
  return Math.floor(Math.floor(Date.now() / 86400000) / days) % modulo
}

function maybeEvery(nthDayXOffset: number | string, itemsIn: string | string[]): string[] {
  let nthDay: number
  let offset: number = 0
  const match = typeof nthDayXOffset === 'string' ? nthDayXOffset.match(/^(\d+),(\d+)$/) : null

  if (typeof nthDayXOffset === 'string') {
    if (match === null) return [`error: maybeEvery(${nthDayXOffset} ${itemsIn}): parse error`]

    nthDay = parseInt(match![1] || '', 10)
    offset = parseInt(match![2] || '', 10)
  } else {
    nthDay = nthDayXOffset
  }

  const items: string[] = typeof itemsIn === 'string' ? [itemsIn] : itemsIn

  if (nthDay <= 1) return items

  return (dayRandom(nthDay) + offset) % nthDay == 0 ? items : []
}

function after(date: string, items: string | string[]): string[] {
  const list = typeof items === 'string' ? [items] : items
  return new Date() >= new Date(date) ? list : []
}

// percentages

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

// progressive gluing

function indexPyramid(totalLength: number): number[][][] {
  return directRange(1, totalLength).map((_, length) => {
    return directRange(0, totalLength - 1).map((_, start) => {
      return directRange(start, start + length).map(x => x % totalLength)
    })
  })
}

function phrasePyramid(phrasesIn: string | string[]): string[][] {
  const phrases = typeof phrasesIn === 'string' ? s(phrasesIn) : phrasesIn

  return indexPyramid(phrases.length).map(ofLength => ofLength.map(sequence => {
    const range = sequence.map(i => phrases[i])
    const seqLength = range.length - 1

    const abbrev = range.length == 1 ? [range] : [range.at(0), range.at(-1)]
    if (seqLength >= 8) abbrev.splice(1, 0, '...')
    else if (seqLength >= 4) abbrev.splice(1, 0, '..')
    else if (seqLength >= 2) abbrev.splice(1, 0, '.')
    return `[${abbrev.join(' ')}]`.replaceAll(/ (\.{1,3}) /g, '$1')
  }))
}

// testable, just shuffled has to be passed
// bug: roughness too low or high crashes
function pyramid(phrasesIn: string | string[], roughness?: number): string[][] {
  roughness ||= 1000
  const divisions = divide(phrasePyramid(phrasesIn), roughness)
  return divisions.map((division, index) => {
    const first = index == 0
    const last = index == divisions.length - 1
    const representative = shuffle(division.length == 0 ? [] : division.at(last ? -1 : 0) as string[])

    const tooLong = !(first || last) && representative.length > roughness
    return tooLong ? representative.slice(0, roughness) : representative
  })
}

// for scheduleBlocks
function phraseKey(phrase: string): string {
  return `${phrase.replaceAll(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')}: play`
}

// block utilities

function aba<A>(as: A[], bs: A[]): A[] {
  const [a1, a2] = divide(as, 2)
  return [...a1, ...bs, ...a2]
}

function pickKeys(settings?: PickKeysInt): string[][] {
  settings = settings || {}

  const keys = keyCenters(settings?.mode || 0)

  if (typeof settings?.split == 'number') {
    settings.div = Math.round(12 / settings.split)
    settings.order = settings.split
  }

  const ordered = _.sortBy(keys, k => {
    const base = keys[0]
    const based = semi(rebase(k, base))
    return ((based - semi(base)) * (settings.order || 1) % 12) + semi(base)
  })

  const shuf = settings.shuffle === true
  const chunks = divide(ordered, settings.div || 1).map(c => shuf ? shuffle(c) : c)
  const shufChunks = shuf ? shuffle(chunks) : chunks

  return shufChunks.map(c => c.map(k => render(k, false)))
}

function pickKeysShuf(settings?: PickKeysInt): string[][] {
  return pickKeys({ ...settings, shuffle: true, split: parseInt(pick('34')) })
}

function letterKeys(): string[] {
  return majorKeyCentersWeighted().map(([, ...chunks]) => {
    const weights = chunks.flatMap(([notes, weight]) => keyChunkWeights(notes, weight))
    return new Picker(weights.map(x => x[0]), { weights: weights }).pick() as Note
  }).map(n =>
    render(n, false)
  )
}

// violin

function scalePositions(opts: { arrows?: boolean } = {}) {
  const arrows: string[] = opts?.arrows === false ? times(8, '') : shuffleX('↑↑↓↓', 2)
  return zip(ss('123456'), shuffleX(`GDAE`, 2), shuffleX('uudd', 2), arrows).map(example =>
    example.replace(/([GE].)[↑↓]/, (_, withoutDirection) => withoutDirection)
  ).join(' ')
}

// features:
// * if going down, position = +2
// * on GD it's always up, on AE, it's always down. the direction is therefore not shown
function scalePositionsDbl() {
  return zip(ss('123456'), shuffleX(`GD DA AE`, 2), shuffleX('uudd', 2), shuffleX('↓↓↑↑', 2)).map(example =>
    example.replace(/(\d)(GD|DA|AE)(.)([↑↓])/, (_, position, string, bow, direction) => {
      if (string == 'GD') direction = '↑'
      const logicalDirection = string == 'AE' ? '↓' : direction
      if (string == 'GD' || string == 'AE') direction = ''
      if (logicalDirection == '↓') position = parseInt(position) + 2
      return position + string + bow + direction
    })
  )
}

type PickKeysInt = {
  count?: number,
  mode?: number,
  order?: number,
  div?: number,
  split?: number, // should control order/div
  shuffle?: boolean,
}

export type Interface = {
  // DSL
  s: (s: string) => string[],
  ss: (s: string) => string[],
  j: <A>(as: A[]) => string,
  ij: <A>(i: string, as: A[][]) => string[],

  // array
  times: <A>(n: number, a: A | ((idx?: number) => A)) => A[],
  timesUntil: <A>(length: number, a: A[]) => A[],
  timesUntilShuf: <A>(length: number, a: A[]) => A[],
  indices: (until: number) => string[],
  parts: (n: number, m?: number) => string[],
  partsShuf: (n: number, m?: number) => string[],
  divide: <A>(as: A[], parts: number) => A[][],
  partChunks: (part: number, chunk: number, offset?: number) => string[][],
  partChunksShuf: (part: number, chunk: number, offset?: number) => string[][],
  zip: (...as: string[][]) => string[],
  zipSpace: (...as: string[][]) => string[],
  zipSlash: (...as: string[][]) => string[],
  zipT: <A>(...ass: A[][]) => A[][],
  zipInterleave: <A>(...args: A[][]) => A[],
  zipLongest: <A>(...args: A[][]) => A[][],
  zipLongestShuf: <A>(...args: A[][]) => A[][],
  intersperse: <A>(arr: A[], sep: A) => A[],
  interspersing: <A>(arr: A[], sep: A[]) => A[],
  interleavingEvery: <A>(into: A[], what: A[], every: number) => A[],
  arrayRotate<A>(arr: A[], count: number): A[],

  // combinatorics
  cross: (sentence: string) => string[],
  product: <A>(...arrays: A[][]) => A[][],
  shuffle: <A>(a: A[]) => A[],
  shuffleM: <A>(a: A[]) => A[],
  shuffleX: <A>(a: A[] | string, number: number) => A[],
  comb<A>(a: A[], n: number): A[][],
  combMirr<A>(a: A[], n: number): A[][],
  perm<A>(a: A[]): A[][],
  powerBuckets<A>(a: A[]): A[][][],
  power<A>(a: A[]): A[][],
  powerInnerBuckets<A>(a: A[]): A[][][],
  powerInner<A>(a: A[]): A[][],

  pick: <A>(array: A[] | string) => A | string,

  dayRandom: (modulo?: number) => number,
  daysModulo: (days: number, modulo: number) => number,
  maybeEvery: (nthDayXOffset: number | string, item: string | string[]) => string[],
  after: (date: string, items: string | string[]) => string[],

  // percentages

  progress: (start: string, end: string) => number,
  progressClamp: (start: string, end: string, from: number, to: number) => number,

  // progressive gluing

  indexPyramid: (totalLength: number) => number[][][],
  phrasePyramid(phrases: string | string[]): string[][],
  pyramid(phrases: string | string[], roughness?: number): string[][],
  phraseKey(phrase: string): string,

  // block operations
  context: Map<string, any> | null,
  block: (name: string, ...args: any) => any | undefined,
  blockLines(name: string, ...args: any): RenderLine[],
  aba<A>(as: A[], bs: A[]): A[],
  scheduleBlocks: (sentence: string) => RenderLine[],
  zipBlocksDiv: (names: string, div: number, ...args: any) => string[],
  zipScheduleBlocks(sentence: string): RenderLine[],

  pickKeys: (settings?: PickKeysInt) => string[][],
  pickKeysShuf: (settings?: PickKeysInt) => string[][],
  letterKeys: () => string[],

  pickEarlyBias<A>(as: A[]): A,
  picksEarlyBias<A>(as: A[]): A[],
  pickTasksStateless<A extends RenderLine>(items: A[]): A[],

  // state
  glob: (pattern: string) => string[],

  // domain specific
  scalePositions: (opts: { arrows?: boolean }) => string,
  scalePositionsDbl: () => string[],
  chromaticSlide: (tonic: Note | string, s: 'G' | 'D' | 'A' | 'E') => string,
}

export function randomizeLangUtils(context: Map<string, any>, memory: Map<string, any>): Interface {
  // Note: uses memory
  function pickTasksStateless<A extends RenderLine>(items: A[]): A[] {
    if (items.length == 0) return []

    const sorted = (_.sortBy(items, item => {
      const cards = cardMemory(memory)
      const otherwiseOrder = murmur.x86.hash32(item.contents)
      // console.log(`${item.key}.reviewed = ${(cards[item.key || '']?.reviewed || -otherwiseOrder)}`)
      return (cards[item.key || '']?.reviewed || -otherwiseOrder)
    }))

    return picksEarlyBias(sorted)
  }

  // state

  // Glob the images gathered into the state (threaded in via additionalContext,
  // read from `context`). A pattern with `*`/`?` is treated as a glob over the
  // whole filename; a plain pattern is a substring match. Returns the matching
  // filenames (the image block resolves filenames back to URLs).
  function glob(pattern: string): string[] {
    const images: ImageEntry[] = context.get('images') || []
    const names = images.map(([filename]) => filename)

    if (/[*?]/.test(pattern)) {
      const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      return names.filter(name => re.test(name))
    }

    return names.filter(name => name.includes(pattern))
  }

  function block(name: string, ...args: any): string[] {
    return blockLines(name, ...args).map(rl => rl.contents)
  }

  function blockLines(name: string, ...args: any): RenderLine[] {
    const lookup = context.get(`${name}`)
    if (!lookup) return [errorLine(`block('${name}') == ${lookup}`)]
    const lookupChecked = lookup as (...args: any) => RenderLine[]
    return lookupChecked(...args)
  }

  function zipBlocksDiv(names: string, div: number, ...args: any): any[string] {
    const zipped = zipT(...s(names).map(name => divide(block(name, ...args), div)))
    return zipped.flat().flat()
  }

  // function pickBlock(name: string, n?: number | 'full'): string[] {
  //   if (n == 0) return []
  //   if (!block(name)) return [`pickBlock: cannot find ${name}`]
  //   if (n === 'full') return block(name) // this is just wrong
  //   return pickTasks(name, block(name), n)
  // }

  function pickBlockStateless(name: string, n: number | 'full'): RenderLine[] {
    const lines = blockLines(name)
    if (!lines) return [errorLine(`pickBlockStateless: cannot find ${name}`)]
    return pickTasksStateless(lines).slice(0, n == 'full' ? 10000 : n)
  }

  function zipScheduleBlocks(sentence: string): RenderLine[] {
    return zipInterleave(...s(sentence).map(x => scheduleBlocks(x)))
  }

  function parseScheduleBlocksSentence(sentence: string): string | [string, number | 'full'][] {
    let err

    const parsed = [...sentence.matchAll(/[^ ]+/g)].map(x => x[0]).map(s => {
      const match = s.match(/^([a-z0-9-]+?)(?:-(\d+|\*))?$/i)

      if (!match) err = "block name not found"
      if (!match![1]) err = "cannot parse block name"

      const count: number | 'full' = match![2] === undefined ? 'full' : parseInt(match![2] || '1', 10)

      return [match![1], count] satisfies [string, number | 'full']
    })

    if (err) return `scheduleBlockks: ${err}`

    return parsed
  }

  function scheduleBlocks(sentence: string): RenderLine[] {
    const parsed = parseScheduleBlocksSentence(sentence)
    if (typeof parsed == 'string') return [errorLine(parsed)]
    return parsed.flatMap(([name, amount]) => pickBlockStateless(name, amount))
  }

  return {
    s,
    ss,
    j,
    ij,

    times,
    timesUntil,
    timesUntilShuf,
    indices,
    parts,
    partsShuf,
    divide,
    partChunks,
    partChunksShuf,
    zip,
    zipSpace,
    zipSlash,
    zipT,
    zipInterleave,
    zipLongest,
    zipLongestShuf,
    intersperse,
    interspersing,
    interleavingEvery,
    arrayRotate: arrayShift,

    cross,
    product,
    shuffle,
    shuffleM,
    shuffleX,
    comb,
    combMirr,
    perm,
    power,
    powerBuckets,
    powerInnerBuckets: <A>(a: A[]) => powerBuckets(a).slice(1, -1),
    powerInner: <A>(a: A[]) => power(a).slice(1, -1),

    pick,

    dayRandom,
    daysModulo,
    maybeEvery,
    after,

    progress,
    progressClamp,

    indexPyramid,
    phrasePyramid,
    pyramid,
    phraseKey,

    context,
    block,
    blockLines,
    aba,
    scheduleBlocks,
    zipBlocksDiv,
    zipScheduleBlocks,

    pickKeys,
    pickKeysShuf,
    letterKeys,

    pickEarlyBias,
    picksEarlyBias,
    pickTasksStateless,

    glob,

    scalePositions,
    scalePositionsDbl,
    chromaticSlide,
  }
}
