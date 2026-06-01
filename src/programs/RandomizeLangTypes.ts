import { z } from 'zod'
import { arrayShift } from '../lib/Array'

export type Interpolate = {
  kind: 'interpolate',
  command: string,
  marker: string,
  tag: string | null,
}

export type Explode = {
  kind: 'explode',
  command: string,
  marker: string,
}

export type Eval = Interpolate | Explode
export type Evals = Eval[]

export type LineT<E> = {
  kind: 'line',
  contents: string,
  evals: E[],
  times: number,
}

export type Line = LineT<Eval>

export type ISTAAS = { 'kind': 'istaas', contents: string[][] }
export type ISTAS = { 'kind': 'istas', contents: string[] }
export type ISTS = { 'kind': 'ists', contents: string }
export type InterpolateSubstT = ISTAAS | ISTAS | ISTS

export type Substitution = {
  kind: 'substitution',
  contents: InterpolateSubstT,
  marker: string,
  tag: string | null,
}

export type InterpolableLine = {
  kind: 'interpolable-line',
  contents: string,
  interpols: Interpolate[],
  substitutions?: Substitution[],
}

export type RenderLine = {
  kind: 'renderline',
  contents: string,
  key: string | null,
  separator: boolean | null,
  source: InterpolableLine | null,
}

export const InterpolateSchema = z.object({
  kind: z.literal('interpolate'),
  command: z.string(),
  marker: z.string(),
  tag: z.string().nullable(),
})

export const InterpolableSubstTSchema = z.custom<ISTS>().or(z.custom<ISTAS>()).or(z.custom<ISTAAS>())

export const SubstituteSchema = z.object({
  kind: z.literal('substitution'),
  contents: InterpolableSubstTSchema,
  marker: z.string(),
  tag: z.string().nullable(),
})

export const InterpolableLineSchema = z.object({
  kind: z.literal('interpolable-line'),
  contents: z.string(),
  interpols: z.array(InterpolateSchema),
  substitutions: z.array(SubstituteSchema).optional(),
})

export const RenderLineSchema = z.object({
  kind: z.literal('renderline'),
  contents: z.string(),
  key: z.string().nullable(),
  separator: z.boolean().nullable(),
  source: InterpolableLineSchema.nullable(),
})

// if derived directly, the debugger shows the expanded definition, not the type alias
export type RenderLineDerived = z.infer<typeof RenderLineSchema>

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

type Assert<T extends true> = T

export type _assertOut = Assert<Equals<RenderLine, RenderLineDerived>>

// pattern for rendered lines that denotes their flashcard identificator
export const LineKeyPattern = /^ *([a-zA-Z0-9\-#]+)(: .*|)$/

export type Header = {
  kind: 'header',
  name: string | null,
  shuffle: boolean,
}

export const isMainHeader: (h: Header) => boolean = (h: Header) => h.name === null

export type Item = Header | Line

export type Block = {
  kind: 'block',
  header: Header,
  items: Item[],
}

// export type ContextBlock = (...args: any) => string[]

export type Blocks = Block[]

export type Parsed = Blocks
export type Context = Map<string, any> // contains both blocks as function and memory
export type Memory = Map<string, any>

export const defaultMarker = '!!!'

export const makeEmptyMemory = () => new Map()

export type Marker = string

export const header = (shuffle: Boolean, name: string | null) => ({ kind: 'header', name, shuffle }) as Header
export const interpolate = (command: string, marker: string, tag: string | null) => ({ kind: 'interpolate', command, marker, tag }) as Interpolate
export const explode = (command: string, marker: string) => ({ kind: 'explode', command, marker }) as Explode
export const line = (contents: string, evals: Evals, times: number) => ({ kind: 'line', contents, evals, times }) as Line
export const block = (header: Header, items: Item[]) => ({ kind: 'block', header, items }) as Block

export type EvaluationResult = RenderLine[]
export type EvaluationContext = [EvaluationResult[], Context]

export const interpolableLine: (contents: string, interpols: Interpolate[], substitutions?: Substitution[]) => InterpolableLine = (contents, interpols, substitutions) => ({ kind: 'interpolable-line', contents, interpols, substitutions })
export const substitution: (contents: InterpolateSubstT, marker: string, tag: string | null) => Substitution = (contents, marker, tag) => ({ kind: 'substitution', contents, marker, tag })

export const errorLine: (msg: string) => RenderLine = msg => renderLine(`error: ${msg}`, null, null)
export const renderLine: (contents: string, key: string | null, source: InterpolableLine | null) => RenderLine = (contents, key, source) => ({ kind: 'renderline', contents, key, separator: null, source })
export const renderLine1: (contents: string) => RenderLine = (contents: string) => ({ kind: 'renderline', contents, key: null, separator: null, source: null })
export const renderLineSep: () => RenderLine = () => ({ ...renderLine('---', null, null), separator: true })

const StringArray = z.array(z.string())
const StringArrayArray = z.array(z.array(z.string()))

export function toInterpolateSubst(subst: any): InterpolateSubstT {
  const strings = StringArray.safeParse(subst)
  const strings2d = StringArrayArray.safeParse(subst)

  if (strings.success) return { kind: 'istas', contents: strings.data }
  else if (strings2d.success) return { kind: 'istaas', contents: strings2d.data }
  else return { kind: 'ists', contents: subst?.toString() || '' }
}

export function rotateInterpolateSubst(s: InterpolateSubstT) {
  if (s.kind == 'ists') return s
  else if (s.kind == 'istas') return { kind: s.kind, contents: arrayShift(s.contents, 1) }
  else return { kind: s.kind, contents: arrayShift(s.contents, 1) }
}

export type ContentTag = ['tag', string]
export type ContentString = ['string', string]
export type ContentOrTag = (ContentTag | ContentString)
