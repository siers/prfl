import { renderToString } from 'react-dom/server'
import React, { JSX, MouseEventHandler, RefObject, useEffect, useRef } from 'react'

import { emptiedInterpolations, interpolateSubtToString, interpolateSubtToStringPlain, renderLineContentWithTags } from './RandomizeLang.js'
import { ContentOrTag, makeEmptyMemory, RenderLine, Substitution } from './RandomizeLangTypes.js'
import { CardData, UserItem, findCard } from './RandomizeTypes.js'
import { Timer, padRight, timerLength, hm_ms, ms, hoursBetweenNow } from './Timers.ts'

import { mapParse } from '../lib/Map.js'

import murmur from 'murmurhash3js'
import { clamp, parseInt } from 'lodash'
import { linearSeekNext } from './LinearSeek.ts'
import { DeckCursor, Decks, DEFAULT_DECK, decksOf, deckItems, deckGet } from './Decks.ts'
import { Metro as MetroComponent } from './Metro.tsx'
import SheetOSMD from './SheetOSMD.tsx'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Args, Metro, RState, TimerCommand,
  currentStateVersion, defaultBpm, defaultState,
  deckPath, itemSkipped, reduceMetro, reducePopOne, reducePopTo, reduceRecalc, reduceSpawn, reduceTimer,
} from './RandomizeState.ts'
import { SpawnMode, isSpawnable } from './RandomizeDecks.ts'
import { burstEmojiNotif } from './Burst.tsx'
import { SwipeDirection, useWipe } from './SwipeHandlers.tsx'
import { DrivePicker } from './DrivePicker.tsx'

function memoryFromString(mem?: string) {
  return (mem && mapParse(mem)) || makeEmptyMemory()
}

function findCardFromMemory(memory?: string, item?: UserItem): CardData | null {
  return findCard(memoryFromString(memory), item?.key || '')
}

function Randomize(controls: any): JSX.Element {
  const { setState, advanceRef } = controls

  const state: RState = controls.state || defaultState // this is no longer possibly any, so there are a lot of question marks still scattered around
  const stateVersion = state && state.version || 0

  useEffect(() => {
    if (!controls.state) { setState((_: any) => defaultState); return }
    if (stateVersion != 0 && stateVersion != currentStateVersion) setState((_: any) => null)
  }, [controls.state, stateVersion])

  const decks: Decks<UserItem> = state?.items || decksOf<UserItem>([])
  const outLineCount: number = state?.outLineCount || 0

  const current: DeckCursor = state?.current || [DEFAULT_DECK, 0]
  // The cursor's deck flattened out, plus the in-deck index — the rest of the
  // render code still works against a single flat list.
  const items: UserItem[] = deckItems(decks, current[0])
  const currentIndex: number = current[1]

  const globalTimer = (state.cursorStack?.length != 0 ? deckGet(decks, state.cursorStack?.at(-1))?.timer : undefined) || state.totalTimer
  const localTimer = deckGet(decks, current)?.timer
  const localTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))
  const totalTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))

  const inExecution: boolean = state?.execute === true
  const inPlanning: boolean = state?.execute !== true

  const hideDone = state?.hideDone !== false

  function renderTimerToRef(ref: RefObject<HTMLDivElement>, timer: Timer | undefined, type: 'local' | 'global') {
    ref.current && (ref.current.innerHTML = renderToString(timerContent(timer, type)))
  }

  function itemSeekExcluded(item: UserItem): boolean {
    return hideDone && itemSkipped(item)
  }

  useEffect(() => {
    if (state?.execute !== true) return () => { }
    const id = setInterval(() => { renderTimerToRef(totalTimerRef, globalTimer, 'global'); renderTimerToRef(localTimerRef, localTimer, 'local') }, 45.33)
    return () => clearInterval(id)
  }, [items, current[0], current[1], globalTimer, state?.execute])

  advanceRef.current = (advance: string | boolean, _event: any) => {
    const advanceDelta =
      advance == 'next'
        ? 1
        : advance == 'prev'
          ? -1 :
          advance ? 1 : 0

    if (advanceDelta == 0) return

    // if (Math.abs(advanceDelta) == 1 && current + 1 == outLineCount) recalc({ eval: true })
    if (Math.abs(advanceDelta) == 1) recalc({ advance: ['seek', advanceDelta] })
  }

  useEffect(() => {
    if (state?.text && items.length == 0) recalc({ eval: true })
  }, [])

  useEffect(() => {
    if (state === null || items.length == 0) return () => { }
    if (inPlanning && localTimer?.kind !== 'stopped') modifyTimer('stop')
  }, [items.length && items || null, current[0], current[1], inExecution])

  // Thin wrappers over the pure reducers in RandomizeState: bind setState and
  // inject the bits the reducers need (bpm, now). All the actual state logic —
  // and its tests — live in that module.
  function recalc(a: Args) {
    setState((s: RState | undefined) => {
      const calc = reduceRecalc(s, a, { hideDone: s?.hideDone, bpm: s?.metro?.bpm || defaultBpm, now: Date.now() })
      a.burst && burstEmojiNotif(a.burst)
      return calc
    })
  }

  function modifyTimer(commandIn: TimerCommand, target: null | 'local' = null) {
    setState((s: RState | undefined) => reduceTimer(s, commandIn, target, Date.now()))
  }

  function toggleCountTotal() {
    setState((s: RState | undefined) => s && { ...s, countTotal: !s.countTotal })
  }

  function spawn(mode: SpawnMode) {
    setState((s: RState | undefined) => reduceSpawn(s, mode, Date.now()))
  }

  function popOut() {
    setState((s: RState | undefined) => reducePopOne(s, Date.now()))
  }

  function popToLevel(level: number) {
    setState((s: RState | undefined) => reducePopTo(s, level, Date.now()))
  }

  // UI

  function timerContent(timer: Timer | undefined, type: 'local' | 'global'): string {
    const format: (a: number) => string = type == 'local' ? ms : hm_ms
    const formatted = (timer: Timer) => padRight(format(timerLength(timer, Date.now())), 10, ' ')
    return (timer && (formatted(timer))) || ''
  }

  function planningControlButtons(): JSX.Element {
    return <>
      { /* <a className="pr-3 select-none" style={state?.nextMemory ? {} : { opacity: '50%' }} onClick={() => recalc({ save: true })}>💾</a> */}
      <a className="pr-3 select-none" onClick={() => recalc({ eval: true, })}>🔄</a>
      <a className="pr-3 select-none" onClick={() => confirm('delete?') && recalc({ eval: true, contents: '', execute: false })}>❌{/* right now this breaks history of textarea */}</a>
      <DrivePicker
        onLoad={text => recalc({ contents: text, eval: true })}
        onImages={images => setState((s: RState | undefined) => s && { ...s, images })}
      />

      <span className="pr-3">
        {state?.outLineCount ? <>{state?.outLineCount} items</> : <></>}
      </span>
      <span className="pr-3 text-[#f4f4f4]">
        {state?.memory && Math.abs(murmur.x86.hash32(state.memory)) % 10000}
      </span>
    </>
  }

  function executionControlButtons(): JSX.Element {
    const nested = (state?.cursorStack?.length || 0) > 0
    return <>
      <a className="pr-3 select-none" style={{ opacity: hideDone ? '0.5' : '1' }} onClick={() => recalc({ hideDone: !hideDone, })}>👁️</a>
      <a className="pr-3 microbreak-button select-none" onClick={e => microBreakTransparencyControl(e)}>🅱️</a>
      <a className="pr-3 metro-button select-none" onClick={_ => metroState({ opened: !metro.opened })}>🥁</a>
      <a className="pr-3" onClick={event => advanceRef.current('prev', event)}>⬅️</a>
      <a className="pr-3" onClick={event => advanceRef.current('next', event)}>➡️</a>
      {nested && <a className="pr-3 select-none" title="leave deck, go back" onClick={_ => popOut()}>🔙</a>}
    </>
  }

  // Breadcrumb of the deck path; each crumb but the last pops back to its level.
  function breadcrumb(): JSX.Element | null {
    const path = deckPath(state)
    if (path.length <= 1) return null // top level — nothing to show
    return <div className="w-full px-3 pt-1 text-xs text-center text-black select-none">
      {path.map((deck: string, i) => {
        const isLast = i === path.length - 1
        return <span key={i}>
          {i > 0 && <span className="px-1">▸</span>}
          <span className={isLast ? '' : 'cursor-pointer'} onClick={_ => !isLast && popToLevel(i)}>{deck}</span>
        </span>
      })}
    </div>
  }

  function editor(): JSX.Element {
    const lines = items.map(rl => rl.contents).join('\n')

    return <div className={"w-[100dvwh] flex flex-row selection:red text-sm "} style={({ height: "calc(90dvh)" })}>
      <div className="grow p-[10px]">
        <textarea className="block w-full h-full p-[5px] border" cols={130} onChange={e => recalc({ contents: e.target.value, eval: true })} value={state?.text}></textarea>
      </div>

      <div className="grow p-[10px]">
        <textarea className="block w-full h-full p-[5px] border font-mono" cols={130} value={lines} readOnly></textarea>
      </div>
    </div>
  }

  function itemStyle(item: UserItem, index: number): React.CSSProperties {
    const card = findCardFromMemory(state.memory, item)
    const color =
      index == currentIndex ? undefined
        : item.done && hoursBetweenNow(card?.reviewed) > 12 ? 'red'
          : item.done ? '#4caf50'
            : timerLength(item.timer || null, Date.now()) >= 180 ? 'orange'
              : '#bbb'
    return {
      ...(index == currentIndex && { fontSize: '2rem' }),
      ...(color && { color })
    }
  }

  function renderContentWithTags(item: RenderLine) {
    const [contentTags, lookupTag] = renderLineContentWithTags(item)
    return <>
      {
        contentTags.map((ct: ContentOrTag, idx: number) =>
          <span key={idx} onClick={_ => ct[0] == 'tag' && recalc({ item: { 'regenerate': 'next', 'regenerateKey': ct[1] } })}>
            {ct[0] == 'string' ? ct[1] : interpolateSubtToString((lookupTag.get(ct[1]) as Substitution).contents)}
          </span>
        )
      }
    </>
  }

  function itemRender(): JSX.Element {
    const shownItems: [UserItem, number][] = [-1, 0, 1].flatMap(delta => {
      const found = linearSeekNext(items, currentIndex, delta, itemSeekExcluded)
        .slice(0, delta == 0 ? 1 : Math.abs(delta * 2))
        .map(idx => [items[idx], idx] satisfies [UserItem, number])

      return delta == -1 ? found.reverse() : found
    })

    items.length > 0 && shownItems.length == 0 && shownItems.push([items[currentIndex], currentIndex])

    return <>
      {shownItems.map(([item, index]) => {
        const isCurrent = index == currentIndex
        const showReeval = isCurrent && (items[currentIndex]?.source?.interpols?.length || 0) > 0
        const showSpawn = isCurrent && isSpawnable(item)
        const showCheckmark = isCurrent && itemSeekExcluded(item)

        let wipeHandlers = useWipe((d: SwipeDirection) => {
          if (d == 'E') itemReview()
          if (d == 'W') itemSuspend()
          if (d == 'N') itemSurface()
          if (d == 'S') itemBury()
        })
        wipeHandlers.style = { ...wipeHandlers.style, ...itemStyle(item, index) }

        return <div key={index} className="w-full text-center text-wrap" onClick={_ => recalc({ advance: ['set', index] })} {...wipeHandlers}>
          {
            showCheckmark ? <>✅</> : <>
              {isCurrent || !hideDone ? renderContentWithTags(item) : emptiedInterpolations(item).contents}
              {showReeval && <a className="pl-3 select-none" onClick={() => recalc({ item: { regenerate: 'new' } })}>🔄</a>}
              {showReeval && <a className="pl-3 select-none" onClick={() => recalc({ item: { regenerate: 'next' } })}>⏩</a>}
              {showSpawn && <a className="pl-3 select-none" title="spawn zipped deck" onClick={e => { e.stopPropagation(); spawn('zip') }}>⛓️</a>}
              {showSpawn && <a className="pl-3 select-none" title="spawn cartesian deck" onClick={e => { e.stopPropagation(); spawn('cartesian') }}>🧬</a>}
            </>
          }
        </div>
      })}
    </>
  }

  function microBreakTransparencyControl(e: React.MouseEvent<HTMLAnchorElement>) {
    const breakMin = 10000
    const breakMax = 15000

    const elem = e.currentTarget
    const animKey = `${parseInt(elem.dataset.animationKey || '0') + 1}`
    elem.dataset.animationKey = animKey
    const timeout = 50

    const nextFrame = (key: string, start: number) => {
      const now = Date.now()
      const progress = clamp((now - start - breakMin) / (breakMax - breakMin), 0, 1)
      const opacity = Math.pow(progress, 1.6) // ease-in

      if (!(elem.dataset.animationKey == key && opacity < 1)) return metroState({ volume: 0 })

      elem.style.opacity = `${Math.round(opacity * 100)}%`

      // const cutoff = breakMin / breakMax
      const volume = -100 * (1 - progress)
      metroState({ volume: volume })

      setTimeout(() => nextFrame(key, start), timeout)
    }
    setTimeout(() => nextFrame(animKey, Date.now()), timeout)
  }

  function metroState(diff: Metro) {
    setState((sIn: RState | undefined) => reduceMetro(sIn, diff))
  }

  function itemReview() {
    recalc({ item: { reviewed: true, done: true, bury: false }, burst: '✅' })
  }

  function itemBury() {
    recalc({ item: { reviewed: false, done: false, bury: true }, burst: '✘' })
  }

  function itemSuspend() {
    recalc({ item: { reviewed: false, done: true, bury: false }, burst: '📚' })
  }

  function itemSurface() {
    recalc({ item: { unreview: true }, burst: '🌟' })
  }

  function reviewStats(): JSX.Element {
    // probably unit-tests use these
    const timerControls = <>
      <span onClick={() => modifyTimer(localTimer?.running ? 'stop' : 'start')} className="pb-3 px-2 select-none">{localTimer?.running ? '⏸️' : '▶️'}</span>
      <span onClick={() => modifyTimer('restart', 'local')} className="pb-3 px-2 select-none">🔄</span>
      <span onClick={() => modifyTimer('subtract-and-restart')} className="pb-3 px-2 select-none">⏪</span>
    </>

    // unit-tests still use these
    const reviewControls = <>
      <a className="pr-4 select-none" onClick={() => itemReview()}>✅</a>
      <a className="pr-4 select-none" onClick={() => itemBury()}>✘</a>
      <a className="pr-4 select-none" onClick={() => itemSuspend()}>📚</a>
      <a className="pr-4 select-none" onClick={() => itemSurface()}>🌟</a>
    </>

    const currentMap = items.flatMap((i, ith) => itemSkipped(i) ? [] : [ith]).map((ith, jth) => [ith, jth])
    const shownItemNr = Object.fromEntries(currentMap)[currentIndex]
    const currentItemNr = 1 + (hideDone ? shownItemNr : currentIndex)
    const undoneCount = currentMap.length

    const countTotal = state?.countTotal === true
    const denominator = countTotal ? outLineCount : undoneCount
    const itemCounter = <span className="cursor-pointer select-none" onClick={toggleCountTotal} title={countTotal ? 'total items' : 'remaining items'}>
      {currentItemNr || '-'}/{denominator}
    </span>

    let timerLock: number | undefined
    const timerWipe = useWipe(d => {
      timerLock = undefined
      d == 'W' && modifyTimer('subtract-and-restart')
      d == 'N' && modifyTimer('restart', 'local')
    })
    const localTimerMouseUp: MouseEventHandler<HTMLDivElement> = (_) => {
      if (timerLock != undefined) modifyTimer(localTimer?.running ? 'stop' : 'start')
    }

    return <div className="w-full pb-2 text-center font-mono">
      <div className="flex flex-row justify-center pt-2">
        <div className="px-4 w-[7em] text-[#888]" ref={totalTimerRef}></div>
        <div className="px-2 w-[7em] text-center" {...timerWipe} onMouseDown={_ => { timerLock = Math.random() }} onMouseUp={localTimerMouseUp} ref={localTimerRef}></div>
        <div className="px-4 w-[7em] text-[#888] text-right">{itemCounter}</div>
      </div>

      {/* streamlined away */}
      <div className="flex flex-row justify-center pt-2 hidden">
        <div className="text-left px-5 hidden">{reviewControls}</div>
        <div className="text-right px-5 hidden">{timerControls}</div>
      </div>
    </div>
  }

  const metro: Metro = state?.metro || { bpm: defaultBpm }
  const metroBpm: number = metro.bpm || defaultBpm

  const ticking = !!globalTimer?.running
  const metroPower = ticking && metro.power

  const delinearize = (n: number, low: number, high: number) => (1 - Math.sqrt(1 - (n / 1000))) * (high - low) + low
  const linearize = (n: number, low: number, high: number) => (1 - Math.pow(1 - (n - low) / (high - low), 2)) * 1000

  function metroUI() {
    return <div className="w-full top-0 left-0 p-3 flex-0 font-mono">
      <div className="text-center">
        <div><input type="range" className="w-[80%]" value={linearize(metroBpm, 20, 500)} onChange={e => metroState({ bpm: delinearize(parseInt(e.target.value), 20, 500) })} min={1} max={1000} /></div>
        <div>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metroBpm - 1 })}>-1</span>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metroBpm - 5 })}>-5</span>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metroBpm * 0.5 })}>÷2</span>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metroBpm * 0.333333 })}>÷3</span>
          <span
            className="p-[2px] inline-block text-center w-[4em]"
            onClick={_ => ticking && metroState({ power: !metro.power })}
            style={{ color: metroPower ? '#000' : '#aaa' }}
          >
            @{state?.metro?.bpm}
          </span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metroBpm * 3 })}>3×</span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metroBpm * 2 })}>2×</span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metroBpm + 5 })}>5+</span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metroBpm + 1 })}>1+</span>
        </div>
      </div>
    </div>
  }

  // Image block, sibling of sheetDisplay in the flex container. Every
  // substitution whose tag contains "image" (e.g. image, image1, image2)
  // contributes one image: take the first value in its contents list and
  // substring-match it against the loaded image filenames. Tags are sorted by
  // name so image1/image2/... display in a stable order.
  function imageDisplay(tags: Substitution[]) {
    const images = state?.images || []
    const matches = tags
      .filter((t): t is Substitution & { tag: string } => !!t.tag && t.tag.includes('image'))
      .sort((a, b) => a.tag.localeCompare(b.tag))
      .flatMap(t => {
        const needle = t.contents[0]
        if (!needle) return []
        const hit = images.find(([filename]) => filename.includes(needle))
        return hit ? [hit] : []
      })

    if (matches.length === 0) return null

    return <div className="flex flex-col items-center grow">
      {matches.map(([filename, url], i) =>
        <img key={i} src={url} alt={filename} title={filename} className="max-w-full max-h-full object-contain" />
      )}
    </div>
  }

  function sheetDisplay(tags: Substitution[]) {
    const params = Object.fromEntries(tags.filter(t => t.tag).map(t => [t.tag, interpolateSubtToStringPlain(t.contents).split(' ')[0]]))

    return <div className="flex flex-col font-mono items-center grow">
      <div className="w-full">
        <ErrorBoundary fallback={<>sheet rendering crash</>}>
          <SheetOSMD params={params} />
        </ErrorBoundary>
      </div>
    </div>
  }

  return (
    <div className="w-full">
      <div className="pl-[10px]">
        <a className="pr-3 select-none" onClick={() => { recalc({ execute: !inExecution }); !inExecution && modifyTimer('start') }}>{state?.execute ? '↩️' : '▶️'}</a>
        {inPlanning && planningControlButtons()}
        {inExecution && executionControlButtons()}
      </div>

      {inPlanning && editor()}

      {inExecution &&
        <div className="relative">
          <div className={"w-[100dvw] flex flex-col justfiy-center"} style={({ height: "calc(90dvh)" })}>
            {reviewStats()}
            {breadcrumb()}

            <ErrorBoundary fallback={<>item render crash</>}>
              <div className="relative w-full flex flex-col flex-grow select-none">
                <div className="flex-1 content-center">
                  {itemRender()}
                </div>

                {items[currentIndex]?.key?.match(/DS$/) && sheetDisplay(items[currentIndex]?.source?.substitutions || [])}

                {imageDisplay(items[currentIndex]?.source?.substitutions || [])}

                {metro.opened && metroUI()}
                {metroPower && <MetroComponent bpm={metroBpm} volume={metro.volume || 0} />}
              </div>
            </ErrorBoundary>
          </div>
        </div>
      }
    </div>
  )
}

export default Randomize

// gen_tracker_id() { pwgen 4 1 | tr -d '\n' | tr 'a-z' 'A-Z' | xclip; }

// TODO: content: pickKeys (zip(letter, accidental))

// TODO: execution: make items clickable, hide nonreviewed (timeout?), make them scrollable, make items movable
// TODO: execution: highlight parameters
// TODO: content: scales: bowings/delete notes replace with pauses
// TODO: content: scales: remove half-positions in ToneLibViolin
// TODO: parametrization: these could be scheduled with no random (maybe)
// TODO: combinatorics: flip versions, remove unique (scales markov)
// TODO: review: accumulate review time
// TODO: content: scales diatonic zip, check out other zips?
// TODO: scheduling: randomness param
// TODO: scheduling: check that for two/three items, random doesn't screw with it

// TODO: scheduling: make item heavier for the scheduler depending on a tag (7RZH)
// TODO: scheduling: queue: pick after every card, because otherwise suspending inside of a zipScheduleBlocks is weird
// TODO: execution: (7RZH) make items just pointers, allowing for refreshing of cards while in the list
// TODO: execution: save card reviews in a list, with review lengths
// TODO: execution: indicate tasks which are complete fresh (no review or the time put in is small, schedule fewer fresh ones)
// TODO: subprogram: drones

// TODO: lang: add tags to block, only main blocks may have items without keys
// TODO: content: instead of warmup + aba(block(), block()), make warmup addable optionally (MD4F), then zipped priority cards + non-prio
// TODO: content: (MD4F) would require a special action for that would influence the deck

// TODO: execution: interpolations must be orderable by frequency the same way subdecks would
// TODO: parametrization: enable subsets of a column, allow shuffling per-column
// TODO: parametrization: sample hyperspace (pretty unlikely to be done, requires order of items, are the tails sown together?)

// TODO: content: anki flashcards for all interval pairs between strings or within a string (q: two notes, a: how many semitones apart if projected on to the same string)

// TODO: backlog: state: use a CRDT-storage server
// TODO: backlog: state: check if I can read anki database locally
// TODO: backlog: metronome: power status is false on start unless permissions are correct
// TODO: backlog: metronome: tap to get rhythm
// TODO: backlog: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: backlog: scheduling: give "gas" to tasks, so they get temporarily bumped (solved by "bury" button and dynamic scheduling by date)

// TODO: closed: execution: rerandomizeable blocks (can't imagine a way to achieve this, but try thinking of a good usecase first)
// TODO: closed: how to balance random exposition with integration cards (subdecks may help) (a: just use interpolations as exposition starting points, problem solved)
