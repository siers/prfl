import { Timer } from './Timers.ts'
import { RenderLine } from './RandomizeLangTypes.js'

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

// think flashcards
export type CardData = {
  reviewed?: number, // Date.now()
  bpm?: number,
}

export function cardMemory(memory: any): Record<string, CardData> {
  return (memory.get('cards') as Record<string, CardData>) || {}
}

export function cardSet(memory: any, key: string, settings: { reviewed?: number, bpm?: number }) {
  const cards = cardMemory(memory)
  cards[key] = {
    ...cards[key],
    ...(settings.reviewed ? { reviewed: settings.reviewed } : {}),
    ...(settings.bpm ? { bpm: settings.bpm } : {}),
  }
  memory.set('cards', cards)
}

export function findCard(memory: any, key: string): CardData | null {
  return cardMemory(memory)[key]
}
