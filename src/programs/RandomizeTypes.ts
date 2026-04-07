import { Timer } from './Timers.ts'
import { RenderLine } from './RandomizeLangTypes.js'

type UserItemData = {
  timer: Timer | null
  done?: boolean,
}

export type UserItem = RenderLine & UserItemData

export const toUserItem: (rl: RenderLine) => UserItem = rl => ({ ...rl, timer: null })

// think flashcards
export type CardData = {
  reviewed?: number, // Date.now()
}

export function cardMemory(memory: any): Record<string, CardData> {
  return memory.get('cards') as Record<string, CardData>
}

export function cardReviewed(memory: any, key: string, now: number) {
  const cards = cardMemory(memory) || {}
  cards[key] = { ...cards[key], reviewed: now, }
  memory.set('cards', cards)
}
