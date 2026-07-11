import { expect, test } from 'vitest'
// import { flashcardsDegrees } from './ToneLibFlashcards'
// import { flashcardsPosition } from './ToneLibFlashcards'
import { flashcardsNeighbors, flashcardsToCsv } from './ToneLibFlashcards'

test('vacuous', () => { expect(1).toBe(1) })

// uncomment, when export to anki needed
// test('flashcards degrees', () => {
//   console.log(flashcardsToCsv(flashcardsDegrees()).join('\n'))
// })

// uncomment, when export to anki needed
// test('flashcards position', () => {
//   console.log(flashcardsToCsv(flashcardsPosition()).join('\n'))
// })

// uncomment, when export to anki needed
// test('flashcards neighbors', () => {
//   console.log(flashcardsToCsv(flashcardsNeighbors()).join('\n'))
// })
