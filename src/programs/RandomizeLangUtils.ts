import { RenderLine, errorLine } from './RandomizeLangTypes'
import { cardMemory } from './RandomizeTypes'
import type { ImageEntry } from '../lib/PrflAssets'

import { pick as pickArray, randInt, shuffleArray, shuffleMinDistance } from '../lib/Random'
import { zipT, zipLongest as zipLongestLib, timesUntil as timesUntilLib, directRange, arrayShift, arrayMove, indices as arrayIndices } from '../lib/Array'
import { keyCenters, keyChunkWeights, majorKeyCentersWeighted, Note, parseNote, rebase, renderN, semi } from '../lib/ToneLib'
import * as ToneLib from '../lib/ToneLib'
import { frets as fretsLib, modeShifts as modeShiftsLib, deserializeModeShift } from '../lib/ToneLibViolin'
import * as ToneLibViolin from '../lib/ToneLibViolin'
import { roundToNaive } from '../lib/Math'
import { shiftFormat, shifts as shiftsLib, shiftsDistributed } from '../lib/Combinatorics'
import * as Comb from 'ts-combinatorics'

import _ from 'lodash'
import murmur from 'murmurhash3js'
import { Picker } from 'bentools-picker'

export function s(s: string): string[] {
  let out: string[]

  if (s.indexOf(',') !== -1) out = s.split(/ *, */)
  else if (s.indexOf(' ') !== -1) out = s.split(' ')
  else out = s.split('')

  return out.filter(x => x != '' && x != '-')
}

export function ss(sentence: string): string[] {
  return shuffle(s(sentence))
}

export function j<A>(as: A[]): string {
  return as.join(' ')
}

// inner join
export function ij<A>(i: string, as: A[][]): string[] {
  return as.map(a => a.join(i))
}

export function cross(sentence: string): string[] {
  const arrays = sentence.split(/ *x */).map(s)
  if (arrays.length > 1) {
    const [first, ...rest] = arrays
    return rest.reduce((as, others) => as.flatMap(a => others.map(o => `${a}${o}`)), first)
  } else {
    return []
  }
}

export function times<A>(n: number, a: A | ((idx?: number) => A)): A[] {
  if (typeof a === 'function') return Array(n).fill(0).map((_, i) => (a as (idx?: number) => A)(i))
  else return Array(n).fill(a)
}

export function timesUntil<A>(length: number, a: A[]): A[] {
  return timesUntilLib(length, a)
}

export function timesUntilShuf<A>(length: number, a: A[]): A[] {
  if (a.length == 1) return timesUntil(length, a)
  if (a.length == 2) a = shuffle([...a, ...a])
  const out = a.length < length ? shuffleX(a, Math.ceil(length / a.length)) : a
  return out.slice(0, length)
}

export function product<A>(...arrays: A[][]): A[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = product(...rest)
  return first.flatMap(a => restProduct.map(rs => [a, ...rs]))
}

export function indices(until: number): string[] {
  return times(until, 0).map((_, i) => '' + (i + 1))
}

export function parts(parts: number, offset?: number): string[] {
  return Array(parts).fill(null).map((_, i) => `${(i + (offset || 0)) % parts + 1}`)
  // return Array(parts).fill(null).map((_, i) => `${(i + (offset || 0)) % parts + 1}/${parts}`)
  // return Array(parts).fill(null).map((_, i) => `${100 * (i + (offset || 0) / 100 * parts) / parts}%`)
}

export function partsShuf(ps: number, offset?: number): string[] {
  return shuffle(parts(ps, offset))
}

// sublists aren't guaranteed to be of the same size
// no elements should be lost
export function divide<A>(as: A[], parts: number): A[][] {
  return Array(parts).fill(null).map((_, idx) => {
    const idxScaled = idx / parts
    const idxScaledP = (idx + 1) / parts

    const start = Math.round(idxScaled * as.length)
    const end = Math.round(idxScaledP * as.length)

    return as.slice(start, end)
  })
}

export function partChunks(part: number, chunk: number, offset?: number): string[][] {
  return divide(parts(part, offset), chunk)
}

// Bug: offset screws it up
export function partChunksShuf(part: number, chunk: number, offset?: number): string[][] {
  return divide(shuffle(parts(part, offset)), chunk)
}

export function zipSep(ass: string[][], sep: string = ''): string[] {
  const minLength = ass.map(as => as.length).reduce((prev, next) => Math.min(prev, next), 100000)
  const width = Array(ass.length).fill(null).map((_, idx) => idx)
  return Array(minLength).fill(null).map((_, idx) => width.map(w => ass[w][idx]).join(sep))
}

export function zip(...ass: string[][]): string[] {
  return zipSep(ass, '')
}

export function zipSpace(...ass: string[][]): string[] {
  return zipSep(ass, ' ')
}

export function zipSlash(...ass: string[][]): string[] {
  return zipSep(ass, '/')
}

export function zipInterleave<A>(...args: A[][]): A[] {
  const lengths = args.map(l => l.length)
  const div = _.max(lengths) as number
  const zipped = zipT(...args.map(l => divide(l, div)))
  return zipped.flat().flat()
}

export function zipLongestGen<A>(timesUntil: (a: number, as: A[]) => A[], ...args: A[][]): A[][] {
  const lengths = args.map(a => a.length)
  const longest = _.max(lengths) || 0

  return zipT(...args.map(a => timesUntil(longest, a)))
}

export function zipLongest<A>(...args: A[][]): A[][] {
  return zipLongestLib(...args)
}

export function zipLongestShuf<A>(...args: A[][]): A[][] {
  return zipLongestGen(timesUntilShuf, ...args)
}

//

export function shuffleM<A>(a: A[]): A[] {
  return shuffleMinDistance(a, 1)
}

export function shuffle<A>(a: A[]): A[] {
  return shuffleArray(a)
}

export function shuffleConstraintFirst<A>(shouldntBe: A[], b: A[]): A[] {
  const [shouldnts, rests] = _.partition(b, x => shouldntBe.indexOf(x) !== -1)
  if (rests.length == 0) {
    return []
  } else {
    const restRests = rests.slice(0, -1)
    const last = rests.at(-1)!
    return [last, ...shuffle(restRests.concat(shouldnts))]
  }
}

export function shuffleX<A>(a: A[] | string, number: number): A[] {
  const list: A[] = shuffle(typeof a === 'string' ? (s(a) as A[]) : a)
  return times(number, list).reduce((list, addition) => list.concat(shuffleConstraintFirst(list.slice(-1), addition)), [])
}

export function comb<A>(a: A[], n: number): A[][] {
  return [... new Comb.Combination(a, n)]
}

export function perm<A>(a: A[], size?: number): A[][] {
  return [...new Comb.Permutation(a, size)]
}

export function pick<A>(array: A[] | string): A | string {
  if (typeof array === 'string') return pickArray(ss(array))
  else return pickArray(array)
}

// Rotate by a random amount, so the cycle keeps its order but starts anywhere.
export function pickRotation<A>(array: A[] | string): A[] | string[] {
  if (typeof array === 'string') return rotateRandomly(s(array))
  else return rotateRandomly(array)
}

function rotateRandomly<A>(list: A[]): A[] {
  if (list.length == 0) return []
  return arrayRotate([...list], randInt(0, list.length - 1))
}

export function powerBuckets<A>(a: A[]): A[][][] {
  return Object.values(_.groupBy([...(new Comb.PowerSet(a))], 'length'))
}

export function power<A>(a: A[]): A[][] {
  return powerBuckets(a).flat()
}

export function pickEarlyBias<A>(as: A[]): A {
  const weight = (index: number) => Math.max((as.length - index) - as.length / 1.5, 0)
  const weights: [A, number][] = as.map((a, index) => [a, weight(index)])
  const a: A | undefined = new Picker(as, { weights }).pick()
  return a as A
}

export function picksEarlyBias<A>(as: A[]): A[] {
  if (as.length == 0) return []

  const [next, ...rest] = arrayMove(as, pickEarlyBias(arrayIndices(as)), 0)

  return [next, ...picksEarlyBias(rest)]
}

// scheduling

// [0..modulo-1]
export function dayRandom(modulo?: number): number {
  return murmur.x86.hash32(new Date().toISOString().slice(0, 10)) % (modulo || 100000)
}

export function daysModulo(days: number, modulo: number): number {
  return Math.floor(Math.floor(Date.now() / 86400000) / days) % modulo
}

export function maybeEvery(nthDayXOffset: number | string, itemsIn: string | string[]): string[] {
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

export function after(date: string, items: string | string[]): string[] {
  const list = typeof items === 'string' ? [items] : items
  return new Date() >= new Date(date) ? list : []
}

// percentages

export function progress(start: string, end: string) {
  const now = new Date().getTime()
  const startDate = new Date(start).getTime()
  const endDate = new Date(end).getTime()

  const perc = (now - startDate) / (endDate - startDate)

  return roundToNaive(Math.max(0, Math.min(1, perc)), 3)
}

export function progressClamp(start: string, end: string, from: number, to: number) {
  const diff = to - from
  return from + progress(start, end) * diff
}

// progressive gluing

export function substringsIdxs(seqLen: number, maxLenIn?: number, minLenIn?: number): [number, number][] {
  const maxLen = maxLenIn || seqLen
  const minLen = Math.max(minLenIn || 1)

  return directRange(minLen, maxLen).flatMap(length => {
    return directRange(0, seqLen - 1).map((_, start) => {
      return [start, (start + length) % seqLen] satisfies [number, number]
    })
  })
}

export function loopSubstringsG<A>(str: string | A[], maxLen?: number, minLen?: number): string[][] {
  const a: string[] = typeof str === 'string' ? s(str) : str.map(s => `${s}`)

  return substringsIdxs(a.length, maxLen, minLen).map(([first, last_]) => {
    const last = last_ <= first ? last_ + str.length : last_
    return [...a, ...a].slice(first, last)
  })
}

export function loopSubstringsZ<A>(str: string | A[], z: string, maxLen?: number, minLen?: number): string[] {
  return loopSubstringsG(str, maxLen, minLen).map(s => s.join(z))
}

export function loopSubstrings<A>(str: string | A[], maxLen?: number, minLen?: number): string[] {
  return loopSubstringsZ(str, '', maxLen, minLen)
}

export function indexPyramid(seqLen: number, maxLenIn?: number): number[][][] {
  const maxLen = maxLenIn || seqLen
  return directRange(1, maxLen).map((_, length) => {
    return directRange(0, seqLen - 1).map((_, start) => {
      return directRange(start, start + length).map(x => x % maxLen)
    })
  })
}

export function phrasePyramid(phrasesIn: string | string[]): string[][] {
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
export function pyramid(phrasesIn: string | string[], roughness?: number): string[][] {
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
export function phraseKey(phrase: string): string {
  return `${phrase.replaceAll(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')}: play`
}

// block utilities

export function aba<A>(as: A[], bs: A[]): A[] {
  const [a1, a2] = divide(as, 2)
  return [...a1, ...bs, ...a2]
}

export function pickKeys(settings?: PickKeysInt): string[][] {
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

  return shufChunks.map(c => c.map(k => renderN(k)))
}

export function pickKeysShuf(settings?: PickKeysInt): string[][] {
  return pickKeys({ ...settings, shuffle: true, split: parseInt(pick('34')) })
}

export function allKeys(settings?: PickKeysInt): string[] {
  return pickKeysShuf(settings).flat()
}

export function letterKeys(): string[] {
  return majorKeyCentersWeighted().map(([, ...chunks]) => {
    const weights = chunks.flatMap(([notes, weight]) => keyChunkWeights(notes, weight))
    return new Picker(weights.map(x => x[0]), { weights: weights }).pick() as Note
  }).map(n =>
    renderN(n)
  )
}

export function keys(): string[] {
  return shuffle(letterKeys())
}

// violin

export function scalePositions(): string[] {
  return zip(ss('1234567'), shuffle(ij('', perm(s('GDAE'), 2))), shuffleX('∏V', 4)).flat()
}

// The seven diatonic mode names, index 0 = ionian, matching modeShifts' mode
// field (0..6).
export const MODE_NAMES = 'ion dor phry lyd mix aeo loc'.split(' ')

export function modeName(mode: number): string {
  return MODE_NAMES[mode] ?? `mode${mode}`
}

type PickKeysInt = {
  count?: number,
  mode?: number,
  order?: number,
  div?: number,
  split?: number, // should control order/div
  shuffle?: boolean,
}

// Re-exported straight from the libs, and the small wrappers that give a
// library function its DSL name. The whole module is spread into the DSL
// context, so every export here is a name programs can call.
export { zipT, intersperse, interspersing, interleavingEvery, chunk, take, pairwiseDiffs, avgPairwiseDiff } from '../lib/Array'
export * as ExExample from './Exercise20260919Example'
export * as ExBowedTies from './ExerciseBowedTies'
export { chromaticSlide } from '../lib/ToneLibViolin'
export { shiftStrings, uniqueShiftsF as uniqueShifts } from '../lib/Combinatorics'
export { shiftsDistributed }
export { ToneLib, ToneLibViolin }

export const arrayRotate = arrayShift
export const uniq = _.uniq
export const desMS = deserializeModeShift

export function range(f: number, t: number): string[] {
  return directRange(f, t).map(n => `${n}`)
}

export function shifts(target?: number, inv?: number[]): string[] {
  return shiftFormat(shiftsLib(target, inv))
}

export function powerInnerBuckets<A>(a: A[]): A[][][] {
  return powerBuckets(a).slice(1, -1)
}

export function powerInner<A>(a: A[]): A[][] {
  return power(a).slice(1, -1)
}

export function frets(upTo?: number): string[] {
  return fretsLib(upTo).flat()
}

export function modeShifts(keyIn: Note | string, scales?: string): string[] {
  return modeShiftsLib(parseNote(keyIn)!, scales)
}

export function metroS(base: number, diff: number): string[] {
  return zipInterleave(...zipInterleave(...divide(divide(metro(base, diff), 6).map(shuffle), 3)))
}

export function metroHalves(base: number, diff: number): string[] {
  return metroS(base, diff).flatMap(x => shuffle([x, `${Number(x) / 2}`, x, `${Number(x) / 2}`]), 2)
}

// The `next` programme that walks a `metroHalves` list: one step per tempo, so
// the card advances exactly when that tempo has had its turn. Within each group
// of four the faster half gets `fast` clicks and the slower half `slow` — twice
// the clicks at twice the speed, so every tempo lasts the same wall time and a
// group is one even stretch however `metroHalves` shuffled it.
//
// The leading `1n` is the offset: a step fires *after* its clicks, so without a
// click to absorb the start the first ⏩ would land one tempo early and every
// step after it would describe the tempo before it.
export function nextHalves(metro: string[], slow = 4, fast = 8): string[] {
  return _.chunk(metro, 4).flatMap(group => {
    const slowest = Math.min(...group.map(Number))
    return group.map(x => `${Number(x) === slowest ? slow : fast}f`)
  })
}

export function forceSign(a: number): string {
  return a == 0 ? `${a}` : a > 0 ? `+${a}` : `${a}`
}

// Glob the images gathered into the state (threaded in via additionalContext,
// read from `context`). A pattern with `*`/`?` is treated as a glob over the
// whole filename; a plain pattern is a substring match. Returns the matching
// filenames (the image block resolves filenames back to URLs).
export function glob(pattern: string, images: ImageEntry[]): string[] {
  const names = images.map(([filename]) => filename)

  if (/[*?]/.test(pattern)) {
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    return names.filter(name => re.test(name))
  }

  const basenames = names
    .filter(name => name.includes(pattern))
    .map(name => {
      const m1 = name.match(/[^\/]+$/)
      if (!m1) return name

      const m2 = m1[0].match(/^([A-Z0-9]+(-[A-Z0-9]+)*)/i)
      if (!m2) return name

      return m2[1]
    })

  return directRange(1, 7).flatMap((length: number) => {
    const abbrevs = basenames.map(a => a.split('-').slice(0, length).join('-'))
    return _.uniq(abbrevs).length == basenames.length ? [abbrevs] : []
  })[0] || basenames
}

export function shiftsMD(serMS: string, invStr: string, distrib: string): string[] {
  const ms = deserializeModeShift(serMS)
  const [invDia, invChrom] = invStr.split(':').map(inv => [...(inv.match(/-?\d/g) || [])].map(item => parseInt(item)))
  const inv = ms.shifts < 16 ? invDia : invChrom

  return shiftsDistributed(ms.shifts, inv, distrib)
}

export function metro(base: number, diff: number): string[] {
  return directRange(base - diff, base + diff).map(s => `${s}`)

}

export function randomizeLangUtils(context: Map<string, any>, memory: Map<string, any>) {
  // Note: uses memory
  function pickTasksStateless<A extends RenderLine>(items: A[]): A[] {
    if (items.length == 0) return []

    const sorted = (_.sortBy(items, item => {
      const cards = cardMemory(memory)
      const otherwiseOrder = murmur.x86.hash32(item.contents)
      // c.l(`${item.key}.reviewed = ${(cards[item.key || '']?.reviewed || -otherwiseOrder)}`)
      return (cards[item.key || '']?.reviewed || -otherwiseOrder)
    }))

    return picksEarlyBias(sorted)
  }

  // state

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

  function pickLinesStateless(lines: RenderLine[], n: number | 'full'): RenderLine[] {
    return pickTasksStateless(lines).slice(0, n == 'full' ? 10000 : n)
  }

  function zipScheduleBlocks(sentence: string): RenderLine[] {
    return zipInterleave(...s(sentence).map(x => scheduleBlocks(x)))
  }

  // A token is `[prefix:]name[-count]`. The optional `prefix:` applies to that
  // token only, so `scheduleBlocks('pre:tasks-2 other-1')` prefixes the tasks
  // items and leaves `other`'s alone.
  function parseScheduleBlocksSentence(sentence: string): string | [string, number | 'full', string | null][] {
    let err

    const parsed = [...sentence.matchAll(/[^ ]+/g)].map(x => x[0]).map(s => {
      const match = s.match(/^(?:([a-z0-9-]+):)?([a-z0-9-]+?)(?:-(\d+|\*))?$/i)

      if (!match) err = "block name not found"
      if (!match![2]) err = "cannot parse block name"

      const count: number | 'full' = match![3] === undefined ? 'full' : parseInt(match![3] || '1', 10)

      return [match![2], count, match![1] ?? null] satisfies [string, number | 'full', string | null]
    })

    if (err) return `scheduleBlockks: ${err}`

    return parsed
  }

  // Prepend `prefix-` to a line's key and, in step, to its contents — so the
  // rendered text keeps matching LineKeyPattern and the key stays derivable
  // from what is shown. A keyless line only gets its contents prefixed.
  // `source.contents` is the pre-substitution template the re-roll path renders
  // from, so it is prefixed too: leaving it bare would make a re-rolled line
  // lose the prefix. Its markers are untouched, keeping the substitutions valid.
  function prefixRenderLine(prefix: string, rl: RenderLine): RenderLine {
    return {
      ...rl,
      contents: `${prefix}-${rl.contents}`,
      key: rl.key === null ? null : `${prefix}-${rl.key}`,
      source: rl.source === null
        ? null
        : { ...rl.source, contents: `${prefix}-${rl.source.contents}` },
    }
  }

  function scheduleBlocks(sentence: string): RenderLine[] {
    const parsed = parseScheduleBlocksSentence(sentence)
    if (typeof parsed == 'string') return [errorLine(parsed)]
    return parsed.flatMap(([name, amount, prefix]) => {
      const lines = blockLines(name)
      // Prefix before scheduling: reviews are recorded under the rendered
      // (prefixed) key, so the cards handed to the scheduler must carry it too.
      const cards = prefix === null ? lines : lines.map(rl => prefixRenderLine(prefix, rl))
      return pickLinesStateless(cards, amount)
    })
  }

  return {
    context,
    block,
    blockLines,
    scheduleBlocks,
    zipBlocksDiv,
    zipScheduleBlocks,
    pickTasksStateless,
    glob: (pattern: string) => glob(pattern, context.get('images') || []),
  }
}
