import { JSX, useEffect } from "react"
import * as Tone from "tone"

const metroWav = 'metro.wav'

new Audio(metroWav)

export function Metro({ bpm }: { bpm: number }): JSX.Element {
  useEffect(() => {
    console.log(bpm)
    const player = new Tone.Player(metroWav).toDestination()

    Tone.getTransport().scheduleRepeat((time) => {
      player.start(time)
    }, "4n")

    try {
      Tone.getTransport().start()
      console.log('started')
      Tone.getTransport().bpm.value = bpm
      console.log('bpm')
    } catch (e) { console.error(e) }

    return () => {
      try { Tone.getTransport().cancel() } catch (e) { console.error(e) }
      // try { player.dispose() } catch (e) { console.error(e) }
    }
  }, [bpm])

  return <></>
}
