import { describe, expect, test } from 'vitest'
import { NextStep, nextStepsAction, nextStepsHalted, parseNextStep, parseNextSteps, renderNextStep, renderNextSteps, stepNext } from './RandomizeNext.ts'

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

  test('all four actions parse', () => {
    expect(parseNextSteps(['2f', '2r', '2n', '2s']).map(s => s.action)).toEqual(['f', 'r', 'n', 's'])
  })

  test('a fully spent halt round-trips through its rendered form', () => {
    expect(renderNextStep({ total: 4, spent: 4, action: 's' })).toBe('0:4s')
    expect(parseNextStep('0:4s')).toEqual({ total: 4, spent: 4, action: 's' })
  })

  test('a bare action is a one-click step, so `f` is `1f`', () => {
    expect(parseNextStep('f')).toEqual(parseNextStep('1f'))
    expect(parseNextSteps(['f', 'r', 'n', 's'])).toEqual([
      { total: 1, spent: 0, action: 'f' },
      { total: 1, spent: 0, action: 'r' },
      { total: 1, spent: 0, action: 'n' },
      { total: 1, spent: 0, action: 's' },
    ])
  })

  test('a bare step renders back as an explicit one, not as the bare letter', () => {
    expect(renderNextStep(parseNextStep('f')!)).toBe('1f')
  })

  test('a bare step fires on the very next click', () => {
    expect(run('f 2r', 1)).toEqual([['2r 1f', 'f']])
  })

  test('the halt may be written bare, which is the point of it', () => {
    expect(run('1f s', 3).map(([, a]) => a)).toEqual(['f', 's', '-'])
  })

  test('only the count may be dropped — a lone spent half has no reading', () => {
    expect(parseNextStep(':3f')).toBe(null)
    expect(parseNextStep(':f')).toBe(null)
  })

  test('junk and zero counts are dropped rather than counted', () => {
    expect(parseNextSteps(['4f', 'nonsense', '0f', '3x', ''])).toEqual([
      { total: 4, spent: 0, action: 'f' },
    ])
  })

  test('a value holding several steps is split on whitespace', () => {
    // a command may return whole phrases rather than one token per element
    expect(parseNextSteps(['1n 4f 8f'])).toEqual(parseNextSteps(['1n', '4f', '8f']))
    expect(parseNextSteps(['1n', '4f 8f'])).toEqual(parseNextSteps(['1n', '4f', '8f']))
    expect(parseNextSteps(['  2f   2r  '])).toEqual(parseNextSteps(['2f', '2r']))
  })

  test('splitting does not resurrect junk between the tokens', () => {
    expect(parseNextSteps(['4f nonsense 0f'])).toEqual([
      { total: 4, spent: 0, action: 'f' },
    ])
    expect(parseNextSteps([''])).toEqual([])
    expect(parseNextSteps(['   '])).toEqual([])
  })

  test('a spent step survives the split, so a stored programme round-trips', () => {
    expect(parseNextSteps(['1:3f 4r'])).toEqual(parseNextSteps(['1:3f', '4r']))
  })

  test('an explicit zero count is still rejected, bare letters notwithstanding', () => {
    expect(parseNextStep('0f')).toBe(null)
    expect(parseNextStep('0s')).toBe(null)
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

describe('halting on `s`', () => {
  test('the programme runs its steps, then parks on the halt for good', () => {
    expect(run('2f 2s', 6)).toEqual([
      ['1:1f 2s', '-'],
      ['2s 2f', 'f'],
      ['1:1s 2f', '-'],
      ['0:2s 2f', 's'],   // the halt is reached and fires once
      ['0:2s 2f', '-'],   // and from here every click is swallowed
      ['0:2s 2f', '-'],
    ])
  })

  test('a halted programme stays put no matter how long the metronome runs', () => {
    let steps = parseNextSteps(['1s', '4f'])
    for (let i = 0; i < 50; i++) steps = stepNext(steps)[0]
    expect(renderNextSteps(steps)).toEqual(['0:1s', '4f'])
  })

  test('without a halt the programme really does go forever', () => {
    expect(run('2f 2r', 100).filter(([, a]) => a !== '-').length).toBe(50)
  })

  test('a halt that is not at the head does not stop the steps before it', () => {
    expect(run('1f 1r 1s', 2).map(([, a]) => a)).toEqual(['f', 'r'])
  })

  test('rotating the halt away through the UI resumes the programme', () => {
    // The ⏩ on the `next` field itself rotates its contents — the parked `s`
    // goes to the back and the step behind it takes over.
    let steps = parseNextSteps(['1s', '2f'])
    steps = stepNext(steps)[0]
    expect(nextStepsHalted(steps)).toBe(true)

    const [parked, ...rest] = steps
    const resumed = [...rest, { ...parked, spent: 0 }]
    expect(nextStepsHalted(resumed)).toBe(false)
    expect(stepNext(stepNext(resumed)[0])[1]).toBe('f')
  })

  test('nothing is pending once parked, so no action fires on the beat', () => {
    const halted = parseNextSteps(['0:2s', '4f'])
    expect(nextStepsAction(halted)).toBe(null)
    expect(nextStepsHalted(halted)).toBe(true)
  })

  test('an unspent halt still announces itself on its last click', () => {
    expect(nextStepsAction(parseNextSteps(['1:1s']))).toBe('s')
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
