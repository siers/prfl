import { describe, expect, test } from 'vitest'
import { Direction } from './LinearSeek.ts'
import { Exclude } from './GenericList.ts'
import {
  Decks, DeckCursor, DEFAULT_DECK,
  cursorEq, decksOf, deckItems, deckGet,
  deckSeek, deckDropThree, deckToTop, deckSetCurrent, deckVisible,
} from './Decks.ts'

const { Forward, Backward } = Direction

// Opaque items with their own skip flag; exclusion is the caller's business.
type Word = { v: string, skip?: boolean }
const w = (s: string): Word => ({ v: s })
const exclude: Exclude<Word> = i => i.skip === true

// A two-deck bag: the cursor's deck plus an untouched sibling, to prove
// operations never reach across decks.
function bag(main: string[]): Decks<Word> {
  return { [DEFAULT_DECK]: main.map(w), other: [w('x'), w('y')] }
}
const labels = (d: Decks<Word>, deck = DEFAULT_DECK) => deckItems(d, deck).map(i => i.v)

test('cursorEq is structural equality on [deck, index]', () => {
  expect(cursorEq([DEFAULT_DECK, 1], [DEFAULT_DECK, 1])).toBe(true)
  expect(cursorEq([DEFAULT_DECK, 1], [DEFAULT_DECK, 2])).toBe(false)
  expect(cursorEq([DEFAULT_DECK, 0], ['other', 0])).toBe(false)
})

test('decksOf wraps a flat list as the default deck', () => {
  expect(decksOf(['a', 'b'])).toStrictEqual({ [DEFAULT_DECK]: ['a', 'b'] })
  expect(decksOf(['a'], 'k')).toStrictEqual({ k: ['a'] })
})

test('deckGet looks up the cursor item, undefined when out of range', () => {
  const d = bag(['a', 'b', 'c'])
  expect(deckGet(d, [DEFAULT_DECK, 1])?.v).toBe('b')
  expect(deckGet(d, [DEFAULT_DECK, 9])).toBeUndefined()
  expect(deckGet(d, ['missing', 0])).toBeUndefined()
  expect(deckGet(d, undefined)).toBeUndefined()
})

describe('operations are deck-local — the deck name rides along, siblings untouched', () => {
  test('deckSeek moves the index within the cursor deck', () => {
    const d = bag(['a', 'b', 'c'])
    const [decks, cursor] = deckSeek(d, [DEFAULT_DECK, 0], Forward, exclude)
    expect(cursor).toStrictEqual([DEFAULT_DECK, 1])
    expect(labels(decks, 'other')).toStrictEqual(['x', 'y']) // sibling intact
    const [, back] = deckSeek(decks, cursor, Backward, exclude)
    expect(back).toStrictEqual([DEFAULT_DECK, 0])
  })

  test('deckDropThree buries within the deck, preserving the deck name', () => {
    const d = bag(['a', 'b', 'c', 'd', 'e'])
    const [decks, cursor] = deckDropThree(d, [DEFAULT_DECK, 0], exclude)
    expect(labels(decks)).toStrictEqual(['b', 'c', 'd', 'a', 'e'])
    expect(cursor[0]).toBe(DEFAULT_DECK)
    expect(labels(decks, 'other')).toStrictEqual(['x', 'y'])
  })

  test('deckToTop moves the current item to the front of its deck', () => {
    const d = bag(['a', 'b', 'c'])
    const [decks, cursor] = deckToTop(d, [DEFAULT_DECK, 2])
    expect(labels(decks)).toStrictEqual(['c', 'a', 'b'])
    expect(cursor).toStrictEqual([DEFAULT_DECK, 0])
  })

  test('deckSetCurrent jumps within the same deck', () => {
    const d = bag(['a', 'b', 'c', 'd'])
    const [, cursor] = deckSetCurrent(d, [DEFAULT_DECK, 0], 2, exclude)
    expect(cursor).toStrictEqual([DEFAULT_DECK, 2])
  })
})

test('deckVisible lists the cursor deck non-excluded items with their indices', () => {
  const d: Decks<Word> = { [DEFAULT_DECK]: [w('a'), { v: 'b', skip: true }, w('c')] }
  const cursor: DeckCursor = [DEFAULT_DECK, 0]
  expect(deckVisible(d, cursor, exclude).map(([i, ix]) => [i.v, ix])).toStrictEqual([['a', 0], ['c', 2]])
})
