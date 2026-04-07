// types

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

export type RenderLineK<Key> = {
  kind: 'renderline',
  contents: string,
  key: Key,
  separator?: boolean,
}

export type RenderLine = RenderLineK<LineKey>

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
export const renderLine: <K>(contents: string, key: K) => RenderLineK<K> = (contents, key) => ({ kind: 'renderline', contents, key })
export const renderLineSep: () => RenderLineK<null> = () => ({ ...renderLine('---', null), separator: true })

// export type ContextBlock = (...args: any) => string[]

export type Blocks = Block[]

export type Parsed = Blocks
export type Context = Map<string, any> // contains both blocks as function and memory
export type Memory = Map<string, any>

export const defaultMarker = '!!!'

export type Marker = string

export const header = (shuffle: Boolean, name: string | null) => ({ kind: 'header', name, shuffle }) as Header
export const interpolate = (command: string) => ({ kind: 'interpolate', command }) as Interpolate
export const explode = (command: string) => ({ kind: 'explode', command }) as Explode
export const line = (contents: string, evals: Evals, times: number) => ({ kind: 'line', contents, evals, times }) as Line
export const block = (header: Header, items: Item[]) => ({ kind: 'block', header, items }) as Block

export type LineKey = string | null
export type EvaluationResult = RenderLine[]
export type EvaluationContext = [EvaluationResult[], Context]
