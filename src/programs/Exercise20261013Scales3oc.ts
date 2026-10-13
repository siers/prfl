import { card, fieldsOf, fixed, text } from './ExerciseCard'
import type { FieldGen } from './ExerciseCard'
import type { RenderLine } from './RandomizeLangTypes'
import { desMS, forceSignZero, metroS, modeShifts, range, s, shiftsMD, shuffle, ss, zipLongestShuf } from './RandomizeLangUtils'

// The S-3oc card: three-octave scales in a key, with a subdivision, a starting
// offset into it, a metronome and the shifts for the first mode.
//
// An explode, like `blockLines`: `{ExScales3oc.gen('S-3oc', keyz)}`.

export const fields = {
  div: () => s(`1 2 3 4 5 6 8 9 12`),
  offset: ({ div }) => shuffle(range(1, parseInt(div[0]))).map(o => forceSignZero(Number(o) - 1)),
  metro: () => metroS(42, 4),
  tempo: ({ div, metro }) => [`${Number(div[0].match(/\d+/)![0]) * Number(metro[0])}`],
  // Every scale, with and without an `R`, dealt over the key's seven modes.
  mode: ({ key }) => shuffle(modeShifts(key[0], zipLongestShuf(ss(`dia chr hm mm +1 -1 sub pos`), [``, `R`]).map(x => x.join('')).join(' '))),
  inv: () => s(`-421, -321, 1233-4, -1, -1-2`),
  shifts: ({ mode, inv }) => shiftsMD(mode[0], `${inv[0]}:1-2-34`, '011222233333'),
  additional: ({ mode }) => [desMS(mode[0]).additional || '-'],
} satisfies Record<string, FieldGen>

const field = fieldsOf('ExScales3oc.fields', fields)

export function gen(name: string, keys: string | string[]): RenderLine[] {
  return [card(name, [
    fixed('key:freeze:inline', typeof keys === 'string' ? [keys] : keys),
    field('div:show-1:inline:nonrotated'),
    field('offset:show-1:computed:inline'),
    field('metro:show-1:inline'),
    text('/'),
    field('tempo:computed:inline'),
    field('mode:cut-semi:maxlen-80:show-4'),
    field('inv:inline:show-1:nonrotated'),
    field('shifts:computed:show-1:inline'),
    field('additional:computed'),
  ])]
}
