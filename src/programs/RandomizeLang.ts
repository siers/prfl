import { Evals, isMainHeader, Item, Block, Parsed, Context, Memory, defaultMarker, Marker, header, interpolate, explode, line, block, RenderLine, renderLineSep, EvaluationResult, EvaluationContext, LineKeyPattern, interpolableLine, RenderLineSchema, renderLine1, errorLine, Interpolate, InterpolateSubstT, Substitution, Explode, toInterpolateSubst, rotateInterpolateSubst, substitution, ContentOrTag } from './RandomizeLangTypes'
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
  const [template, matches] = replaceMatchesMarker(l, /\{(?:[^}\\]|\\.)+\}|\[(?:[^\]\\]|\\.)+\]([a-zA-Z]+)?/g, defaultMarker)

  const evals: Evals = matches.map(([marker, m], idx) => {
    if (m[0] == '[') {
      const tag = m.match(/[a-zA-Z]+$/i)
      return interpolate(m.match(/^\[(.*)\][a-zA-Z]*$/)![1].replace(/\\([\[\]])/g, '$1'), marker, tag ? tag[0] : `tag${idx + 1}`)
    }
    if (m[0] == '{') return explode(m.slice(1, m.length - 1).replace(/\\([\{\}])/g, '$1'), marker)
    return interpolate('unlikely', '', null)
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

export function interpolateSubtToString(subst: InterpolateSubstT): string {
  let out

  try {
    if (subst.kind == 'ists') {
      out = subst.contents
    } else if (subst.kind == 'istas') {
      out = subst.contents.join(' ')
    } else {
      out = subst.contents.map(a => a.join('')).join(' ')
    }
  } catch (e) {
    out = `exc: ${e}`
  }

  return `[${out.length > 50 ? `${out.slice(0, 50)}...` : out}]`
}

function substituteInterpolate(line: RenderLine, marker: string, subst: InterpolateSubstT): RenderLine {
  return { ...line, contents: line.contents.replace(marker, interpolateSubtToString(subst)) }
}

function isRenderLines(subst: any): RenderLine[] | undefined {
  return RenderLineSchema.array().safeParse(subst).data
}

function substituteExplode(line: RenderLine, marker: string, subst: any): RenderLine[] {
  const renderLines = isRenderLines(subst)

  if (renderLines) {
    // NOTE: products of render lines not supported because of this line
    return renderLines // .map(r => line.replace(marker, `${r.contents}`))
  }

  if (isStringArray(subst)) {
    return (subst as string[]).map(r => renderLine1(line.contents.replace(marker, `${r}`)))
  }

  if (isArrayStringArray(subst)) {
    return (subst.map(c => c.join(' '))).map(r => renderLine1(line.contents.replace(marker, `[${r}]`)))
  }

  if (subst === undefined) return []

  else return [errorLine(`explode requires string[], got ${typeof subst}`)]
}

function executeCommand(command: string, context: Context): any {
  const memory = context.get('memory') as Memory
  const additionalContext = {
    memory,
    evalItem: context.get('evalItem'),
  }
  const fullContext = { ...randomizeLangUtils(context, memory), ...additionalContext }

  return executeInContext(fullContext, command)
}

function evalInterpolate(
  lss: [RenderLine, Substitution[]],
  i: Interpolate,
  context: Context,
): [RenderLine, Substitution[]] {
  const [l, ss] = lss
  const substOut: any = executeCommand(i.command, context)
  if (substOut?.kind === 'error') return [errorLine(`error: failed to compile: $subst?.contents}`), ss]
  const subst: InterpolateSubstT = toInterpolateSubst(substOut)

  if (l.source) return [l, ss]
  return [substituteInterpolate(l, i.marker, subst), ss.concat([substitution(subst, i.marker, i.tag)])]
}

function evalInterpolates(
  line: RenderLine,
  is: Interpolate[],
  context: Context,
): RenderLine {
  const [interpolated, substitutions] =
    is.reduce<[RenderLine, Substitution[]]>((lss, i) => evalInterpolate(lss, i, context), [line, []])

  return {
    ...interpolated,
    source: is.length > 0 ? interpolableLine(line.contents, is, substitutions) : null
  }
}

function evalItem(item: Item, context: Context): RenderLine[] {
  if (item.kind == 'header') return []
  if (item.kind == 'line') {
    const thisLine = item
    const [is, es]: [Interpolate[], Explode[]] = _.partition(thisLine.evals, e => e.kind == 'interpolate')

    return pipe(
      times(thisLine.times).map(_ => renderLine1(thisLine.contents)),
      lines => es.reduce((lines, e) => lines.flatMap(l => {
        const subst: any = executeCommand(e.command, context)
        if (subst?.kind === 'error') return [errorLine(`error: failed to compile: ${subst?.contents}}`)]

        return substituteExplode(l, e.marker, subst)
      }), lines),
      lines => lines.map(line => {
        if (line.source) return line

        return evalInterpolates(line, is, context)
      }),
      lines => lines.map(line => {
        const key = line.contents.match(LineKeyPattern)
        return { ...line, key: key && key[1] }
      }),
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

function initContext(memory: Memory): Map<string, any> {
  const ic = new Map<string, any>([
    ['memory', memory],
    ['evalItem', (i: Item) => evalItem(i, ic)],
  ])

  return ic
}

export function evalContentsMem(text: string, oldMemory: Memory = new Map()): [EvaluationResult, Memory] {
  const blocks = parseContents(text)
  const memory: Memory = mapCopy(oldMemory)

  const evaluationInit: EvaluationContext = [[], initContext(memory)]
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

export function evalRenderLine(l: RenderLine, mem: Memory = new Map()): RenderLine {
  if (!l.source) return l

  return {
    ...l,
    ...evalInterpolates({ ...l, contents: l?.source?.contents, source: null }, l?.source.interpols, initContext(mem))
  }
}

export function rotateInterpolableLine(l: RenderLine): RenderLine {
  if (l?.source?.substitutions && l?.source?.substitutions.length > 0) {
    const newSubst = (l.source.substitutions || []).map(s => ({ ...s, contents: rotateInterpolateSubst(s.contents) }))
    const resubst = newSubst.reduce<RenderLine>((l, s) => substituteInterpolate(l, s.marker, s.contents), { ...l, contents: l.source.contents })
    return {
      ...resubst,
      source: { ...l.source, substitutions: newSubst, }
    }
  } else return l
}

export function emptiedInterpolations(l: RenderLine): RenderLine {
  if (!l.source?.substitutions) return l
  return (l.source.substitutions || []).reduce<RenderLine>((l, s) => substituteInterpolate(l, s.marker, { kind: 'ists', contents: '-' }), { ...l, contents: l.source.contents })
}

export function renderLineContentWithTags(l: RenderLine): [ContentOrTag[], Map<String, Substitution>] {
  const byMarker: Map<string, Substitution> = new Map((l.source?.substitutions || []).map(s => [s.marker || '', s]))
  const byTag: Map<string, Substitution> = new Map((l.source?.substitutions || []).map(s => [s.tag || '', s]))

  const allTagsRegex = new RegExp(`${l.source?.substitutions?.map(s => s.marker || "").join('|')}`, 'g')

  const c = (l.source?.contents || "")
  const replaces = c.replaceAll(allTagsRegex, tag => `||##${byMarker.get(tag)?.tag}||`)
  const cwt: ContentOrTag[] = replaces.split('||').flatMap(s =>
    s == '' ? [] : [s.match(/^##/) ? ['tag', s.slice(2)] : ['string', s]]
  )

  return [cwt, byTag]
}
