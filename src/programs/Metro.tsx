import { JSX, useEffect } from "react"
import * as Tone from "tone"

const metroWav = 'metro.wav'

new Audio(metroWav)

function setupMetronome(bpm: number) {
  const player = new Tone.Player(metroWav).toDestination()

  Tone.getTransport().scheduleRepeat((time) => {
    player.start(time)
  }, '4n')

  try {
    Tone.getTransport().start()
    Tone.getTransport().bpm.value = bpm
  } catch (e) { console.error(e) }
}

export function Metro({ bpm }: { bpm: number }): JSX.Element {
  useEffect(() => {
    setTimeout(() => setupMetronome(bpm), 0)

    return () => {
      try { Tone.getTransport().cancel() } catch (e) { console.error(e) }
      // try { player.dispose() } catch (e) { console.error(e) }
    }
  }, [])

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  return <></>
}
