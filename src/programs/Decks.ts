import { Direction } from './LinearSeek.ts'
import { ListState, Exclude, seek, setCurrent, dropThree, toTop, visible } from './GenericList.ts'

// A deck layer on top of GenericList's single-list model. `Decks<A>` is a bag of
// named lists; `DeckCursor` = [deckName, index] points at one item in one deck.
//
// Items never travel between decks: every operation here is deck-local. The
// deck name on the cursor is preserved across seek/dropThree/toTop — those only
// move the index within the cursor's own deck, delegating to the ListState
// primitives in GenericList. Moving to another deck is an explicit re-key, not
// a side effect of seeking.

export type Decks<A> = Record<string, A[]>

export type DeckCursor = [string, number]

export const DEFAULT_DECK = 'default'

// current == current — structural equality on the cursor pair.
export function cursorEq(a: DeckCursor, b: DeckCursor): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

// Wrap a flat list as the sole "default" deck — "make items the entries of a
// deck named default".
export function decksOf<A>(items: A[], deck: string = DEFAULT_DECK): Decks<A> {
  return { [deck]: items }
}

export function deckItems<A>(decks: Decks<A>, deck: string): A[] {
  return decks[deck] || []
}

// get(current) — look up the item the cursor points at, or undefined if the
// deck or index is gone.
export function deckGet<A>(decks: Decks<A>, [deck, index]: DeckCursor): A | undefined {
  return deckItems(decks, deck)[index]
}

// Lift the cursor's deck into a ListState so a single-list op can run on it,
// then fold the (possibly reordered) deck and resolved index back in. The deck
// name rides along unchanged.
function onDeck<A>(
  decks: Decks<A>,
  [deck, index]: DeckCursor,
  f: (list: ListState<A>) => ListState<A>,
): [Decks<A>, DeckCursor] {
  const next = f({ items: deckItems(decks, deck), current: index })
  return [{ ...decks, [deck]: next.items }, [deck, next.current]]
}

// linearSeek support, deck-local.
export function deckSeek<A>(decks: Decks<A>, cursor: DeckCursor, direction: Direction, exclude: Exclude<A>): [Decks<A>, DeckCursor] {
  return onDeck(decks, cursor, list => seek(list, direction, exclude))
}

// current + 3 within the deck (and the arrayMove it implies) — both deck-local.
export function deckDropThree<A>(decks: Decks<A>, cursor: DeckCursor, exclude: Exclude<A>): [Decks<A>, DeckCursor] {
  return onDeck(decks, cursor, list => dropThree(list, exclude))
}

// arrayMove to the front, deck-local.
export function deckToTop<A>(decks: Decks<A>, cursor: DeckCursor): [Decks<A>, DeckCursor] {
  return onDeck(decks, cursor, list => toTop(list))
}

// Jump to an index within the *same* deck (items don't travel between decks).
export function deckSetCurrent<A>(decks: Decks<A>, [deck]: DeckCursor, index: number, exclude: Exclude<A>): [Decks<A>, DeckCursor] {
  return onDeck(decks, [deck, index], list => setCurrent(list, index, exclude))
}

// The visible items of the cursor's deck, paired with their in-deck indices.
export function deckVisible<A>(decks: Decks<A>, [deck]: DeckCursor, exclude: Exclude<A>): [A, number][] {
  return visible({ items: deckItems(decks, deck), current: 0 }, exclude)
}
