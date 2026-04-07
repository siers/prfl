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
