import { JSX, useEffect, useRef } from "react"
import * as Tone from "tone"
import * as ToneLib from "../lib/ToneLib"
import { DIVISIONS, SheetNote } from "../lib/SheetNotation"

const metroWav = 'metro.wav'

new Audio(metroWav)

export function unlockAudio() {
  Tone.start().catch(e => console.error(e))
}

// A scheduled pitch: when to sound it and for how long, both in quarter notes,
// so the Transport's bpm is the only thing that turns them into seconds. The
// pitch is a note name, or a raw frequency for `<442hz>` tokens — Tone takes both.
type ToneEvent = {
  pitch: string | number,
  time: number,
  duration: number,
}

// Notation durations are in divisions; the Transport thinks in quarter notes.
// Rests advance the clock without producing an event, and the total length is
// what the Part loops on — so a trailing rest still takes up its beats.
export function toneEvents(notes: SheetNote[]): [ToneEvent[], number] {
  let at = 0
  const events: ToneEvent[] = []
  // The event a tie is still growing. A tie means one sustained note written as
  // several, so the continuation must lengthen that event rather than re-attack the
  // pitch — re-attacking is exactly what a tie exists to prevent.
  let held: ToneEvent | null = null

  for (const n of notes) {
    const duration = n.duration / DIVISIONS
    // `hz` wins: it's the exact pitch, where a note name is only a grid position.
    const pitch = n.hz ?? (n.note ? ToneLib.render(n.note) : null)

    if (pitch !== null) {
      if (held && held.pitch === pitch) held.duration += duration
      else {
        const event: ToneEvent = { pitch, time: at, duration }
        events.push(event)
        held = event
      }
      // Only a tie carries into the next note; anything else ends the hold. A tie to a
      // different pitch is not a tie (that is a slur), so the pitch check above stands.
      held = n.tied ? held : null
    } else held = null

    at += duration
  }

  return [events, at]
}

// The audio for an item: a metronome click and/or a sequence of pitches, both
// on one Transport so they stay in step. Either can sound without the other —
// `click` powers the metronome, `tones` the pitches.
//
// `onClick` fires on every beat the Transport runs, so the beat can drive things
// besides sound (the `next` tag counts its steps off it). It runs outside the
// audio callback, via the draw queue, since it touches React state. The synth is
// only mounted for audible items, so a caller wanting beats must sound something.
export function Synth(
  { bpm, volume = 0, tones = [], click = true, onClick }:
    { bpm: number; volume?: number; tones?: SheetNote[]; click?: boolean; onClick?: () => void }
): JSX.Element {
  const playerRef = useRef<Tone.Player | null>(null)
  const synthRef = useRef<Tone.PolySynth | null>(null)
  // Read inside the scheduled callback, so muting the click doesn't reschedule it.
  const clickRef = useRef(click)
  clickRef.current = click
  // Same for the beat callback: a new closure each render must not reschedule.
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    const player = new Tone.Player(metroWav).toDestination()
    player.volume.value = volume
    playerRef.current = player

    // The pitches live on their own output, so the click's volume ramps
    // (used for the break fade) don't drag them along.
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    synth.volume.value = -6
    synthRef.current = synth

    Tone.getTransport().scheduleRepeat((time) => {
      if (clickRef.current) player.start(time)
      // The click is silenceable, the beat is not: `onClick` counts beats even
      // when the click itself is muted.
      const fire = onClickRef.current
      if (fire) Tone.getDraw().schedule(() => fire(), time)
    }, '4n')

    try {
      Tone.getTransport().bpm.value = bpm
      Tone.getTransport().start()
    } catch (e) { console.error(e) }

    return () => {
      playerRef.current = null
      synthRef.current = null
      try { Tone.getTransport().stop() } catch (e) { console.error(e) }
      try { Tone.getTransport().cancel() } catch (e) { console.error(e) }
      try { player.dispose() } catch (e) { console.error(e) }
      try { synth.dispose() } catch (e) { console.error(e) }
    }
  }, [])

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  useEffect(() => {
    if (playerRef.current) playerRef.current.volume.value = volume
  }, [volume])

  // A second track on the same clock: the click keeps its own scheduleRepeat,
  // this Part loops the tone sequence over the notation's own total length.
  // It is independent of `click` — pitches sound with the metronome silent.
  useEffect(() => {
    const synth = synthRef.current
    if (!synth) return

    const [events, total] = toneEvents(tones)
    if (events.length == 0 || total <= 0) return

    // Tone's `{'4n': n}` form means "n quarter notes", the unit toneEvents
    // works in — `${n}n` would mean an nth note instead.
    const part = new Tone.Part<ToneEvent>((time, e) => {
      synth.triggerAttackRelease(e.pitch, { '4n': e.duration }, time)
    }, [])

    for (const e of events) part.add({ '4n': e.time }, e)

    part.loop = true
    part.loopEnd = { '4n': total }

    // Start at the next beat rather than at 0. The component now stays mounted
    // across items (any item with tones keeps it alive), so the Transport
    // free-runs and position 0 is long past — a Part anchored there would drop
    // whichever notes fall before the current position. Quantising up to a whole
    // beat also keeps the sequence in step with the click. Ticks are used rather
    // than `nextSubdivision`, which returns context time, not Transport time.
    const transport = Tone.getTransport()
    const nextBeat = Math.ceil(transport.ticks / transport.PPQ) * transport.PPQ
    part.start(`${nextBeat}i`)

    return () => { try { part.dispose() } catch (e) { console.error(e) } }
  }, [tones])

  return <></>
}
