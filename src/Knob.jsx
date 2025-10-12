import { useEffect, useCallback, useState, useRef } from 'react'
import './Knob.css'

function angleFromEvent(knob, e) {
  const c = knob.getBoundingClientRect()
  const x = (e.clientX ?? e.touches?.[0].clientX) - (c.left + c.width / 2)
  const y = (e.clientY ?? e.touches?.[0].clientY) - (c.top + c.height / 2)
  return (Math.atan2(y, x) * 180) / Math.PI + 90
}

function getCenter(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width/2, y: r.top + r.height/2 }
}

export default function Knob({running, setRunning, angle, setAngle, format, setPower, gain}) {
  const [dragging, setDragging] = useState(false)

  const knob = useRef()
  const indicator = useRef()
  const out = useRef()

  const prevAngle = useRef()

  function setAngleInternal(absAngle) {
    if (!prevAngle.current) {
      prevAngle.current = absAngle
      return
    }

    var diff = ((absAngle - prevAngle.current + 540) % 360) - 180
    prevAngle.current = absAngle

    setAngle(Math.min(60000, Math.max(250, angle + diff * gain)))
  }

  function onUp(e) {
    setDragging(false)
  }

  function onDown(e) {
    e.preventDefault()
    prevAngle.current = angleFromEvent(knob.current, e)
    setDragging(true)
  }

  function onMove(e) {
    if (!dragging) return
    setAngleInternal(angleFromEvent(knob.current, e))
  }

  function onWheel(e) {
    e.preventDefault()
    const step = Math.max(1, Math.abs(e.deltaY) < 1 ? 1 : Math.sign(e.deltaY) * 2)
    setAngleInternal(angle + (e.deltaY > 0 ? step : -step))
  }

  function onPower(e) {
    e.preventDefault()
    e.stopPropagation()
    setRunning(!running)
  }

  return (
    <div className="knob-wrap">
      <div ref={knob} className="knob" style={{transform: `rotate(${angle / gain}deg)`}} onPointerDown={onDown} onPointerUp={onUp} onPointerMove={onMove} onWheel={onWheel}>
        <div className="knob-indicator" ref={indicator}></div>
        <div className="knob-power" style={{background: running ? '#bbb' : '#333'}} onPointerDown={onPower}></div>
      </div>
      <div className="knob-out" ref={out}>{format(Math.round(angle))}</div>
    </div>
  )
}
