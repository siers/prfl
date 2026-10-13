import _ from 'lodash'
import { interpolateSubtToString } from './RandomizeLang'
import { defaultMarker, interpolableLine, interpolate, isComputed, isFrozen, renderLine, substitution } from './RandomizeLangTypes'
import type { Interpolate, InterpolateSubstT, RenderLine, Substitution } from './RandomizeLangTypes'

// Builds a card straight from TypeScript values: the same `RenderLine` the
// parser makes from `Key: [cmd]name:tag:tag …`, so every field stays
// rotatable and re-rollable in the UI.
//
// A 🔄 or a rotation re-derives a field by running its command in the DSL, so
// each field's command calls back into the exported function that produced its
// values, e.g. `ExScales3oc.fields.offset(fields)`.

export type Fields = Record<string, InterpolateSubstT>

// The values a field offers, given the fields resolved before it.
export type FieldGen = (fields: Fields) => InterpolateSubstT

type FieldPart = { kind: 'field', spec: string, values: FieldGen, command: string }
type TextPart = { kind: 'text', text: string }
export type Part = FieldPart | TextPart

export const text = (text: string): TextPart => ({ kind: 'text', text })

// A field whose values are given, not derived: a 🔄 re-runs the literal.
export const fixed = (spec: string, values: InterpolateSubstT): FieldPart =>
  ({ kind: 'field', spec, values: () => values, command: JSON.stringify(values) })

// Fields named after the generators that make them. `path` is where the DSL
// reaches `gens`, so the command can call the generator again.
export const fieldsOf = <G extends Record<string, FieldGen>>(path: string, gens: G) =>
  (spec: `${keyof G & string}${'' | `:${string}`}`): FieldPart => {
    const name = spec.split(':')[0]
    return { kind: 'field', spec, values: gens[name], command: `${path}.${name}(fields)` }
  }

// `spec` is what follows `[…]` in a card: `name:tag:tag`. An empty name gets
// `tagN`, as the parser names it.
function parseSpec(spec: string, idx: number): [string, string[] | null] {
  const [name, ...tags] = spec.split(':')
  return [name || `tag${idx + 1}`, tags.length > 0 ? tags : null]
}

// Resolves like the parser: `freeze` first, then the rest in written order,
// `computed` last, each seeing the fields resolved before it.
export function card(key: string, parts: Part[]): RenderLine {
  const fieldParts = parts.filter((p): p is FieldPart => p.kind == 'field')

  const interpols: Interpolate[] = fieldParts.map((p, idx) =>
    interpolate(p.command, `${defaultMarker}${idx + 1}`, ...parseSpec(p.spec, idx)))

  const tier = (i: Interpolate) => isFrozen(i) ? 0 : isComputed(i) ? 2 : 1
  const substitutions = _.sortBy(interpols.map((i, idx) => [i, fieldParts[idx]] as const), ([i]) => tier(i))
    .reduce<Substitution[]>((ss, [i, p]) => {
      const fields: Fields = Object.fromEntries(ss.map(s => [s.tag, s.contents]))
      return [...ss, substitution(p.values(fields), i.marker, i.tag, i.tags)]
    }, [])

  let markerIdx = 0
  const template = [`${key}:`, ...parts.map(p => p.kind == 'text' ? p.text : `${defaultMarker}${++markerIdx}`)].join(' ')

  const contents = substitutions.reduce((c, s) => c.replace(s.marker, interpolateSubtToString(s.contents)), template)

  return renderLine(contents, key, interpolableLine(template, interpols, substitutions))
}
