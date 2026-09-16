import { describe, expect, test } from 'vitest'
import { bindRuns, randomSlots, renderSlots, rotationExercise, rotations, splitRun, SLOTS } from './Exercies'
import { parseSheet, DIVISIONS } from '../lib/SheetNotation'
import { toneEvents } from './Synth'

// Sixteenths a written token is worth, for checking that a bar adds up.
const lengths: Record<string, number> = {
  '16': 1, '8': 2, '8.': 3, '4': 4, '4.': 6, '4..': 7, '2': 8, '2.': 12, '2..': 14, '1': 16,
}

const written = (sheet: string) =>
  sheet.split(' ').map(t => lengths[t.replace(/^[a-gr]/, '').replace('~', '')])

// Where each written note starts, in sixteenths from the bar line.
function positions(sheet: string): [number, number][] {
  let at = 0
  return written(sheet).map(d => { const p: [number, number] = [at, d]; at += d; return p })
}

describe('splitRun', () => {
  test('a length that is one symbol stays one piece', () => {
    expect(splitRun(0, 4)).toStrictEqual([4])
    expect(splitRun(0, 16)).toStrictEqual([16])
    expect(splitRun(2, 2)).toStrictEqual([2])
  })

  test('a length no symbol spells is split', () => {
    // Five sixteenths: a quarter plus a sixteenth, and there is no other way.
    expect(splitRun(0, 5)).toStrictEqual([4, 1])
    expect(written(renderSlots([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))[0]).toBe(4)
  })

  test('pieces always add back up to the run', () => {
    for (let start = 0; start < SLOTS; start++)
      for (let length = 1; start + length <= SLOTS; length++)
        expect(splitRun(start, length).reduce((a, b) => a + b, 0)).toBe(length)
  })

  test('no piece crosses a beat unless it starts on one and fills whole beats', () => {
    for (let start = 0; start < SLOTS; start++) {
      for (let length = 1; start + length <= SLOTS; length++) {
        let at = start
        for (const piece of splitRun(start, length)) {
          const crosses = Math.floor(at / 4) != Math.floor((at + piece - 1) / 4)
          if (crosses) expect([at % 4, piece]).toStrictEqual([0, piece])
          if (crosses) expect([4, 8, 12, 16]).toContain(piece)
          at += piece
        }
      }
    }
  })
})

describe('bindRuns', () => {
  test('adjacent equal slots become one run', () => {
    expect(bindRuns([1, 1, 1, 0, 0, 1])).toStrictEqual([
      { on: true, length: 3 }, { on: false, length: 2 }, { on: true, length: 1 },
    ])
  })

  test('run lengths cover every slot', () => {
    const slots = randomSlots()
    expect(bindRuns(slots).reduce((a, r) => a + r.length, 0)).toBe(SLOTS)
  })
})

describe('renderSlots', () => {
  test('bound sixteenths become one held note, not repeated ones', () => {
    expect(renderSlots([1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe('c4 r2.')
  })

  test('a run no symbol spells is written as tied pieces', () => {
    // Five on-slots: `c4~ c16` — one note held five sixteenths.
    expect(renderSlots([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe('c4~ c16 r8. r2')
  })

  test('rests are never tied', () => {
    expect(renderSlots([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).not.toMatch(/r[0-9.]+~/)
  })

  test('the pitch is the one asked for', () => {
    expect(renderSlots(Array(SLOTS).fill(1), 'd')).toBe('d1')
  })

  test('degenerate phrases still fill the bar', () => {
    expect(renderSlots(Array(SLOTS).fill(1))).toBe('c1')
    expect(renderSlots(Array(SLOTS).fill(0))).toBe('r1')
  })
})

describe('rotations', () => {
  test('there is one rotation per slot, and the first is the phrase itself', () => {
    const slots = [1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1]
    const all = rotations(slots)

    expect(all.length).toBe(SLOTS)
    expect(all[0]).toStrictEqual(slots)
  })

  test('every rotation is the phrase read from a different starting point', () => {
    const slots = randomSlots()
    const joined = slots.join('')

    rotations(slots).forEach((rot, k) =>
      expect(rot.join('')).toBe(joined.slice(k) + joined.slice(0, k)))
  })
})

describe('rotationExercise', () => {
  test('every bar is exactly 4/4', () => {
    for (let trial = 0; trial < 200; trial++)
      for (const { sheet } of rotationExercise())
        expect(written(sheet).reduce((a, b) => a + b, 0)).toBe(DIVISIONS * 4)
  })

  test('every bar parses, as one measure and without complaint', () => {
    for (const { sheet } of rotationExercise()) {
      const { measures, errors } = parseSheet(sheet)
      expect(errors).toStrictEqual([])
      expect(measures.length).toBe(1)
    }
  })

  test('the beat is legible in every bar', () => {
    for (let trial = 0; trial < 200; trial++) {
      for (const { sheet } of rotationExercise()) {
        for (const [at, d] of positions(sheet)) {
          if (Math.floor(at / 4) != Math.floor((at + d - 1) / 4)) {
            expect(at % 4).toBe(0)
            expect([4, 8, 12, 16]).toContain(d)
          }
        }
      }
    }
  })

  test('the grid and the notation describe the same rhythm', () => {
    for (const { grid, sheet } of rotationExercise()) {
      // Attacks: where an on-run starts in the grid, and where a note that is not a
      // tied continuation starts in the notation.
      const fromGrid = [...grid].flatMap((slot, i) =>
        slot == '1' && grid[(i + SLOTS - 1) % SLOTS] != '1' || slot == '1' && i == 0 ? [i] : [])

      let at = 0
      const fromSheet: number[] = []
      let continuing = false
      for (const token of sheet.split(' ')) {
        const d = lengths[token.replace(/^[a-gr]/, '').replace('~', '')]
        if (!token.startsWith('r') && !continuing) fromSheet.push(at)
        continuing = token.endsWith('~')
        at += d
      }

      expect(fromSheet).toStrictEqual(fromGrid.filter(i => grid[i] == '1'))
    }
  })

  test('a tied run sounds as one sustained note', () => {
    // Five on-slots then silence: one attack, held five sixteenths — 1.25 quarters.
    const [events] = toneEvents(parseSheet(renderSlots(
      [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).measures.flat())

    expect(events.length).toBe(1)
    expect(events[0].duration).toBe(5 / DIVISIONS)
  })

  test('the on:off ratio is roughly as asked', () => {
    // 3:1 over many bars: ~75% on. Loose bounds — this is a random draw, not a quota.
    const slots = Array.from({ length: 400 }, () => randomSlots(3, 1)).flat()
    const on = slots.filter(s => s == 1).length / slots.length

    expect(on).toBeGreaterThan(0.68)
    expect(on).toBeLessThan(0.82)
  })
})
