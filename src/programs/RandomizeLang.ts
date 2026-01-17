// import { shuffleArray, shuffleMinDistanceIndexed } from '../lib/Random'
import { times, zipWithIndex } from '../lib/Array'
import _ from 'lodash'
import { randomizeLangUtils } from './RandomizeLangUtils'

// lib

function executeInContext<A>(context: Object, f: string): A {
  const keys = Object.keys(context);
  const values = Object.values(context);
  const fn = new Function(...keys, `return ${f.toString()};`);
  return fn(...values);
}

function pipe<A>(a: A, ...fns: ((a: A) => A)[]): A {
  return fns.reduce((a, f) => f(a), a)
}

// abac => ab ac
export const initSequences = <A>(lines: A[], finder: (_: A) => boolean): A[][] => {
  const groups = []

  do {
    const found = _.findIndex(lines.slice(1), finder)

    const index = found !== -1 ? found + 1 : lines.length
    groups.push(lines.slice(0, index))
    lines = lines.slice(index)

    if (!found || found == -1) break
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

type Item = Header | Line

type Block = {
  kind: 'block',
  header: Header,
  items: Item[],
}

type Blocks = Block[]

type Parsed = {
  named: Blocks,
  main: Blocks,
}

type Context = Map<string, string[]>

const defaultMarker = '!!!'

type Marker = string

const header = (shuffle: Boolean, name: string | null) => ({ kind: 'header', name, shuffle }) as Header
const interpolate = (command: string) => ({ kind: 'interpolate', command }) as Interpolate
const explode = (command: string) => ({ kind: 'explode', command }) as Explode
const line = (contents: string, evals: Evals, times: number) => ({ kind: 'line', contents, evals, times }) as Line
const block = (header: Header, items: Item[]) => ({ kind: 'block', header, items }) as Block

// parser

export function replaceMatchesMarker(line: string, regex: RegExp, marker: string): [string, [Marker, string][]] {
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

export function extractEvals(l: string): [string, Evals] {
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
  const match = lineRaw.match(/^-([-=])- ?(.*)$/)
  if (match) {
    return header(match[1] == '-', match[2] && match[2] != '' ? match[2] : null)
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
  const blocked = initSequences(parsed, i => i.kind! == 'header')

  const blocks = blocked.map(parseBlock)

  const [named, main] = _.partition(blocks, b => b.header.name != null)
  return { named, main }
}

export function evalExplodes(line: string, marker: string, e: Explode): string[] {
  const replacements: [string] = executeInContext(randomizeLangUtils, e.command)
  return replacements.map(r => line.replace(marker, r))
}

export function evalInterpolate(line: string, marker: string, i: Interpolate): string {
  const replacement: string = executeInContext(randomizeLangUtils, i.command)
  return line.replace(marker, replacement)
}

export function evalItem(item: Item, _context: Context): string[] {
  if (item.kind == 'header') return []
  if (item.kind == 'line') {
    const [interpolates, explodes] = _.partition(item.evals, ([_m, e]) => e.kind == 'interpolate')

    return pipe(
      times(item.times).map(_ => item.contents),
      lines => explodes.reduce((lines, [m, e]) => lines.flatMap(l => evalExplodes(l, m, e as Explode)), lines),
      lines => interpolates.reduce((lines, [m, i]) => lines.map(l => evalInterpolate(l, m, i as Interpolate)), lines),
    )
  }
  return []
}

function evalBlock(block: Block, context: Context): string[] {
  return block.items.flatMap(item => evalItem(item, context))
}

export function evalContentsIndexless(text: string): string[] {
  const { named, main } = parseContents(text)

  const namedBlocks = named.map<[string, string[]]>(b => [b.header.name || '', evalBlock(b, new Map())])
  const namedMap: Context = new Map<string, string[]>(namedBlocks)
  const mainBlocks = main.map(b => evalBlock(b, namedMap))

  return mainBlocks.flat()
}

// compat
export function evalContents(text: string): [number, string][] {
  return zipWithIndex(evalContentsIndexless(text))
}

// export function parseAndShuffle(text, distance) {
//   const indexedLineBlocks = parseContents(text)
//   return indexedLineBlocks.map(ls => shuffleMinDistanceIndexed(ls, distance).join('\n')).join('\n---\n')
// }
