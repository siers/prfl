import { Eval, Evals, isMainHeader, Item, Block, Parsed, Context, Memory, defaultMarker, Marker, header, interpolate, explode, line, block, RenderLine, renderLineSep, renderLine, EvaluationResult, EvaluationContext, LineKeyPattern, interpolableLine, InterpolableLine, Interpolate, RenderLineSchema } from './RandomizeLangTypes'
import { shuffleMinDistance, shuffleMinDistanceIndexed } from '../lib/Random.js'
import { times, intersperse } from '../lib/Array'
import { mapCopy } from '../lib/Map'
import _ from 'lodash'
import { randomizeLangUtils } from './RandomizeLangUtils'
import { z } from 'zod'

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
    if (m[0] == '[') return interpolate(m.slice(1, m.length - 1).replace(/\\([\[\]])/g, '$1'), marker)
    if (m[0] == '{') return explode(m.slice(1, m.length - 1).replace(/\\([\{\}])/g, '$1'), marker)
    return interpolate('unlikely', '')
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

const StringArray = z.array(z.string())
const StringArrayArray = z.array(z.array(z.string()))
type InterpolateSubst = z.infer<typeof StringArray> | z.infer<typeof StringArrayArray> | unknown

function substituteInterpolate(line: string, marker: string, subst: InterpolateSubst) {
  let out

  try {
    const strings = StringArray.safeParse(subst)
    const strings2d = StringArrayArray.safeParse(subst)

    if (strings.success) {
      out = strings.data.join(' ')
    } else if (strings2d.success) {
      out = strings2d.data.map(a => a.join('')).join(' ')
    } else {
      out = (subst as any).toString()
    }
  } catch (e) {
    out = `exc: ${e}`
  }

  return [line.replace(marker, `[${out}]`)]
}

function isRenderLines(subst: any): RenderLine[] | undefined {
  return RenderLineSchema.array().safeParse(subst).data
}

function substituteExplode(line: string, marker: string, subst: any): string[] {
  const renderLines = isRenderLines(subst)

  if (renderLines) {
    return renderLines.map(r => line.replace(marker, `${r.contents}`))
  }

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

function toRenderLine(contents: string, iLine: InterpolableLine): RenderLine {
  const key = contents.match(LineKeyPattern)
  return renderLine(contents, key && key[1], iLine)
}

function evalItem(item: Item, context: Context): RenderLine[] {
  if (item.kind == 'header') return []
  if (item.kind == 'line') {
    const thisLine = item
    const [is, es] = _.partition(thisLine.evals, e => e.kind == 'interpolate')

    const lines = pipe(
      times(thisLine.times).map(_ => thisLine.contents),
      lines => es.reduce((lines, e) => lines.flatMap(l => evalEvals(l, e.marker, e, context)), lines),
    )

    const evalInterpolateUnsafe = (l: string, i: Interpolate) => evalEvals(l, i.marker, i, context)[0]

    return lines.map(line =>
      toRenderLine(is.reduce((line, i) => {
        return evalInterpolateUnsafe(line, i)
      }, line), interpolableLine(line, is))
    )
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
