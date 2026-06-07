import { test } from 'vitest'
import { flashcardsCsv } from './ToneLibFlashcards'

test('flashcards', () => {
  console.log(flashcardsCsv().join('\n'))
})
