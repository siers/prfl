// The `next` tag: a substitution that drives the item forward off the metronome.
//
// `[4f 4f 4f 4r n]next` is a rotating programme of steps. Each entry is a count
// and an action: `4f` = "in four clicks, press ⏩". Every metronome click spends
// one click of the head entry; when the head is exhausted its action fires and
// the entry rotates to the back of the list, refilled. The actions are the two
// re-roll buttons the card already has, so the programme works one item — it
// never moves the cursor.
//
// The spent clicks ride along in the rendered value, so the card shows how far
// into the current step it is: `4f 4r` -> `3:1f 4r` -> `2:2f 4r` -> `1:3f 4r`
// -> `0:4f 4r`, and that last click fires and rotates to `4r 4f`.

import { Substitution } from './RandomizeLangTypes'

export const NEXT_TAG = 'next'

// 'f' is ⏩ — each field rotates to its next value; 'r' is 🔄 — the fields are
// re-rolled fresh; 'n' lets the clicks pass without touching the item.
export type NextAction = 'f' | 'r' | 'n'

export type NextStep = {
  total: number,   // clicks the step lasts
  spent: number,   // clicks already spent on it, 0 <= spent <= total
  action: NextAction,
}

// `4f` — four clicks, none spent. `1:3f` — one left of the four, three spent:
// the halves are remaining and spent, so the step's length is their sum, and
// the written `4f` stays readable as the countdown eats into it.
const STEP_PATTERN = /^(?:(\d+):)?(\d+)([frn])$/

export function parseNextStep(s: string): NextStep | null {
  const m = s.trim().match(STEP_PATTERN)
  if (!m) return null

  const spent = m[1] === undefined ? 0 : parseInt(m[2], 10)
  const remaining = m[1] === undefined ? parseInt(m[2], 10) : parseInt(m[1], 10)

  const total = spent + remaining
  if (total <= 0) return null

  return { total, spent, action: m[3] as NextAction }
}

// `3:1f` — remaining before the colon, spent after it. A step nothing has been
// spent on drops the prefix, so an untouched programme reads as it was written.
export function renderNextStep(s: NextStep): string {
  return s.spent === 0 ? `${s.total}${s.action}` : `${s.total - s.spent}:${s.spent}${s.action}`
}

export function parseNextSteps(contents: string[]): NextStep[] {
  return contents.flatMap(c => {
    const step = parseNextStep(c)
    return step ? [step] : []
  })
}

export function renderNextSteps(steps: NextStep[]): string[] {
  return steps.map(renderNextStep)
}

// One metronome click. The head step takes the click; if that spends it, its
// action fires and the step rotates to the back with its clicks given back.
// A step is never left sitting at spent == total, so the fire is on the click
// that reaches the count, not the one after it.
export function stepNext(steps: NextStep[]): [NextStep[], NextAction | null] {
  if (steps.length === 0) return [steps, null]

  const [head, ...rest] = steps
  const spent = head.spent + 1

  if (spent < head.total) return [[{ ...head, spent }, ...rest], null]

  return [[...rest, { ...head, spent: 0 }], head.action]
}

export function findNextSubstitution(substitutions: Substitution[] | undefined): Substitution | undefined {
  return (substitutions || []).find(s => s.tag === NEXT_TAG)
}

// The action this click will fire, read off the state the click belongs to: the
// head step is finished when one more click would exhaust it. Lets a caller
// that has only the rendered item (not the reducer's result) act on the beat.
export function nextStepsAction(steps: NextStep[]): NextAction | null {
  const head = steps[0]
  return head && head.spent + 1 >= head.total ? head.action : null
}

export function nextAction(item: { source?: { substitutions?: Substitution[] } | null } | undefined): NextAction | null {
  const subst = findNextSubstitution(item?.source?.substitutions)
  return subst ? nextStepsAction(parseNextSteps(subst.contents)) : null
}
