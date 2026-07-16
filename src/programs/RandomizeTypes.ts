import { Timer } from './Timers.ts'
import { RenderLine } from './RandomizeLangTypes.js'

type UserItemData = {
  timer?: Timer,
  done?: boolean,
  dropped?: number,
}

export type UserItem = RenderLine & UserItemData

export const toUserItem: (rl: RenderLine) => UserItem = rl => ({ ...rl, timer: undefined })

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
