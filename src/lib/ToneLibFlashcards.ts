import _ from 'lodash'
import { render, addInterval, majorKey, parseNote, nameInterval, names, Note } from './ToneLib'

const c = majorKey(parseNote('c')!)!
const degrees = [1, 2, 3, 4, 5, 6, 7]
const intervals = [1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6]

type QA = [string, string]

export function flashcards(): QA[] {
  return c.flatMap(note => {
    return intervals.flatMap(int => {
      const added = addInterval(note, int)
      const sign = int > 0 ? '+' : '-'
      const intName = nameInterval(int)
      const toDegree: (_: Note) => number = (n: Note) => names.indexOf(n.name) + 1

      const noteQuiz: QA = [
        `${render(note, false)} ${sign} ${intName} = `,
        `${render(added, false)}`
      ]

      const degreeQuiz: QA = [
        `${toDegree(note)} ${sign} ${intName}`,
        `${toDegree(added)}`,
      ]

      const combinedQuiz: QA[] = degrees.flatMap(degree => {
        const addedDeg = (degree + int + 6) % 7 + 1
        const based = addInterval(note, -degree + 1)

        const tonalityQuiz: QA[] = degree == 1 && int != 1 ? [] : [[
          `${render(note, false)}${degree} based =`,
          `${render(based, false)}`,
        ]]

        const combinedQuiz: QA = [
          `${render(note, false)}${degree} ${sign} ${intName} = `,
          `${render(added, false)}${addedDeg}`
        ]

        return tonalityQuiz.concat([combinedQuiz])
      })

      return [noteQuiz, degreeQuiz].concat(combinedQuiz)
    })
  })
}

export function flashcardsCsv(): string[] {
  return _.uniq(flashcards().map(([q, a]) => `${q},${a}`))
}
