// import { shuffleMinDistanceIndexed } from '../lib/ShuffleVibe.js'
import { shuffleMinDistanceIndexed } from '../lib/Random.js'
import { times, intersperse } from '../lib/Array'
import { mapCopy } from '../lib/Map'
import _ from 'lodash'
import { randomizeLangUtils } from './RandomizeLangUtils'

// lib

function executeInContext<A>(context: Object, f: string): A | { kind: 'error', contents: string } | null {
  const keys = Object.keys(context)
  const values = Object.values(context)
  try {
    const code = f.toString()
    const body = code.indexOf(';') !== -1 ? code : `return ${f.toString()};`
    const fn = new Function(...keys, body)
    return fn(...values)
  } catch (e) {
    console.error(e)
    return { kind: 'error', contents: `error: ${e?.toString()}` }
  }
}

function pipe<A>(a: A, ...fns: ((a: A) => A)[]): A {
  return fns.reduce((a, f) => f(a), a)
}

function isStringArray(value: any): value is string[] {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (typeof item !== 'string') return false;
  }
  return true;
}

function isArrayStringArray(value: any): value is string[][] {
  if (!Array.isArray(value)) return false;
  if (!value.every(value => Array.isArray(value))) return false;
  for (const array of value) {
    for (const item of array) {
      if (typeof item !== 'string') return false;
    }
  }
  return true;
}

// abac => ab ac
export const initSequences = <A>(lines: A[], finder: (_: A) => boolean): A[][] => {
  const groups = []

  do {
    const found = _.findIndex(lines.slice(1), finder)

    const index = found !== -1 ? found + 1 : lines.length
    groups.push(lines.slice(0, index))
    lines = lines.slice(index)

    if (found == -1) break
  } while (true)

  return groups
}

// types

type Interpolate = {
  kind: 'interpolate',
  command: string,
}

type Explode = {
  kind: 'explode',
  command: string,
}

type Eval = Interpolate | Explode
type Evals = [Marker, Eval][]

type Line = {
  kind: 'line',
  contents: string,
  evals: Evals,
  times: number,
}

type Header = {
  kind: 'header',
  name: string | null,
  shuffle: boolean,
}

const isMainHeader: (h: Header) => boolean = (h: Header) => h.name === null

type Item = Header | Line

type Block = {
  kind: 'block',
  header: Header,
  items: Item[],
}

// export type ContextBlock = (...args: any) => string[]

type Blocks = Block[]

type Parsed = Blocks
type Context = Map<string, any> // contains both blocks as function and memory
export type Memory = Map<string, any>

const defaultMarker = '!!!'

type Marker = string

const header = (shuffle: Boolean, name: string | null) => ({ kind: 'header', name, shuffle }) as Header
const interpolate = (command: string) => ({ kind: 'interpolate', command }) as Interpolate
const explode = (command: string) => ({ kind: 'explode', command }) as Explode
const line = (contents: string, evals: Evals, times: number) => ({ kind: 'line', contents, evals, times }) as Line
const block = (header: Header, items: Item[]) => ({ kind: 'block', header, items }) as Block

// parser

function replaceMatchesMarker(line: string, regex: RegExp, marker: string): [string, [Marker, string][]] {
  const groups: [string, string][] = []

  let count = 0

  const template = line.replaceAll(regex, match => {
    count += 1
    const thisMarker = marker + count
    groups.push([thisMarker, match])
    return thisMarker
  })

  return [template, groups]
}

function extractEvals(l: string): [string, Evals] {
  const [template, matches] = replaceMatchesMarker(l, /\{[^}]+\}|\[[^\]]+\]/g, defaultMarker)

  const evals: Evals = matches.map(([marker, m]) => {
    const ev = (function () {
      if (m[0] == '[') return interpolate(m.slice(1, m.length - 1))
      if (m[0] == '{') return explode(m.slice(1, m.length - 1))
      return interpolate('unlikely')
    })()
    return [marker, ev]
  })

  return [template, evals]
}

function parseLine(lineRaw: string): Item {
  const headerMatch = lineRaw.match(/^-([-=])- ?(.*) *$/)
  if (headerMatch) {
    return header(headerMatch[1] == '-', headerMatch[2] && headerMatch[2] != '' ? headerMatch[2] : null)
  } else {
    const timesMatch = lineRaw.match(/^(\d+)x /)
    const times = timesMatch ? parseInt(timesMatch[0], 10) : 1
    const lineRawUntimed = lineRaw.replace(/^\d+x /, '')

    const [contents, evals] = extractEvals(lineRawUntimed)
    return line(contents, evals, times)
  }
}

function parseBlock(items: Item[]): Block {
  if (items[0] && items[0].kind == 'header') {
    return block(items[0], items)
  } else {
    return block(header(true, null), items)
  }
}

export function parseContents(text: string): Parsed {
  const lines = text.split('\n').filter(x => !x.match(/^ *$/))
  const parsed = lines.map(parseLine)
  return initSequences(parsed, i => i.kind! == 'header').map(parseBlock)
}

// evaluators

function substituteInterpolate(line: string, marker: string, subst: any) {
  let out

  try {
    if (typeof subst === 'object' && subst['every'] && subst['every']((a: any) => typeof a === 'string')) {
      out = subst.join(' ')
    }
    else {
      out = subst.toString()
    }
  } catch (e) {
    out = 'x'
  }

  return [line.replace(marker, `[${out}]`)]
  // if (typeof subst === 'string')
  // else return [`interpolate requires string, got ${typeof subst}`]
}

function substituteExplode(line: string, marker: string, subst: any) {
  if (isStringArray(subst)) {
    return (subst as string[]).map(r => line.replace(marker, `${r}`))
  }

  if (isArrayStringArray(subst)) {
    return (subst.map(c => c.join(' '))).map(r => line.replace(marker, `[${r}]`))
  }

  if (subst === undefined) return []

  else return [`explode requires string[], got ${typeof subst}`]
}

function evalEvals(line: string, marker: string, e: Eval, context: Context): string[] {
  const memory = context.get('memory') as Memory
  const fullContext = { ...randomizeLangUtils(context, memory), memory }

  const subst: any = executeInContext(fullContext, e.command)
  if (subst?.kind === 'error') return [`failed to compile: ${subst?.contents}}`]

  if (e.kind == 'interpolate') return substituteInterpolate(line, marker, subst)
  if (e.kind == 'explode') return substituteExplode(line, marker, subst)

  return [] // e.kind is never and both if branches are full, so this shouldn't be possible
}

function evalItem(item: Item, context: Context): string[] {
  if (item.kind == 'header') return []
  if (item.kind == 'line') {
    const [is, es] = _.partition(item.evals, ([_m, e]) => e.kind == 'interpolate')

    return pipe(
      times(item.times).map(_ => item.contents),
      lines => es.reduce((lines, [m, e]) => lines.flatMap(l => evalEvals(l, m, e, context)), lines),
      lines => is.reduce((lines, [m, i]) => lines.flatMap(l => evalEvals(l, m, i, context)), lines),
    )
  }
  return []
}

function evalBlock(block: Block, context: Context): string[] {
  const lines: [number, string][] =
    block.items.flatMap((item, index) => {
      return evalItem(item, context).map<[number, string]>(l => [index, l])
    })

  return block.header.shuffle ? shuffleMinDistanceIndexed(lines, 1) : lines.map(([_i, l]) => l)
}

type EvaluationResult = string[]
type EvaluationContext = [EvaluationResult[], Context]

export function evalContentsMem(text: string, oldMemory: Memory = new Map()): [EvaluationResult, Memory] {
  const blocks = parseContents(text)
  const memory: Memory = mapCopy(oldMemory)

  const evaluationInit: EvaluationContext = [[], new Map<string, any>([['memory', memory]])]
  const [mainBlocks, context]: EvaluationContext = blocks.reduce(([mainBlocks, context], b) => {
    if (isMainHeader(b.header))
      mainBlocks.push(evalBlock(b, context))
    else
      context.set(b.header.name || '', () => evalBlock(b, context))

    return [mainBlocks, context] satisfies EvaluationContext
  }, evaluationInit)

  return [intersperse(mainBlocks, ['---']).flat(), context.get('memory') as Memory]
}

export function evalContents(text: string): string[] {
  return evalContentsMem(text)[0]
}
