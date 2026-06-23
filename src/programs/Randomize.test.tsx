// Full component-render acceptance test for Randomize.
//
// Randomize is a closure-heavy React component, so the real logic (the
// [deck, index] cursor: seek/bury/star, done-skipping) is only observable by
// rendering it and clicking. We mount it inside a tiny host that mirrors
// App.jsx's prop shape (state held in useState, a React-style setState, an
// advanceRef), drive it through the DOM, and assert the *rendered* current item
// changes — not internals.
//
// Randomize shuffles item order on eval; a leading "-=-" header opts a block
// out of shuffling, so the rendered order equals the typed order. We use that
// to keep the cursor assertions deterministic and readable.
//
// Sanitized side-effects (so assertions are deterministic):
//   * Date.now()  — frozen, so timers never advance the rendered state.
//   * setInterval — the timer loop writes innerHTML out-of-band; fake timers
//     keep it from firing during assertions. We never assert on timer text.
//   * SheetOSMD    — only mounts for keys matching /DS$/; our plain-text items
//     never trigger it, but we stub it anyway as a guard.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useRef, useState } from 'react'

vi.mock('./SheetOSMD.tsx', () => ({ default: () => null }))

import Randomize from './Randomize.tsx'

// A faithful stand-in for App.jsx's host: owns the program state, hands
// Randomize the same { state, setState, advanceRef } it gets in production.
function Host() {
  const [state, setState] = useState<any>(undefined)
  const advanceRef = useRef<any>(null)
  return <Randomize state={state} setState={setState} advanceRef={advanceRef} />
}

// The enlarged current item is the one Randomize styles at font-size 2rem
// (itemStyle: `index == currentIndex`). That's our cursor probe.
function currentItemText(container: HTMLElement): string | null {
  const el = container.querySelector('div[style*="font-size: 2rem"]')
  return el ? el.textContent : null
}

// The items currently on screen, in rendered order (prev / current / next…).
function renderedItems(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.text-wrap')].map(d => d.textContent || '')
}

// "-=-" header => not shuffled, so rendered order == this order.
const THREE_LINES = '-=-\nalpha\nbravo\ncharlie'

// Type text into the planning editor's first textarea — the real eval path
// (recalc({ contents, eval: true })) — then flip into execution via ▶️.
function setupExecuting(text: string) {
  const utils = render(<Host />)
  const editor = utils.container.querySelector('textarea') as HTMLTextAreaElement
  act(() => { fireEvent.change(editor, { target: { value: text } }) })
  // ▶️ is the first control link; it toggles execute and starts the timer.
  act(() => { fireEvent.click(utils.getByText('▶️')) })
  return utils
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-24T00:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Randomize — render + interaction', () => {
  test('mounts in planning and shows the editor', () => {
    const { container } = render(<Host />)
    // two textareas: source + rendered preview
    expect(container.querySelectorAll('textarea').length).toBe(2)
  })

  test('evaluating text then entering execution puts the cursor on the first item', () => {
    const { container } = setupExecuting(THREE_LINES)
    expect(renderedItems(container)).toStrictEqual(['alpha', 'bravo', 'charlie'])
    expect(currentItemText(container)).toBe('alpha')
  })

  test('➡️ advances the cursor to the next item, ⬅️ goes back', () => {
    const { container, getByText } = setupExecuting(THREE_LINES)
    expect(currentItemText(container)).toBe('alpha')

    act(() => { fireEvent.click(getByText('➡️')) })
    expect(currentItemText(container)).toBe('bravo')

    act(() => { fireEvent.click(getByText('➡️')) })
    expect(currentItemText(container)).toBe('charlie')

    act(() => { fireEvent.click(getByText('⬅️')) })
    expect(currentItemText(container)).toBe('bravo')
  })

  test('✅ completes the current item, hides it, and advances off it', () => {
    const { container, getByText } = setupExecuting(THREE_LINES)
    expect(currentItemText(container)).toBe('alpha')

    // ✅ = recalc({ item: { reviewed: true, done: true } }); with hideDone on,
    // the done item is excluded, so the cursor seeks forward off it and the
    // completed item drops out of the visible list.
    act(() => { fireEvent.click(getByText('✅')) })

    expect(currentItemText(container)).toBe('bravo') // moved to the next one
    expect(renderedItems(container)).not.toContain('alpha') // 'alpha' now hidden
  })
})

describe('Randomize — spawn buttons', () => {
  // An interpolable line with two multi-value params -> spawnable.
  const SPAWNABLE = "-=-\nScale: play [s('C,D')]key [s('up,down')]bow"

  test('a plain item shows no spawn buttons', () => {
    const { queryByText } = setupExecuting(THREE_LINES)
    expect(queryByText('⛓️')).toBeNull()
    expect(queryByText('🧬')).toBeNull()
  })

  test('a spawnable current item shows both spawn buttons', () => {
    const { getByText } = setupExecuting(SPAWNABLE)
    expect(getByText('⛓️')).toBeTruthy() // zip
    expect(getByText('🧬')).toBeTruthy() // cartesian
  })

  test('⛓️ descends into the zipped deck (position-aligned children)', () => {
    const { container, getByText } = setupExecuting(SPAWNABLE)
    act(() => { fireEvent.click(getByText('⛓️')) })
    // zip of [C,D]×[up,down] -> 2 children; cursor lands on the first
    expect(currentItemText(container)).toBe('Scale: play [C] [up]')
    expect(renderedItems(container)).toStrictEqual(['Scale: play [C] [up]', 'Scale: play [D] [down]'])
  })

  test('🧬 descends into the cartesian deck (cursor on the first combination)', () => {
    const { container, getByText } = setupExecuting(SPAWNABLE)
    act(() => { fireEvent.click(getByText('🧬')) })
    // The execution view only renders a window around the cursor (not all 4
    // children — that full count is covered in the reducer test). After
    // descending, the cursor sits on the first combination and the window
    // begins there.
    expect(currentItemText(container)).toBe('Scale: play [C] [up]')
    expect(renderedItems(container).slice(0, 2)).toStrictEqual([
      'Scale: play [C] [up]', 'Scale: play [C] [down]',
    ])
  })
})
