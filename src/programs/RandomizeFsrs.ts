import { Card, Rating, createEmptyCard, fsrs } from 'ts-fsrs'
import type { CardData } from './RandomizeTypes'

// Cards opted into FSRS (far → swipe) are scheduled by it. Its state isn't
// stored: it's replayed from the card's reviews since the opt-in, an accepted
// review rating Good and an unaccepted one Again. Learning steps are off, so
// same-day practice doesn't reset a card into minute-long intervals.
const scheduler = fsrs({ enable_short_term: false })

export function fsrsCard(card: CardData | undefined): Card | null {
  if (!card?.fsrs) return null
  const since = card.fsrs
  return (card.reviews || [])
    .filter(r => r.time >= since)
    .reduce<Card>((c, r) => scheduler.next(c, r.time, r.accepted ? Rating.Good : Rating.Again).card, createEmptyCard(since))
}

// When an FSRS card is next due (ms), or null for a card not using FSRS.
export function fsrsDue(card: CardData | undefined): number | null {
  return fsrsCard(card)?.due.getTime() ?? null
}

// An FSRS card that isn't due yet starts out done, like a banned one.
export function fsrsWaiting(card: CardData | undefined, now: number): boolean {
  const due = fsrsDue(card)
  return due !== null && due > now
}
