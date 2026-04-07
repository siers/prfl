import { Eval, Evals, isMainHeader, Item, Block, Parsed, Context, Memory, defaultMarker, Marker, header, interpolate, explode, line, block, RenderLine, renderLineSep, renderLine, EvaluationResult, EvaluationContext } from './RandomizeLangTypes'
import { shuffleMinDistance, shuffleMinDistanceIndexed } from '../lib/Random.js'
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
    const body = code.match(/;$/) ? code : `return ${f.toString()};`
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
  const [template, matches] = replaceMatchesMarker(l, /\{(?:[^}\\]|\\.)+\}|\[(?:[^\]\\]|\\.)+\]/g, defaultMarker)

  const evals: Evals = matches.map(([marker, m]) => {
    const ev = (function () {
      if (m[0] == '[') return interpolate(m.slice(1, m.length - 1).replace(/\\([\[\]])/g, '$1'))
      if (m[0] == '{') return explode(m.slice(1, m.length - 1).replace(/\\([\{\}])/g, '$1'))
      return interpolate('unlikely')
    })()
    return [marker, ev]
  })

  return [template, evals]
}

function parseLine(lineRaw: string): Item[] {
  const headerMatch = lineRaw.match(/^-([-=])- ?(.*) *$/)

  if (lineRaw.match(/^#/)) {
    return []
  } else if (headerMatch) {
    return [header(headerMatch[1] == '-', headerMatch[2] && headerMatch[2] != '' ? headerMatch[2] : null)]
  } else {
    const timesMatch = lineRaw.match(/^(\d+)x /)
    const times = timesMatch ? parseInt(timesMatch[0], 10) : 1
    const lineRawUntimed = lineRaw.replace(/^\d+x /, '')

    const [contents, evals] = extractEvals(lineRawUntimed)
    return [line(contents, evals, times)]
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
  const parsed = lines.flatMap(parseLine)
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
  const additionalContext = {
    memory,
    evalItem: context.get('evalItem'),
  }
  const fullContext = { ...randomizeLangUtils(context, memory), ...additionalContext }

  const subst: any = executeInContext(fullContext, e.command)
  if (subst?.kind === 'error') return [`error: failed to compile: ${subst?.contents}}`]

  if (e.kind == 'interpolate') return substituteInterpolate(line, marker, subst)
  if (e.kind == 'explode') return substituteExplode(line, marker, subst)

  return [] // e.kind is never and both if branches are full, so this shouldn't be possible
}

function parseRenderLine(line: string): RenderLine {
  return renderLine<string | null>(line, null)
}

function evalItem(item: Item, context: Context): RenderLine[] {
  if (item.kind == 'header') return []
  if (item.kind == 'line') {
    const [is, es] = _.partition(item.evals, ([_m, e]) => e.kind == 'interpolate')

    const line = pipe(
      times(item.times).map(_ => item.contents),
      lines => es.reduce((lines, [m, e]) => lines.flatMap(l => evalEvals(l, m, e, context)), lines),
      lines => is.reduce((lines, [m, i]) => lines.flatMap(l => evalEvals(l, m, i, context)), lines),
    )

    return line.map(parseRenderLine)
  }
  return []
}

function evalBlock(block: Block, context: Context): RenderLine[] {
  const items = block.header.shuffle ? shuffleMinDistance(block.items, 1) : block.items

  const lines: [number, RenderLine][] = items.flatMap((item, index) => {
    return evalItem(item, context).map<[number, RenderLine]>(l => [index, l])
  })

  return block.header.shuffle ? shuffleMinDistanceIndexed(lines, 1) : lines.map(([_i, l]) => l)
}

export function evalContentsMem(text: string, oldMemory: Memory = new Map()): [EvaluationResult, Memory] {
  const blocks = parseContents(text)
  const memory: Memory = mapCopy(oldMemory)

  const initContext = new Map<string, any>([
    ['memory', memory],
    ['evalItem', (i: Item) => evalItem(i, initContext)],
  ])

  const evaluationInit: EvaluationContext = [[], initContext]
  const [mainBlocks, context]: EvaluationContext = blocks.reduce(([mainBlocks, context], b) => {
    if (isMainHeader(b.header))
      mainBlocks.push(evalBlock(b, context))
    else {
      context.set(b.header.name || 'impossiblè', () => evalBlock(b, context))
      context.set(`items-${b.header.name || 'impossiblè'}`, () => b.items)
    }

    return [mainBlocks, context] satisfies EvaluationContext
  }, evaluationInit)

  return [intersperse(mainBlocks.filter(b => b.length > 0), [renderLineSep()]).flat(), context.get('memory') as Memory]
}

export function evalContents(text: string): RenderLine[] {
  return evalContentsMem(text)[0]
}

export function evalContentsS(text: string): string[] {
  return evalContentsMem(text)[0].map(rl => rl.contents)
}
