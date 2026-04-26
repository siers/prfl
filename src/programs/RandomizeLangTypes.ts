import { z } from 'zod'

export type Interpolate = {
  kind: 'interpolate',
  command: string,
  marker: string,
}

export type Explode = {
  kind: 'explode',
  command: string,
  marker: string,
}

export type Eval = Interpolate | Explode
export type Evals = Eval[]

export type Line = {
  kind: 'line',
  contents: string,
  evals: Evals,
  times: number,
}

export type InterpolableLine = {
  kind: 'interpolable-line',
  contents: string,
  interpols: Interpolate[],
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
})

export const InterpolableLineSchema = z.object({
  kind: z.literal('interpolable-line'),
  contents: z.string(),
  interpols: z.array(InterpolateSchema),
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

type _assertOut = Assert<Equals<RenderLine, RenderLineDerived>>

export function ignore(_: _assertOut) { }

// pattern for rendered lines that denotes their flashcard identificator
export const LineKeyPattern = /^ *([a-zA-Z0-9\-]+)(: .*|)$/

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
export const interpolate = (command: string, marker: string) => ({ kind: 'interpolate', command, marker }) as Interpolate
export const explode = (command: string, marker: string) => ({ kind: 'explode', command, marker }) as Explode
export const line = (contents: string, evals: Evals, times: number) => ({ kind: 'line', contents, evals, times }) as Line
export const block = (header: Header, items: Item[]) => ({ kind: 'block', header, items }) as Block

export type EvaluationResult = RenderLine[]
export type EvaluationContext = [EvaluationResult[], Context]

export const interpolableLine: (contents: string, interpols: Interpolate[]) => InterpolableLine = (contents, interpols) => ({ kind: 'interpolable-line', contents, interpols })

export const errorLine: (msg: string) => RenderLine = msg => renderLine(`error: ${msg}`, null, null)
export const renderLine: (contents: string, key: string | null, source: InterpolableLine | null) => RenderLine = (contents, key, source) => ({ kind: 'renderline', contents, key, separator: null, source })
export const renderLineSep: () => RenderLine = () => ({ ...renderLine('---', null, null), separator: true })
