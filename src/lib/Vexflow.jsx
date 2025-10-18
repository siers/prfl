import React, { useRef, useEffect, useId } from 'react'
import { Factory } from 'vexflow'

export function Score({
  notes = [],
  clef = 'treble',
  timeSignature = '4/4',
  width = 250,
  height = 250,
}) {
  const id = useId()

  useEffect(() => {
    const factory = new Factory({renderer: {elementId: id, width, height}})

    const score = factory.EasyScore()
    const system = factory.System()

    const voice = score.voice(score.notes(notes, { stem: 'up' }))

    system
      .addStave({voices: [voice]})
      .addClef(clef)
      .addTimeSignature(timeSignature)

    factory.draw()

    return () => {
      const el = document.getElementById(id)
      el && (el.innerHTML = '')
    }
  }, [notes, clef, timeSignature, width, height])

  return <div id={id} />
}
