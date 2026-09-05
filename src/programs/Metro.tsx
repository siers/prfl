import { JSX, useEffect, useRef } from "react"
import * as Tone from "tone"
import * as ToneLib from "../lib/ToneLib"
import { DIVISIONS, SheetNote } from "../lib/SheetNotation"

const metroWav = 'metro.wav'

new Audio(metroWav)

// A scheduled pitch: when to sound it and for how long, both in quarter notes,
// so the Transport's bpm is the only thing that turns them into seconds.
type ToneEvent = {
  pitch: string,
  time: number,
  duration: number,
}

// Notation durations are in divisions; the Transport thinks in quarter notes.
// Rests advance the clock without producing an event, and the total length is
// what the Part loops on — so a trailing rest still takes up its beats.
export function toneEvents(notes: SheetNote[]): [ToneEvent[], number] {
  let at = 0
  const events: ToneEvent[] = []

  for (const n of notes) {
    const duration = n.duration / DIVISIONS
    if (n.note) events.push({ pitch: ToneLib.render(n.note), time: at, duration })
    at += duration
  }

  return [events, at]
}

export function Metro(
  { bpm, volume = 0, tones = [] }: { bpm: number; volume?: number; tones?: SheetNote[] }
): JSX.Element {
  const playerRef = useRef<Tone.Player | null>(null)
  const synthRef = useRef<Tone.PolySynth | null>(null)

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
      player.start(time)
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
    part.start(0)

    return () => { try { part.dispose() } catch (e) { console.error(e) } }
  }, [tones])

  return <></>
}
