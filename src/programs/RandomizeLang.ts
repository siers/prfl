import { Evals, isMainHeader, Header, Line, BlockHeaders, Item, Block, Parsed, Context, Memory, defaultMarker, Marker, header, interpolate, explode, line, block, RenderLine, renderLineSep, EvaluationResult, EvaluationContext, LineKeyPattern, interpolableLine, RenderLineSchema, renderLine1, errorLine, Interpolate, InterpolateSubstT, Substitution, Explode, toInterpolateSubst, rotateInterpolateSubst, substitution, ContentOrTag, isFrozen, isComputed, isNonrotated, showCount } from './RandomizeLangTypes'
import { shuffleMinDistance, shuffleMinDistanceIndexed } from '../lib/Random.js'
import { times, intersperse } from '../lib/Array'
import { mapCopy } from '../lib/Map'
import _ from 'lodash'
import murmur from 'murmurhash3js'
import { randomizeLangUtils } from './RandomizeLangUtils'
import * as Utils from './RandomizeLangUtils'
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

// `#tag` (at a word start) is shorthand for `[]tag`: a tag with no value.
function extractEvals(l: string): [string, Evals] {
  const [template, matches] = replaceMatchesMarker(l, /\{(?:[^}\\]|\\.)+\}|\[(?:[^\]\\]|\\.)+\]([^\] ]+)?|(?<=^|\s)#[^\s\[\]{}]+/gi, defaultMarker)

  const evals: Evals = matches.map(([marker, m], idx) => {
    if (m[0] == '#') {
      const [tagName, ...flags] = m.slice(1).split(':')
      return interpolate('', marker, tagName || `tag${idx + 1}`, flags.length > 0 ? flags : null)
    }
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

// The rest of a header is an item line — key, description, `[]` and `{}` —
// minus the `Nx` multiplier.
function parseHeader(lineRaw: string): Header | null {
  const headerMatch = lineRaw.match(/^-([-=])- *(.*?) *$/)
  if (!headerMatch) return null
  const rest = headerMatch[2]
  return header(headerMatch[1] == '-', rest ? line(...extractEvals(rest), 1) : null)
}

function parseLine(lineRaw: string): Item[] {
  const parsedHeader = parseHeader(lineRaw)

  if (lineRaw.match(/^#/)) {
    return []
  } else if (parsedHeader) {
    return [parsedHeader]
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
  return relocateLines(initSequences(parsed, i => i.kind! == 'header').map(parseBlock))
}

const RelocatePattern = /^([a-zA-Z0-9\-#]+)::(.*)$/

// A header's name as written, before evaluation: the line key, else the first
// word — the rule evalHeader applies after it.
function writtenHeaderName(h: Header): string | null {
  if (!h.line) return null
  const contents = h.line.contents
  return contents.match(LineKeyPattern)?.[1] ?? contents.match(/^[^ ]*/)![0]
}

// `name::rest` moves the line `rest` to the end of the first block whose header
// is written `name`. Names are matched as written, so a header whose name is
// only known after evaluation can't be targeted; the line then stays as it is.
function relocateLines(blocks: Block[]): Block[] {
  const names = blocks.map(b => writtenHeaderName(b.header))
  const moved: Item[][] = blocks.map(_ => [])

  const kept = blocks.map(b => b.items.filter(item => {
    const m = item.kind == 'line' && item.contents.match(RelocatePattern)
    const target = m ? names.indexOf(m[1]) : -1
    if (!m || target == -1) return true

    moved[target].push({ ...item, contents: m[2] } satisfies Line)
    return false
  }))

  return blocks.map((b, i) => block(b.header, kept[i].concat(moved[i])))
}

// The names of the named blocks — the keys an item can instantiate a subdeck
// from — read off the headers evaluated with the root deck.
export function blockNames(headers: BlockHeaders): Set<string> {
  return new Set(headers.flatMap(h => h?.key || []))
}

// evaluators

export function interpolateSubtToStringPlain(subst: InterpolateSubstT): string {
  try {
    return subst.join(' ')
  } catch (e) {
    return `exc: ${e}`
  }
}

export function interpolateSubtToString(subst: InterpolateSubstT, cutSemi = false, maxLen = 50): string {
  const cut = cutSemi ? subst.map(s => s.split(';')[0]) : subst
  const out = interpolateSubtToStringPlain(cut)

  return `[${out.length > maxLen ? `${out.slice(0, maxLen)}...` : out}]`
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
  const fullContext = { ...Utils, ...randomizeLangUtils(context, memory), ...additionalContext, ...extra }

  return executeInContext(fullContext, command)
}

// The substitutions resolved so far, exposed to a command under `fields` as
// tag -> chosen values, so an interpolation can read the values its siblings
// settled on (e.g. `fields.root` -> ['C']). Covers every substitution with a
// tag — frozen, default, and any `computed` fields resolved in an earlier pass.
// `frozen` is kept as a back-compat alias for the same map.
function fieldsContext(substitutions: Substitution[]): Record<string, InterpolateSubstT> {
  return Object.fromEntries(
    substitutions.filter(s => s.tag).map(s => [s.tag as string, s.contents]),
  )
}

// Interpolations resolve in tiers so that later ones can read earlier ones via
// `fields`: `freeze` first (pass -Inf, reused across re-eval), then default
// (pass 0, textual order), then `computed` last (pass 1, reads everything). The
// order is stable within each tier, so it stays textual where it always was.
function orderInterpolates(is: Interpolate[]): Interpolate[] {
  const tier = (i: Interpolate) => isFrozen(i) ? 0 : isComputed(i) ? 2 : 1
  return _.sortBy(is, tier)
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
  const priorFrozen = isFrozen(i) ? frozen.find(s => s.marker === i.marker) : undefined

  let subst: InterpolateSubstT
  if (priorFrozen) {
    subst = priorFrozen.contents
  } else {
    // Any interpolation can read the fields resolved so far: the prior frozen
    // ones (kept across re-eval) plus everything resolved earlier this pass.
    // `computed` fields, evaluated last, thus see every default/frozen field.
    const fields = fieldsContext([...frozen, ...ss])
    const extra = { fields, frozen: fields }
    const substOut: any = executeCommand(i.command, context, extra)
    if (substOut?.kind === 'error') return [errorLine(`error: failed to compile: ${substOut}`), ss]
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
    orderInterpolates(is).reduce<[RenderLine, Substitution[]]>((lss, i) => evalInterpolate(lss, i, context, frozen), [line, []])

  return {
    ...interpolated,
    // The stored substitutions follow the resolution order, not textual order;
    // rendering already targets markers so the visible line is unaffected, and
    // this lets rotation re-derive `computed` fields after their sources.
    source: is.length > 0 ? interpolableLine(line.contents, is, substitutions) : null
  }
}

// Every item has a key: a line without a `Key:` prefix gets `Nr` and 6 hex
// digits of its hash.
function hashKey(contents: string): string {
  return `Nr${murmur.x86.hash32(contents).toString(16).padStart(8, '0').slice(0, 6)}`
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
      // The fallback key hashes the line before its `[]` are rolled, so a
      // re-roll keeps it. Lines a block explode yields keep their own.
      lines => lines.map(line => {
        if (line.source) return line

        return { ...evalInterpolates(line, is, context), key: hashKey(line.contents) }
      }),
      lines => lines.map(line => {
        const key = line.contents.match(LineKeyPattern)
        return { ...line, key: key ? key[1] : line.key }
      }),
    )
  }

  return []
}

// A header evaluates like an item line, keeping only the first line an explode
// yields; none drops the block. Without a `Key:` prefix, the first word is the
// key — not the item's `Nr` hash.
function evalHeader(h: Header, context: Context): RenderLine | null {
  if (!h.line) return null
  const [first] = evalItem(h.line, context)
  if (!first) return null
  return { ...first, key: first.contents.match(LineKeyPattern)?.[1] ?? first.contents.match(/^[^ ]*/)![0] }
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

// Evaluates the main blocks in file order, registering each named block as a
// callable in the context as it is reached. Headers are evaluated as they are
// reached too, unless `headers` from an earlier evaluation are given — those
// are used as-is, so the block names never change after the first evaluation.
function evalContentsContext(text: string, oldMemory: Memory, additionalContext: AdditionalContext, headers?: BlockHeaders): EvaluationContext {
  const blocks = parseContents(text)
  const memory: Memory = mapCopy(oldMemory)

  const evaluationInit: EvaluationContext = [[], initContext(memory, additionalContext), []]
  return blocks.reduce(([mainBlocks, context, evaluatedHeaders], b, index) => {
    if (isMainHeader(b.header)) {
      mainBlocks.push(evalBlock(b, context))
      evaluatedHeaders.push(null)
    } else {
      const h = headers ? headers[index] ?? null : evalHeader(b.header, context)
      evaluatedHeaders.push(h)
      if (h?.key) {
        context.set(h.key, () => evalBlock(b, context))
        context.set(`items-${h.key}`, () => b.items)
      }
    }

    return [mainBlocks, context, evaluatedHeaders] satisfies EvaluationContext
  }, evaluationInit)
}

// The deck an item keyed `name` instantiates from the block `name`. The
// trailing separator mirrors the `Key/zip` shape spawned decks use, so it's
// found through the same prefix match (see liveSubdeckName).
export function blockDeckName(name: string): string {
  return `${name}/`
}

// A block whose header is tagged `unscheduled` (`#unscheduled`) instantiates in
// its own order — written, or shuffled for `---` — not schedule-sorted.
function isUnscheduled(header: RenderLine): boolean {
  return (header.source?.substitutions || []).some(s => s.tag === 'unscheduled')
}

// The items of the subdeck instantiated from block `name`, ordered as
// `scheduleBlocks(name)` would, unless unscheduled. The whole text is
// re-evaluated first so the block sees every block and global a call from the text would — which means
// globals assigned randomly are re-rolled, not the ones the root deck saw. The
// headers are not: `headers` are the ones evaluated with the root deck.
export function evalBlockDeck(text: string, name: string, headers: BlockHeaders, oldMemory: Memory = new Map(), additionalContext: AdditionalContext = {}): RenderLine[] {
  const [_mainBlocks, context] = evalContentsContext(text, oldMemory, additionalContext, headers)
  const lookup = context.get(name)
  if (!blockNames(headers).has(name) || typeof lookup !== 'function') return []

  const lines = lookup() satisfies RenderLine[]
  const header = headers.find(h => h?.key === name)
  if (header && isUnscheduled(header)) return lines

  const memory = context.get('memory') as Memory
  return randomizeLangUtils(context, memory).pickTasksStateless(lines)
}

export function evalContentsMem(text: string, oldMemory: Memory = new Map(), additionalContext: AdditionalContext = {}): [EvaluationResult, Memory, BlockHeaders] {
  const [mainBlocks, context, headers] = evalContentsContext(text, oldMemory, additionalContext)

  return [
    intersperse(mainBlocks.filter(b => b.length > 0), [renderLineSep()]).flat(),
    context.get('memory') as Memory,
    headers,
  ]
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

export function rotateInterpolableLine(l_: RenderLine, tag: string | null = null, mem: Memory = new Map()): RenderLine {
  const l = structuredClone(l_)

  if (l?.source?.substitutions && l?.source?.substitutions.length > 0) {
    const rotated = (l.source.substitutions || []).map(s =>
      // A tag click rotates exactly that field, even a `nonrotated` one — the tag
      // only holds it still against the whole-line ⏩.
      !isComputed(s) && (tag ? tag == s.tag : !isNonrotated(s))
        ? { ...s, contents: rotateInterpolateSubst(s.contents) }
        : s
    )

    return refreshComputedSubstitutions(l, l.source, rotated, mem)
  } else return l
}

// Re-derive each `computed` field against the given values, reusing the
// command kept on its matching interpol (matched by marker), then re-render.
function refreshComputedSubstitutions(l: RenderLine, source: NonNullable<RenderLine['source']>, substitutions: Substitution[], mem: Memory): RenderLine {
  const context = initContext(mem)
  const byMarker = new Map((source.interpols || []).map(i => [i.marker, i]))
  const newSubst = substitutions.map(s => {
    if (!isComputed(s)) return s
    const command = byMarker.get(s.marker)?.command
    if (!command) return s
    const fields = fieldsContext(substitutions.filter(o => !isComputed(o)))
    const substOut: any = executeCommand(command, context, { fields, frozen: fields })
    if (substOut?.kind === 'error') return s
    return { ...s, contents: toInterpolateSubst(substOut) }
  })

  const resubst = newSubst.reduce<RenderLine>((l, s) =>
    substituteInterpolate(l, s.marker, s.contents), { ...l, contents: source.contents }
  )

  return { ...resubst, source: { ...source, substitutions: newSubst } }
}

// Overwrite the front value of the substitution with `tag`, re-deriving the
// `computed` fields that may read it. The overwritten value is lost.
export function setSubstitutionHead(l_: RenderLine, tag: string, value: string, mem: Memory = new Map()): RenderLine {
  const l = structuredClone(l_)
  if (!l.source?.substitutions?.some(s => s.tag === tag)) return l

  const substitutions = l.source.substitutions.map(s =>
    s.tag === tag ? { ...s, contents: [value, ...s.contents.slice(1)] } : s
  )
  return refreshComputedSubstitutions(l, l.source, substitutions, mem)
}

export function emptiedInterpolations(l_: RenderLine): RenderLine {
  const l = structuredClone(l_)

  if (!l.source?.substitutions) return l
  return (l.source.substitutions || []).reduce<RenderLine>(
    (l, s) => substituteInterpolate(l, s.marker, s.contents.length === 1 ? s.contents : ['-']),
    { ...l, contents: l.source.contents },
  )
}

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
    return [s.tag || '', {
      ...s,
      contents: s.contents.slice(0, showCount(s)),
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

export function setSubstitutionContents(l_: RenderLine, marker: string, contents: InterpolateSubstT): RenderLine {
  const l = structuredClone(l_)
  if (!l.source?.substitutions) return l

  const newSubst = l.source.substitutions.map(s => s.marker === marker ? { ...s, contents } : s)

  const resubst = newSubst.reduce<RenderLine>(
    (l, s) => substituteInterpolate(l, s.marker, s.contents),
    { ...l, contents: l.source.contents },
  )

  return { ...resubst, source: { ...l.source, substitutions: newSubst } }
}
