import { Timer } from './Timers.ts'
import { RenderLine } from './RandomizeLangTypes.js'
import { fsrsWaiting } from './RandomizeFsrs'

type UserItemData = {
  timer?: Timer,
  done?: boolean,
  dropped?: number,
}

// A deck entry: a pointer to its line by key, plus the progress made on it.
// The line itself lives once in `Lines`, so refreshing it shows everywhere the
// key is listed.
export type ItemRef = { key: string } & UserItemData

export type Lines = Record<string, RenderLine>

// An item resolved for reading: its line with the progress on top.
export type UserItem = RenderLine & UserItemData

export const toUserItem: (rl: RenderLine) => UserItem = rl => ({ ...rl, timer: undefined })

export function toItemRef(item: UserItem): ItemRef {
  const { key, timer, done, dropped } = item
  return { key: key!, timer, done, dropped }
}

export function resolveItem(lines: Lines, ref: ItemRef): UserItem {
  const { key, ...progress } = ref
  const line = lines[key] ?? { kind: 'renderline', contents: `error: no line for key ${key}`, key, separator: null, source: null }
  return { ...line, ...progress }
}

// A ✅ is an accepted review; leaving a card unreviewed after a long time on
// it is an unaccepted one.
export type Review = {
  time: number, // Date.now()
  length: number, // ms on the item's timer
  accepted: boolean,
}

// think flashcards
export type CardData = {
  reviewed?: number, // Date.now()
  bpm?: number,
  banned?: boolean, // starts out done wherever it shows up again
  reviews?: Review[], // oldest first
  fsrs?: number, // Date.now() of the opt-in: scheduled by FSRS from then on
}

export function cardMemory(memory: any): Record<string, CardData> {
  return (memory.get('cards') as Record<string, CardData>) || {}
}

// `review` is appended to the card's reviews.
export function cardSet(memory: any, key: string, settings: { reviewed?: number, bpm?: number, banned?: boolean, review?: Review, fsrs?: number }) {
  const cards = cardMemory(memory)
  // Unbanning drops the flag instead of storing `banned: false`.
  const { banned, ...card } = { ...cards[key], ...(settings.banned !== undefined && { banned: settings.banned }) }
  cards[key] = {
    ...card,
    ...(banned && { banned }),
    ...(settings.reviewed ? { reviewed: settings.reviewed } : {}),
    ...(settings.bpm ? { bpm: settings.bpm } : {}),
    ...(settings.review ? { reviews: [...(card.reviews || []), settings.review] } : {}),
    ...(settings.fsrs && !card.fsrs ? { fsrs: settings.fsrs } : {}),
  }
  memory.set('cards', cards)
}

export function findCard(memory: any, key: string): CardData | null {
  return cardMemory(memory)[key]
}

// Banned cards come back already done, and so do FSRS cards not due yet.
export function markStartsDone(memory: any, refs: ItemRef[], now: number = Date.now()): ItemRef[] {
  const cards = cardMemory(memory)
  return refs.map(ref => cards[ref.key]?.banned || fsrsWaiting(cards[ref.key], now) ? { ...ref, done: true } : ref)
}
