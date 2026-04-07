import { z } from 'zod'

export type Interpolate = {
  kind: 'interpolate',
  command: string,
}

export type Explode = {
  kind: 'explode',
  command: string,
}

export type Eval = Interpolate | Explode
export type Evals = [Marker, Eval][]

export type Line = {
  kind: 'line',
  contents: string,
  evals: Evals,
  times: number,
}

export type RenderLine = {
  kind: 'renderline',
  contents: string,
  key: string | null,
  separator: boolean | null,
}

export const RenderLineSchema = z.object({
  kind: z.literal('renderline'),
  contents: z.string(),
  key: z.string().nullable(),
  separator: z.boolean().nullable(),
})

// if derived directly, the debugger shows the expanded definition, not the type alias
export type RenderLineDerived = z.infer<typeof RenderLineSchema>

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

type Assert<T extends true> = T

type _ = Assert<Equals<RenderLine, RenderLineDerived>>

export function ignore(_: _) { }

// pattern for rendered lines that denotes their flashcard identificator
export const LineKeyPattern = /^ *([a-zA-Z0-9\-]+):/

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

export const errorLine: (msg: string) => RenderLine = msg => renderLine(`error: ${msg}`, null)
export const renderLine: (contents: string, key: string | null) => RenderLine = (contents, key) => ({ kind: 'renderline', contents, key, separator: null })
export const renderLineSep: () => RenderLine = () => ({ ...renderLine('---', null), separator: true })

// export type ContextBlock = (...args: any) => string[]

export type Blocks = Block[]

export type Parsed = Blocks
export type Context = Map<string, any> // contains both blocks as function and memory
export type Memory = Map<string, any>

export const defaultMarker = '!!!'

export const makeEmptyMemory = () => new Map()

export type Marker = string

export const header = (shuffle: Boolean, name: string | null) => ({ kind: 'header', name, shuffle }) as Header
export const interpolate = (command: string) => ({ kind: 'interpolate', command }) as Interpolate
export const explode = (command: string) => ({ kind: 'explode', command }) as Explode
export const line = (contents: string, evals: Evals, times: number) => ({ kind: 'line', contents, evals, times }) as Line
export const block = (header: Header, items: Item[]) => ({ kind: 'block', header, items }) as Block

export type EvaluationResult = RenderLine[]
export type EvaluationContext = [EvaluationResult[], Context]
