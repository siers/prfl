import { chunk, take } from '../lib/Array'
import { shuffleArray } from '../lib/Random'

export type Bowing = 'n' | 'v'

type Hit = { duration: number, ghost: boolean, pause?: boolean }

const BOWINGS: Bowing[] = ['n', 'v']

const c = (duration: number): Hit => ({ duration, ghost: false })
const x = (duration: number): Hit => ({ duration, ghost: true })
const pause: Hit = { duration: 4, ghost: false, pause: true }

const BEATS: Hit[][] = [
  [c(8), c(8)], [c(8), x(8)], [x(8), c(8)], [x(8), x(8)],
  [c(4)], [c(4)], [x(4)], [x(4)],
  [pause], [pause],
]

const BEATS_PER_BAR = 4

const LENGTH = 8

const spell = (hit: Hit, bow: Bowing | null): string =>
  hit.pause ? `r${hit.duration}` : `c${hit.duration}${bow ?? ''}${hit.ghost ? '[x]' : ''}`

const bowed = (hits: Hit[], bowings: Bowing[] = BOWINGS): string[] =>
  hits.reduce<[string[], number]>(([out, i], hit) =>
    hit.pause
      ? [[...out, spell(hit, null)], i]
      : [[...out, spell(hit, bowings[i % bowings.length])], i + 1],
  [[], 0])[0]

export const gen = (beats: Hit[][] = BEATS, length: number = LENGTH): string => {
  const bars = chunk(take(length, shuffleArray(beats)), BEATS_PER_BAR).map(bar => bar.flat())
  const line = bowed(bars.flat())

  return bars
    .reduce<[string[], number]>(([out, from], bar) =>
      [[...out, line.slice(from, from + bar.length).join(' ')], from + bar.length], [[], 0])[0]
    .join(' | ')
}
