import { pick as pickArray, shuffleArray, shuffleMinDistance } from "../lib/Random"
import { intersperse, interspersing, interleavingEvery, zipT, directRange } from '../lib/Array'
import { keysBySemi, keySemis, Note, render } from '../lib/ToneLib'
import _ from 'lodash'
import { chromaticSlide } from '../lib/ToneLibViolin'
import murmur from 'murmurhash3js'

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
  pickMemK: (key: string | undefined, array: any[] | string, n: number | undefined, stats?: any) => any[],

  pickMem: (array: any[] | string, n: number | undefined) => any[],
  pickTasks: (key: string, items: string[], n?: number) => any[],

  dayRandom: (modulo?: number) => number,
  maybeEvery: (nthDay: number, item: string | string[]) => string[],

  // percentages

  progress: (start: string, end: string) => number,
  progressClamp: (start: string, end: string, from: number, to: number) => number,

  // progressive gluing

  phrasePyramid(phrases: string | string[]): string[][],
  pyramid(phrases: string | string[], roughness?: number): string[][],

  // block operations
  context: Map<string, any> | null,
  block: (name: string, ...args: any) => any | undefined,
  aba: (as: string[], bs: string[]) => string[],
  pickBlock: (name: string, n?: number) => any[],
  scheduleBlocks: (sentence: string) => string[],
  zipBlocksDiv: (names: string, div: number, ...args: any) => string[],

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
    if (s.indexOf(',') !== -1) return s.split(/ *, */).filter(x => x != '')
    if (s.indexOf(' ') !== -1) return s.split(' ').filter(x => x != '')
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
    return times(list, number).reduce((list, addition) => list.concat(shuffleConstraintFirst(list.slice(-1), addition)), [])
  }

  function pick<A>(array: A[] | string): A | string {
    if (typeof array === 'string') return pickArray(ss(array))
    else return pickArray(array)
  }

  // bug: if a key is used, but array now contains fewer items, the previous frequencies will have items that are no longer present
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
    const frequencies: [any, number][] = items.map(item => {
      return [item, (storedStats[item] || 0)] satisfies [any, number]
    })
    const frequenciesSorted = _.sortBy(frequencies, 1)
    const item = pick(frequenciesSorted.filter(([_, freq]) => freq == frequenciesSorted[0][1]))[0]

    const nextStats = Object.fromEntries(frequencies)
    nextStats[item] = (nextStats[item] || 0) + 1
    memory.set(memoryKey, nextStats)

    // const debug = frequencies.map(([k, f]) => `${k}/${f}`).join(' ')
    // console.log(frequencies.reduce((sum, [_, f]) => sum + f, 0), JSON.stringify(frequencies))

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
    const theKey = `${key}||${keys}`

    const mapM = new Map<string, string[]>()
    mapF.map(([k, v]) => {
      mapM.set(k, (mapM.get(k) || []).concat([v]))
    })

    return pickMemK(theKey, keys, n).map(keyOut => pick(mapM.get(keyOut) || ['missing']))
  }

  // scheduling

  function dayRandom(modulo?: number): number {
    return murmur.x86.hash32(new Date().toISOString().slice(0, 10)) % (modulo || 100000)
  }

  function maybeEvery(nthDay: number, itemsIn: string | string[]): string[] {
    const items: string[] = typeof itemsIn === 'string' ? [itemsIn] : itemsIn

    console.log(dayRandom(nthDay))
    return dayRandom(nthDay) == 0 ? items : []
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

  function phrasePyramid(phrasesIn: string | string[]): string[][] {
    const phrases = typeof phrasesIn === 'string' ? s(phrasesIn) : phrasesIn

    return directRange(1, phrases.length).map((_, length) => {
      return directRange(0, phrases.length - 1 - length).map((_, start) => {
        const range = directRange(start, start + length).map(i => phrases[i])
        const abbrev = range.length == 1 ? [range] : [range.at(0), range.at(-1)]
        if (length >= 8) abbrev.splice(1, 0, '...')
        else if (length >= 4) abbrev.splice(1, 0, '..')
        else if (length >= 2) abbrev.splice(1, 0, '.')
        return `[${abbrev.join(' ')}]`.replaceAll(/ (\.{1,3}) /g, '$1')
      })
    })
  }

  // testable, just shuffled has to be passed
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

  function pickBlock(name: string, n?: number): string[] {
    if (!block(name)) return [`pickBlock: cannot find ${name}`]
    return pickTasks(name, block(name), n)
  }

  function scheduleBlocks(sentence: string): string[] {
    let err

    const parsed = [...sentence.matchAll(/[^ ]+/g)].map(x => x[0])
    const blocks = parsed.map(s => {
      const match = s.match(/^([a-z0-9]+?)-?(\d+)?$/i)

      if (!match) err = "block name not found"
      if (!match![1]) err = "cannot parse block name"

      return [match![1], parseInt(match![2] || '1', 10)] satisfies [string, number]
    })

    if (err) return [`scheduleBlockks: ${err}`]

    return blocks.flatMap(([name, amount]) => pickBlock(name, amount))
  }

  // practical calculations

  function pickNKeys(cacheKey: string, n?: number): string[] {
    if (!n) return []
    const offsets = times(null, n - 1).map((_, index) => (12 / n) * (index + 1))
    return pickKeysOffset(cacheKey, ...offsets)
  }

  function pickKeys(cacheKey: string, n: number): string[] {
    const semis = keySemis()
    const key = `pickKeys|${cacheKey}`
    const pick = pickMemK(key, semis, n)

    return pick.map(s => {
      const keys = keysBySemi(s)
      const note = keys.length !== 1 ? pickMemK(`${key}|FG`, keys, 1)[0] : keys[0]
      return render(note, false)
    })
  }

  function pickKeysOffset(cacheKey: string, ...offsets: number[]): string[] {
    const semis = keySemis()
    const key = `pickKeys|${cacheKey}`
    const picks = (pickMemK(key, semis) as number[]).flatMap(n => [n, ...offsets.map(o => o + n)])

    return picks.map(s => {
      const keys = keysBySemi(s)
      const note = keys.length !== 1 ? pickMemK(`${key}|FG`, keys, 1)[0] : keys[0]
      return render(note, false)
    })
  }

  // violin

  function scalePositions(opts: { arrows?: boolean } = {}) {
    const arrows: string[] = opts?.arrows === false ? times('', 8) : shuffleX('↑↑↓↓', 2)
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

    progress,
    progressClamp,

    phrasePyramid,
    pyramid,

    context,
    block,
    aba,
    pickBlock,
    scheduleBlocks,
    zipBlocksDiv,

    pickNKeys,
    pickKeys,
    pickKeysOffset,

    scalePositions,
    scalePositionsDbl,
    chromaticSlide,
  }
}
