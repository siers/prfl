import { Evals, isMainHeader, isSubdeckHeader, Subdecks, Item, Block, Parsed, Context, Memory, defaultMarker, Marker, header, interpolate, explode, line, block, RenderLine, renderLineSep, EvaluationResult, EvaluationContext, LineKeyPattern, interpolableLine, RenderLineSchema, renderLine, renderLine1, errorLine, Interpolate, InterpolateSubstT, Substitution, Explode, toInterpolateSubst, rotateInterpolateSubst, substitution, ContentOrTag } from './RandomizeLangTypes'
import { shuffleMinDistance, shuffleMinDistanceIndexed } from '../lib/Random.js'
import { times, intersperse } from '../lib/Array'
import { mapCopy } from '../lib/Map'
import _ from 'lodash'
import { randomizeLangUtils } from './RandomizeLangUtils'
import type { ImageEntry } from '../lib/PrflAssets'

// Extra, host-supplied bits the high-level evaluators thread down into the DSL
// context (e.g. the images globbed by `glob`). Each entry lands in the context
// map under its key, so utilities in RandomizeLangUtils can read them.
export type AdditionalContext = {
  images?: ImageEntry[],
}

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
  const [template, matches] = replaceMatchesMarker(l, /\{(?:[^}\\]|\\.)+\}|\[(?:[^\]\\]|\\.)+\]([^\] ]+)?/gi, defaultMarker)

  const evals: Evals = matches.map(([marker, m], idx) => {
    if (m[0] == '[') {
      const tag = m.match(/[^\] ]+$/i)
      const tags = tag && tag[0].split(':')
      const tagName: string | undefined = tags && tags[0] && tags[0].length > 0 && tags[0] || undefined
      return interpolate(m.match(/^\[(.*)\][^\] ]*$/)![1].replace(/\\([\[\]])/g, '$1'), marker, tagName || `tag${idx + 1}`, tags && tags.length > 1 ? tags.slice(1) : null)
    }
    if (m[0] == '{') return explode(m.slice(1, m.length - 1).replace(/\\([\{\}])/g, '$1'), marker)
    return interpolate('unlikely', '', null, null)
  })

  return [template, evals]
}

function parseLine(lineRaw: string): Item[] {
  const headerMatch = lineRaw.match(/^-([-=])- ?(.*) *$/)

  if (lineRaw.match(/^#/)) {
    return []
  } else if (headerMatch) {
    // `-=- name::` marks a subdeck block; the `::` is not part of the name.
    const nameRaw = (headerMatch[2] || '').trim()
    const subdeck = nameRaw.endsWith('::')
    const name = (subdeck ? nameRaw.slice(0, -2).trim() : nameRaw) || null
    return [header(headerMatch[1] == '-', name, subdeck && name !== null)]
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

export function interpolateSubtToStringPlain(subst: InterpolateSubstT): string {
  try {
    return subst.join(' ')
  } catch (e) {
    return `exc: ${e}`
  }
}

export function interpolateSubtToString(subst: InterpolateSubstT): string {
  const out = interpolateSubtToStringPlain(subst)

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

  else return [errorLine(`explode requires string[], got ${JSON.stringify(subst)}`)]
}

function executeCommand(command: string, context: Context, extra: Record<string, any> = {}): any {
  const memory = context.get('memory') as Memory
  const additionalContext = {
    memory,
    evalItem: context.get('evalItem'),
  }
  const fullContext = { ...randomizeLangUtils(context, memory), ...additionalContext, ...extra }

  return executeInContext(fullContext, command)
}

// The frozen substitutions resolved so far, exposed to a command under `frozen`
// as tag -> chosen values, so a non-frozen interpolation can read the values
// its frozen siblings settled on (e.g. `frozen.root` -> ['C']).
function frozenContext(substitutions: Substitution[]): Record<string, InterpolateSubstT> {
  return Object.fromEntries(
    substitutions.filter(s => s.freeze && s.tag).map(s => [s.tag as string, s.contents]),
  )
}

function evalInterpolate(
  lss: [RenderLine, Substitution[]],
  i: Interpolate,
  context: Context,
  frozen: Substitution[],
): [RenderLine, Substitution[]] {
  const [l, ss] = lss

  // A frozen interpolation is not re-evaluated: reuse its prior substitution
  // (matched by marker) instead of executing the command again.
  const priorFrozen = i.freeze ? frozen.find(s => s.marker === i.marker) : undefined

  let subst: InterpolateSubstT
  if (priorFrozen) {
    subst = priorFrozen.contents
  } else {
    // Non-frozen interpolations can read the frozen siblings' chosen values:
    // the prior frozen ones (re-eval) plus any resolved so far this pass.
    const extra = { frozen: frozenContext([...frozen, ...ss]) }
    const substOut: any = executeCommand(i.command, context, extra)
    if (substOut?.kind === 'error') return [errorLine(`error: failed to compile: $subst?.contents}`), ss]
    subst = toInterpolateSubst(substOut)
  }

  if (l.source) return [l, ss]
  return [substituteInterpolate(l, i.marker, subst), ss.concat([substitution(subst, i.marker, i.tag, i.tags)])]
}

function evalInterpolates(
  line: RenderLine,
  is: Interpolate[],
  context: Context,
  frozen: Substitution[] = [],
): RenderLine {
  const [interpolated, substitutions] =
    is.reduce<[RenderLine, Substitution[]]>((lss, i) => evalInterpolate(lss, i, context, frozen), [line, []])

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

function initContext(memory: Memory, additionalContext: AdditionalContext = {}): Map<string, any> {
  const ic = new Map<string, any>([
    ['memory', memory],
    ['evalItem', (i: Item) => evalItem(i, ic)],
  ])

  for (const [key, value] of Object.entries(additionalContext)) ic.set(key, value)

  return ic
}

// The card a `-=- name::` block leaves in the root deck: its key is the deck's
// name, which is what makes the deck reachable — the "enter subdeck" button
// looks for a deck named after the current card's key (see liveSubdeckName).
export function subdeckCard(name: string): RenderLine {
  return renderLine(name, name, null)
}

// The deck a `-=- name::` block fills. The trailing separator mirrors the
// `Key/zip` shape spawned decks use, so both are found by the same key prefix.
export function declaredDeckName(name: string): string {
  return `${name}/`
}

// The full evaluation: the root deck's lines, the subdecks declared with
// `-=- name::`, and the resulting memory.
export function evalContentsDecks(text: string, oldMemory: Memory = new Map(), additionalContext: AdditionalContext = {}): [EvaluationResult, Subdecks, Memory] {
  const blocks = parseContents(text)
  const memory: Memory = mapCopy(oldMemory)

  const evaluationInit: EvaluationContext = [[], {}, initContext(memory, additionalContext)]
  const [mainBlocks, subdecks, context]: EvaluationContext = blocks.reduce(([mainBlocks, subdecks, context], b) => {
    const name = b.header.name || 'impossiblè'

    if (isMainHeader(b.header))
      mainBlocks.push(evalBlock(b, context))
    else if (isSubdeckHeader(b.header)) {
      const deck = declaredDeckName(name)
      // Blocks sharing a subdeck name concatenate into that one deck, and only
      // the first one contributes the root card that leads into it. The card
      // joins the running main block rather than starting its own, so it doesn't
      // introduce a separator around itself.
      if (!subdecks[deck]) {
        const last = mainBlocks[mainBlocks.length - 1]
        if (last) last.push(subdeckCard(name))
        else mainBlocks.push([subdeckCard(name)])
      }
      subdecks[deck] = (subdecks[deck] || []).concat(evalBlock(b, context))
    }
    else {
      context.set(name, () => evalBlock(b, context))
      context.set(`items-${name}`, () => b.items)
    }

    return [mainBlocks, subdecks, context] satisfies EvaluationContext
  }, evaluationInit)

  return [
    intersperse(mainBlocks.filter(b => b.length > 0), [renderLineSep()]).flat(),
    subdecks,
    context.get('memory') as Memory,
  ]
}

export function evalContentsMem(text: string, oldMemory: Memory = new Map(), additionalContext: AdditionalContext = {}): [EvaluationResult, Memory] {
  const [lines, _subdecks, memory] = evalContentsDecks(text, oldMemory, additionalContext)
  return [lines, memory]
}

export function evalContents(text: string, additionalContext: AdditionalContext = {}): RenderLine[] {
  return evalContentsMem(text, new Map(), additionalContext)[0]
}

// Schedule-sort items the way the todo program does: least-recently-reviewed
// first (read from `memory`'s cards), with the early-bias random pick on top.
// Used to (re-)order spawned subdecks so the best-next surfaces even if you pop
// out before finishing.
export function scheduleItems<A extends RenderLine>(items: A[], memory: Memory = new Map()): A[] {
  return randomizeLangUtils(initContext(memory), memory).pickTasksStateless(items)
}

export function evalContentsS(text: string): string[] {
  return evalContentsMem(text)[0].map(rl => rl.contents)
}

export function evalRenderLine(l: RenderLine, mem: Memory = new Map(), additionalContext: AdditionalContext = {}): RenderLine {
  if (!l.source) return l

  return {
    ...l,
    ...evalInterpolates({ ...l, contents: l?.source?.contents, source: null }, l?.source.interpols, initContext(mem, additionalContext), l.source.substitutions || [])
  }
}

export function rotateInterpolableLine(l_: RenderLine, tag: string | null = null): RenderLine {
  const l = structuredClone(l_)

  if (l?.source?.substitutions && l?.source?.substitutions.length > 0) {
    const newSubst = (l.source.substitutions || []).map(s =>
      !tag || tag == s.tag
        ? { ...s, contents: rotateInterpolateSubst(s.contents) }
        : s
    )

    const resubst = newSubst.reduce<RenderLine>((l, s) =>
      substituteInterpolate(l, s.marker, s.contents), { ...l, contents: l.source.contents }
    )

    return { ...resubst, source: { ...l.source, substitutions: newSubst } }
  } else return l
}

// The flashcard "hidden answer" view: blank each interpolated part to '-' so the
// answer isn't shown. A substitution narrowed to a single value (a spawned leaf)
// is already concrete — there's nothing to hide — so render its value instead of
// blanking it.
export function emptiedInterpolations(l_: RenderLine): RenderLine {
  const l = structuredClone(l_)

  if (!l.source?.substitutions) return l
  return (l.source.substitutions || []).reduce<RenderLine>(
    (l, s) => substituteInterpolate(l, s.marker, s.contents.length === 1 ? s.contents : ['-']),
    { ...l, contents: l.source.contents },
  )
}

// Collapse each interpolation to a single chosen value (one per substitution,
// in substitution order) and re-render via the same substitute path the parent
// used. Used by deck-spawning to materialise one concrete child per combination
// without re-deriving the text by hand.
//
// The source is kept (not discarded): each substitution is narrowed to its
// single chosen value while preserving its marker and tag. That keeps tag-driven
// rendering (images, sheets, content-with-tags) working on spawned children,
// which would otherwise lose all tag metadata. The interpols are dropped, since a
// collapsed leaf has nothing left to (re-)evaluate — that keeps it frozen (no
// re-eval, not spawnable) while its tags live on.
export function collapseToValues(l_: RenderLine, values: string[]): RenderLine {
  const l = structuredClone(l_)

  if (!l.source?.substitutions) return l
  const newSubst = (l.source.substitutions || []).map((s, i) =>
    ({ ...s, contents: [values[i] ?? '-'] })
  )

  const resubst = newSubst.reduce<RenderLine>(
    (l, s) => substituteInterpolate(l, s.marker, s.contents),
    { ...l, contents: l.source.contents },
  )

  return { ...resubst, source: { ...l.source, interpols: [], substitutions: newSubst } }
}

export function extractTagFunctions(tags: string[] | null): Map<string, string[]> {
  return new Map((tags || []).flatMap(t => {
    const [fn, ...args] = t.split('-')
    return fn ? [[fn, args] satisfies [string, string[]]] : []
  }))
}

export function renderLineContentWithTags(l: RenderLine): [ContentOrTag[], Map<String, Substitution>] {
  const byMarker: Map<string, Substitution> = new Map((l.source?.substitutions || []).map(s => [s.marker || '', s]))
  const byTag: Map<string, Substitution> = new Map((l.source?.substitutions || []).map(s => {
    const args = extractTagFunctions(s.tags)
    return [s.tag || '', {
      ...s,
      contents: s.contents.slice(0, args.get('show') ? parseInt((args.get('show') || [])[0]) : 9999),
    }]
  }))

  const allTagsRegex = new RegExp(`${l.source?.substitutions?.map(s => s.marker || "").join('|')}`, 'g')

  const c = (l.source?.contents || l.contents || "")
  const replaces = c.replaceAll(allTagsRegex, tag => `||##${byMarker.get(tag)?.tag}||`)
  const cwt: ContentOrTag[] = replaces.split('||').flatMap(s =>
    s == '' ? [] : [s.match(/^##/) ? ['tag', s.slice(2)] : ['string', s]]
  )

  return [cwt, byTag]
}
