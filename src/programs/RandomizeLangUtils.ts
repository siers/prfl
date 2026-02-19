import { pick as pickArray, randInt, shuffleArray, shuffleMinDistance } from "../lib/Random"
import { intersperse, interspersing, interleavingEvery, zipT, directRange } from '../lib/Array'
import { keysBySemi, keySemis, Note, render } from '../lib/ToneLib'
import _ from 'lodash'
import { chromaticSlide } from '../lib/ToneLibViolin'
import murmur from 'murmurhash3js'
import { roundToNaive } from '../lib/Math'

export type Interface = {
  // DSL
  s: (s: string) => string[],
  ss: (s: string) => string[],
  cross: (sentence: string) => string[],

  // array
  times: <A>(n: number, a: A | ((idx?: number) => A)) => A[],
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
  zipInterleave: <A>(...args: A[][]) => A[],
  intersperse: <A>(arr: A[], sep: A) => A[],
  interspersing: <A>(arr: A[], sep: A[]) => A[],
  interleavingEvery: <A>(into: A[], what: A[], every: number) => A[],

  shuffle: <A>(a: A[]) => A[],
  shuffleM: <A>(a: A[]) => A[],
  shuffleX: <A>(a: A[] | string, number: number) => A[],

  pick: <A>(array: A[] | string) => A | string,
  pickMemK: (key: string | undefined, array: any[] | string, n: number | undefined, stats?: any) => any[],

  pickMem: (array: any[] | string, n: number | undefined) => any[],
  pickTasks: (key: string, items: string[], n?: number) => any[],

  dayRandom: (modulo?: number) => number,
  maybeEvery: (nthDayXOffset: number | string, item: string | string[]) => string[],
  after: (date: string, items: string | string[]) => string[],

  // percentages

  progress: (start: string, end: string) => number,
  progressClamp: (start: string, end: string, from: number, to: number) => number,

  // progressive gluing

  indexPyramid: (totalLength: number) => number[][][],
  phrasePyramid(phrases: string | string[]): string[][],
  pyramid(phrases: string | string[], roughness?: number): string[][],

  // block operations
  context: Map<string, any> | null,
  block: (name: string, ...args: any) => any | undefined,
  aba: (as: string[], bs: string[]) => string[],
  pickBlock: (name: string, n?: number) => any[],
  scheduleBlocks: (sentence: string) => string[],
  zipBlocksDiv: (names: string, div: number, ...args: any) => string[],

  pickKey: (n?: number) => string | string[],
  pickNKeys: (cacheKey: string, n: number) => string[],
  pickKeys: (cacheKey: string, n: number) => string[],
  pickKeysOffset: (cacheKey: string, ...offsets: number[]) => string[],

  // domain specific
  scalePositions: (opts: { arrows?: boolean }) => string,
  scalePositionsDbl: () => string[],
  chromaticSlide: (tonic: Note | string, s: 'G' | 'D' | 'A' | 'E') => string,
}

export function randomizeLangUtils(context: Map<string, any>, memory: Map<string, any>): Interface {
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

  function divide<A>(as: A[], parts: number): A[][] {
    const part = Math.max(1, Math.round(as.length / parts))
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

  function zipInterleave<A>(...args: A[][]): A[] {
    const lengths = args.map(l => l.length)
    const div = _.min(lengths) as number
    const zipped = zipT(...args.map(l => divide(l, div)))
    return zipped.flat().flat()
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

  function pick<A>(array: A[] | string): A | string {
    if (typeof array === 'string') return pickArray(ss(array))
    else return pickArray(array)
  }

  // stores pick order (incrementing index), picks by linear weight:
  // oldest gets weight 2x, middle gets x, past middle gets 0
  function pickWeighted(ordered: [any, number][]): any {
    if (ordered.length == 1) return ordered[0][0]
    const mid = Math.ceil(ordered.length / 2)
    const weights = ordered.map((_, i) => i < mid ? 2 * (mid - 1 - i) + 1 : 0)
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < ordered.length; i++) {
      r -= weights[i]
      if (r <= 0) return ordered[i][0]
    }
    return ordered[mid - 1][0]
  }

  // Note: uses memory
  function pickMemK(
    key: string | undefined,
    array: any[] | string,
    n: number | undefined = undefined,
    stats: any = undefined,
  ): any[] {
    if (n !== undefined && n <= 0) return []

    const items = ((typeof array === 'string') ? s(array) : array).sort()
    if (!items.length) return []

    const memoryKey = key || items.join('||')

    const storedStats = stats || memory.get(memoryKey) || {}
    const storedValues = Object.values(storedStats).map(Number)
    const minOrder = storedValues.length ? Math.min(...storedValues) : 0
    const maxOrder = storedValues.length ? Math.max(...storedValues) : -1
    const orders: [any, number][] = items.map(item => {
      return [item, storedStats[item] ?? minOrder - 1] satisfies [any, number]
    })
    const ordersSorted = _.sortBy(orders, 1)
    const item = pickWeighted(ordersSorted)

    const nextStats = { ...storedStats, ...Object.fromEntries(orders) }
    nextStats[item] = maxOrder + 1
    memory.set(memoryKey, nextStats)

    return [item, ...pickMemK(memoryKey, items, (n || 0) - 1)]
  }

  function pickMem(array: any[] | string, n: number | undefined): any[] {
    return pickMemK(undefined, array, n)
  }

  function pickTasks(key: string, items: string[], n?: number): string[] {
    const map = items.map(i => {
      const match = i.match(/^([a-zA-Z0-9\-]+):/)
      if (!match || !match[1]) return
      return [match[1], i] satisfies [string, string]
    })

    if (map.some(x => !x)) return [`pickTasks: ids missing for '${key}'`]

    const mapF = map.flatMap(i => i ? [i] : [])
    const keys = _.uniq(mapF.map(([key, _]) => key))

    const mapM = new Map<string, string[]>()
    mapF.map(([k, v]) => {
      mapM.set(k, (mapM.get(k) || []).concat([v]))
    })

    return pickMemK(key, keys, n).map(keyOut => pick(mapM.get(keyOut) || ['missing']))
  }

  // scheduling

  // [0..modulo-1]
  function dayRandom(modulo?: number): number {
    return murmur.x86.hash32(new Date().toISOString().slice(0, 10)) % (modulo || 100000)
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
      const representative = shuffle(division.at(last ? -1 : 0) as string[])

      const tooLong = !(first || last) && representative.length > roughness
      return tooLong ? representative.slice(0, roughness) : representative
    })
  }

  // block utilities

  function block(name: string, ...args: any): any {
    const lookup = context.get(name)
    if (!lookup) return [`error: block('${name}') == ${lookup}`]
    const lookupChecked = lookup as (...args: any) => string[]
    return lookupChecked(...args)
  }

  function aba(as: string[], bs: string[]): string[] {
    const [a1, a2] = divide(as, 2)
    return [...a1, '---', ...bs, '---', ...a2]
  }

  function zipBlocksDiv(names: string, div: number, ...args: any): any[string] {
    const zipped = zipT(...s(names).map(name => divide(block(name, ...args), div)))
    return zipped.flat().flat()
  }

  function pickBlock(name: string, n?: number | 'full'): string[] {
    if (!block(name)) return [`pickBlock: cannot find ${name}`]
    if (n === 'full') return block(name)
    return pickTasks(name, block(name), n)
  }

  function scheduleBlocks(sentence: string): string[] {
    let err

    const parsed = [...sentence.matchAll(/[^ ]+/g)].map(x => x[0])
    const blocks = parsed.map(s => {
      const match = s.match(/^([a-z0-9-]+?)(?:-(\d+|\*))?$/i)

      if (!match) err = "block name not found"
      if (!match![1]) err = "cannot parse block name"

      const count: number | 'full' = match![2] == '*' ? 'full' : parseInt(match![2] || '1', 10)

      return [match![1], count] satisfies [string, number | 'full']
    })

    if (err) return [`scheduleBlockks: ${err}`]

    return blocks.flatMap(([name, amount]) => pickBlock(name, amount))
  }

  // practical calculations

  function pickKey(n?: number): string | string[] {
    const shufflePick = (a: number[]) => (shuffleArray(a).slice(0, 1))

    if ((n || 0) <= 0) return []
    if (n == 1) return pickKeysOffsetGeneric(shufflePick)[0]

    const offsets = times((n || 0) - 1, 0).map(_ => randInt(0, 12 * 3))
    return pickKeysOffsetGeneric(shufflePick, ...offsets)
  }

  function pickNKeys(cacheKey: string, n?: number): string[] {
    if (!n) return []
    const offsets = times(n - 1, null).map((_, index) => (12 / n) * (index + 1))
    return pickKeysOffset(cacheKey, ...offsets)
  }

  function pickKeys(cacheKey: string, n: number): string[] {
    const semis = keySemis()
    const key = `pickKeys|${cacheKey}`
    const pick = pickMemK(key, semis, n)

    return pick.map(s => {
      const keys = keysBySemi(s)
      const note = keys.length !== 1
        ? JSON.parse(pickMemK(`${key}|FG`, keys.map(k => JSON.stringify(k)), 1)[0])
        : keys[0]
      return render(note, false)
    })
  }

  function pickKeysOffsetGeneric(shufflePick: (as: number[]) => number[], ...offsets: number[]): string[] {
    const semis = keySemis()
    const picks = shufflePick(semis).flatMap(n => [n, ...offsets.map(o => o + n)])

    return picks.map(s => {
      const keys = keysBySemi(s)
      const note = keys.length !== 1 ? pickArray(keys) : keys[0]
      return render(note, false)
    })
  }

  function pickKeysOffset(cacheKey: string, ...offsets: number[]): string[] {
    const key = `pickKeys|${cacheKey}`
    const shuffler = (semis: number[]) => pickMemK(key, semis)
    return pickKeysOffsetGeneric(shuffler, ...offsets)
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
    return zip(ss('123456'), shuffleX(`GD DA AE`, 2), shuffleX('uudd', 2), shuffleX('↓↓↑↑↑', 2)).map(example =>
      example.replace(/(\d)(GD|DA|AE)(.)([↑↓])/, (_, position, string, bow, direction) => {
        const logicalDirection = string == 'AE' ? '↓' : direction
        if (string == 'GD' || string == 'AE') direction = ''
        if (logicalDirection) position = parseInt(position) + 2
        return position + string + bow + direction
      })
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
    j,
    jj,
    zip,
    zipSpace,
    zipT,
    zipInterleave,
    intersperse,
    interspersing,
    interleavingEvery,

    shuffle,
    shuffleM,
    shuffleX,

    pick,
    pickMemK,
    pickMem,
    pickTasks,

    dayRandom,
    maybeEvery,
    after,

    progress,
    progressClamp,

    indexPyramid,
    phrasePyramid,
    pyramid,

    context,
    block,
    aba,
    pickBlock,
    scheduleBlocks,
    zipBlocksDiv,

    pickKey,
    pickNKeys,
    pickKeys,
    pickKeysOffset,

    scalePositions,
    scalePositionsDbl,
    chromaticSlide,
  }
}
