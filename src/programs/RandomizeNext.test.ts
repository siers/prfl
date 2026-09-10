import { describe, expect, test } from 'vitest'
import { NextStep, nextStepsAction, parseNextStep, parseNextSteps, renderNextStep, renderNextSteps, stepNext } from './RandomizeNext.ts'

// Drive a programme for n clicks, collecting what it looks like after each and
// what it fired — the notation from the spec, `4f 4r` -> `3:1f 4r` -> ...
function run(src: string, clicks: number): [string, string][] {
  let steps = parseNextSteps(src.split(' '))
  const out: [string, string][] = []
  for (let i = 0; i < clicks; i++) {
    const [next, action] = stepNext(steps)
    steps = next
    out.push([renderNextSteps(steps).join(' '), action || '-'])
  }
  return out
}

describe('parsing steps', () => {
  test('a bare count and action starts unspent', () => {
    expect(parseNextStep('4f')).toEqual({ total: 4, spent: 0, action: 'f' })
  })

  test('the spent clicks ride in the value and round-trip', () => {
    expect(parseNextStep('1:3f')).toEqual({ total: 4, spent: 3, action: 'f' })
    expect(renderNextStep({ total: 4, spent: 3, action: 'f' })).toBe('1:3f')
  })

  test('an untouched step renders without the prefix', () => {
    expect(renderNextStep({ total: 4, spent: 0, action: 'r' })).toBe('4r')
  })

  test('all three actions parse', () => {
    expect(parseNextSteps(['2f', '2r', '2n']).map(s => s.action)).toEqual(['f', 'r', 'n'])
  })

  test('junk and zero counts are dropped rather than counted', () => {
    expect(parseNextSteps(['4f', 'nonsense', '0f', '3x', ''])).toEqual([
      { total: 4, spent: 0, action: 'f' },
    ])
  })
})

describe('stepping the programme', () => {
  test('the spec walk: 4f 4r counts down, fires at zero, and rotates', () => {
    expect(run('4f 4r', 4)).toEqual([
      ['3:1f 4r', '-'],
      ['2:2f 4r', '-'],
      ['1:3f 4r', '-'],
      ['4r 4f', 'f'],
    ])
  })

  test('the rotated step comes back refilled, so the cycle repeats', () => {
    expect(run('4f 4r', 8).at(-1)).toEqual(['4f 4r', 'r'])
  })

  test('a full programme cycles through its actions in order', () => {
    expect(run('1f 1r 1n', 3).map(([, a]) => a)).toEqual(['f', 'r', 'n'])
  })

  test('a one-click step fires immediately and never sits spent', () => {
    expect(run('1f 2r', 1)).toEqual([['2r 1f', 'f']])
  })

  test('a lone step keeps firing on its own period', () => {
    expect(run('2f', 4).map(([s, a]) => `${s}|${a}`)).toEqual([
      '1:1f|-', '2f|f', '1:1f|-', '2f|f',
    ])
  })

  test('an empty programme is inert', () => {
    expect(stepNext([])).toEqual([[], null])
  })
})

describe('reading the pending action off the state', () => {
  test('the last click of a step announces what it will fire', () => {
    const steps: NextStep[] = parseNextSteps(['1:3f', '4r'])
    expect(nextStepsAction(steps)).toBe('f')
  })

  test('mid-step there is nothing pending', () => {
    expect(nextStepsAction(parseNextSteps(['2:2f', '4r']))).toBe(null)
  })

  test('it agrees with what stepNext actually fires, click by click', () => {
    let steps = parseNextSteps(['3f', '2r', '1n'])
    for (let i = 0; i < 12; i++) {
      const predicted = nextStepsAction(steps)
      const [next, fired] = stepNext(steps)
      expect(predicted).toBe(fired)
      steps = next
    }
  })

  test('an empty programme announces nothing', () => {
    expect(nextStepsAction([])).toBe(null)
  })
})
