import { JSX, useEffect } from "react"
import * as Tone from "tone"

export function Metro(): JSX.Element {
  useEffect(() => {
    // const synth = new Tone.MembraneSynth().toDestination();

    // const synth = new Tone.MetalSynth().toDestination();
    // Tone.getTransport().scheduleRepeat((time) => {
    //   synth.triggerAttackRelease("C3", "64n", time)
    // }, "4n");

    const filter = new Tone.Filter({
      type: "lowpass",
      frequency: 400,
      Q: 5,
    }).toDestination();

    const filterEnv = new Tone.FrequencyEnvelope({
      attack: 0.002,
      decay: 0.03,
      sustain: 0,
      release: 0.01,
      baseFrequency: 800,
      octaves: 2,
    }).connect(filter.frequency);

    const synth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: {
        attack: 0.001,
        decay: 0.04,   // 20ms
        sustain: 0,
        release: 0.01,
      },
    }).connect(filter);

    // trigger: fire both envelopes together
    function tick(time: number) {
      filterEnv.triggerAttack(time);
      synth.triggerAttackRelease("G3", "32n", time);
    }

    Tone.getTransport().scheduleRepeat((time) => {
      tick(time)
    }, "4n");

    Tone.getTransport().start()
    Tone.getTransport().bpm.value = 120

    return () => { Tone.getTransport().cancel() }
  })

  return <></>
}
