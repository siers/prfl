import { JSX, useEffect } from "react"
import * as Tone from "tone"

const metroWav = 'metro.wav'

new Audio(metroWav)

export function Metro({ bpm }: { bpm: number }): JSX.Element {
  useEffect(() => {
    const player = new Tone.Player(metroWav).toDestination()

    Tone.getTransport().scheduleRepeat((time) => {
      player.start(time)
    }, '4n')

    try {
      Tone.getTransport().bpm.value = bpm
      Tone.getTransport().start()
    } catch (e) { console.error(e) }

    return () => {
      try { Tone.getTransport().stop() } catch (e) { console.error(e) }
      try { Tone.getTransport().cancel() } catch (e) { console.error(e) }
      try { player.dispose() } catch (e) { console.error(e) }
    }
  }, [])

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  return <></>
}
