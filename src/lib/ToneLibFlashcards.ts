import _ from 'lodash'
import { renderN, addInterval, majorKey, parseNote, nameInterval, names, Note } from './ToneLib'
import { strings } from './ToneLibViolin'
import { transpose } from './Array'
import * as Comb from 'ts-combinatorics'

const c = majorKey(parseNote('c')!)!
const degrees = [1, 2, 3, 4, 5, 6, 7]
const intervals = [1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6]

type QA = [string, string]

export function flashcardsDegrees(): QA[] {
  return c.flatMap(note => {
    return intervals.flatMap(int => {
      const added = addInterval(note, int)
      const sign = int > 0 ? '+' : '-'
      const intName = nameInterval(int)
      const toDegree: (_: Note) => number = (n: Note) => names.indexOf(n.name) + 1

      const noteQuiz: QA = [
        `${renderN(note)} ${sign} ${intName} = `,
        `${renderN(added)}`
      ]

      const degreeQuiz: QA = [
        `${toDegree(note)} ${sign} ${intName}`,
        `${toDegree(added)}`,
      ]

      const combinedQuiz: QA[] = degrees.flatMap(degree => {
        const addedDeg = (degree + int + 6) % 7 + 1
        const based = addInterval(note, -degree + 1)

        const tonalityQuiz: QA[] = degree == 1 && int != 1 ? [] : [[
          `${renderN(note)}${degree} based =`,
          `${renderN(based)}`,
        ]]

        const combinedQuiz: QA = [
          `${renderN(note)}${degree} ${sign} ${intName} = `,
          `${renderN(added)}${addedDeg}`
        ]

        return tonalityQuiz.concat([combinedQuiz])
      })

      return [noteQuiz, degreeQuiz].concat(combinedQuiz)
    })
  })
}

export function flashcardsToCsv(cards: QA[]): string[] {
  return _.uniq(cards.map(([q, a]) => `${q},${a}`))
}

export function flashcardsNeighbors(): QA[] {
  const intervals = [1, -1, 4, -4]

  return names.flatMap(name => {
    const note = parseNote(name)!
    const neighborsFlat = intervals.flatMap(int => renderN(addInterval(note, int))).join('')

    return [...new Comb.Permutation(neighborsFlat)].map(neighbors =>
      [neighbors.join(''), renderN(note)] satisfies QA
    )
  })
}

export function flashcardsPosition(): QA[] {
  return transpose(strings.map(s => s.positions)).slice(0, 8).flatMap((positionFlat, index) => {
    return [...new Comb.Permutation(positionFlat)].map(position => {
      const notes = position.map(n => renderN(n)).join('')

      return [notes, `${index}`] satisfies QA
    })
  })
}

//

export function pad(str: string, size: number, padF: (_: string) => string): string {
  var s = str
  while (s.length < size) s = padF(s)
  return s
}

type ShiftSig = (dir: number, start: number, shift: number, interval: number, landing: number) => boolean

// to generate a reference sheet displayed in tests only
export function fingerShiftInterval(f: ShiftSig = (_a, _b, _c, _d, _e) => true): string[] {
  const intervalMap: Record<number, string> = {
    0: 'unison',
    1: 'second',
    2: 'third',
    3: 'fourth',
    4: 'fifth',
    5: 'sixth',
    6: 'seventh',
  }

  const qa = [1, -1].flatMap(direction => {
    return [1, 2, 3, 4].flatMap(start => {
      return [1, 2, 3, 4].flatMap(shift => {
        return [1, 2, 3, 4].flatMap(interval => {
          const landingOut = start + (interval - shift) * direction
          const landingReal = landingOut < 1 || landingOut > 4 ? 0 : landingOut
          const landingName = landingReal == 0 ? 'x' : landingReal
          const dir = direction > 0 ? '+' : '-'
          if (!f(direction, start, shift, interval, landingReal)) return []
          else return [`${start} ${dir} ${shift}s ${dir} ${pad(intervalMap[interval], 7, x => x + ' ')} = ${landingName}`]
        })
      })
    })
  })

  const all = qa.map((qa, idx) => `${pad(`${idx}:`, 4, s => s + ' ')} ${qa}`)

  return all
}

export function fingerShiftIntervalShort(): string[] {
  return fingerShiftInterval((_dir: number, _start: number, shift: number, interval: number, landing: number) => {
    if (landing == 0) return false
    if (shift == interval) return false
    return true
  })
}
