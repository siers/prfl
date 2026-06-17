import { JSX, useEffect, useRef } from "react"
import * as Tone from "tone"

const metroWav = 'metro.wav'

new Audio(metroWav)

export function Metro({ bpm, volume = 0 }: { bpm: number; volume?: number }): JSX.Element {
  const playerRef = useRef<Tone.Player | null>(null)

  useEffect(() => {
    const player = new Tone.Player(metroWav).toDestination()
    player.volume.value = volume
    playerRef.current = player

    Tone.getTransport().scheduleRepeat((time) => {
      player.start(time)
    }, '4n')

    try {
      Tone.getTransport().bpm.value = bpm
      Tone.getTransport().start()
    } catch (e) { console.error(e) }

    return () => {
      playerRef.current = null
      try { Tone.getTransport().stop() } catch (e) { console.error(e) }
      try { Tone.getTransport().cancel() } catch (e) { console.error(e) }
      try { player.dispose() } catch (e) { console.error(e) }
    }
  }, [])

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  useEffect(() => {
    if (playerRef.current) playerRef.current.volume.value = volume
  }, [volume])

  return <></>
}
