import { DIVISIONS } from '../lib/SheetNotation'

export type HeldNote = { note: string | null, duration: number, tied: boolean }

export type Rhythm = HeldNote[]

const BEAT = DIVISIONS

const SPELLINGS: Record<number, string> = {
  1: '16', 2: '8', 3: '8.', 4: '4', 6: '4.', 7: '4..', 8: '2', 12: '2.', 14: '2..', 16: '1',
}

const SIZES = Object.keys(SPELLINGS).map(Number).sort((a, b) => b - a)

export const subdivide = (rhythm: Rhythm, smallest: number): Rhythm =>
  rhythm.flatMap(({ note, duration, tied }) => {
    if (duration % smallest != 0) throw new Error(`${duration} does not divide into ${smallest}`)
    const n = duration / smallest
    return Array.from({ length: n }, (_, i) => ({
      note,
      duration: smallest,
      tied: i < n - 1 ? note != null : tied,
    }))
  })

export const rotate = (rhythm: Rhythm, by: number): Rhythm =>
  rhythm.map((_, i) => rhythm[(((i - by) % rhythm.length) + rhythm.length) % rhythm.length])

export const respell = (rhythm: Rhythm): Rhythm =>
  bind(rhythm).flatMap(({ note, duration, at }) =>
    split(at, duration).map((piece, i, pieces) => ({
      note,
      duration: piece,
      tied: note != null && i < pieces.length - 1,
    })))

type Bound = { note: string | null, duration: number, at: number }

const bind = (rhythm: Rhythm): Bound[] =>
  rhythm.reduce<Bound[]>((bound, held, i) => {
    const last = bound.at(-1)
    const joins = i > 0 && last?.note === held.note && (held.note == null || rhythm[i - 1].tied)

    return joins
      ? [...bound.slice(0, -1), { ...last, duration: last.duration + held.duration }]
      : [...bound, { note: held.note, duration: held.duration, at: (last?.at ?? 0) + (last?.duration ?? 0) }]
  }, [])

const split = (at: number, length: number): number[] => {
  if (length <= 0) return []

  const piece = longest(at, length)
  return [piece, ...split(at + piece, length - piece)]
}

const longest = (at: number, left: number): number => {
  const fits = at % BEAT == 0
    ? (d: number) => d <= left && (d % BEAT == 0 || d <= BEAT)
    : (d: number) => d <= Math.min(left, BEAT - (at % BEAT))

  return SIZES.find(fits) ?? Math.min(...SIZES)
}

export const spell = ({ note, duration, tied }: HeldNote): string =>
  `${note ?? 'r'}${SPELLINGS[duration]}${tied ? '~' : ''}`

export const render = (rhythm: Rhythm): string =>
  rhythm.map(spell).join(' ')
