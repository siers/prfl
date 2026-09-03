import React, { useEffect, useRef } from 'react'
import { OpenSheetMusicDisplay as OSMD } from 'opensheetmusicdisplay'

// https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/develop/src/OpenSheetMusicDisplay/OSMDOptions.ts

const ZOOM = 0.8

// OSMD's own units; 10 converts them to px at zoom 1.
const OSMD_UNIT_PX = 10

const OpenSheetMusicDisplay = ({
  file,
  autoResize = true,
  drawTitle = false,
  drawSubtitle = false,
  drawComposer = false,
  drawPartNames = false,
  drawingParameters = "compacttight",
}) => {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const osmdRef = useRef(null)

  // A transform, not a margin: OSMD lays out against its container's offsetWidth.
  const centre = () => {
    return
    // const outer = outerRef.current
    // const inner = innerRef.current
    // const osmd = osmdRef.current
    // if (!outer || !inner || !osmd) return

    // const system = osmd.graphic?.musicPages?.[0]?.musicSystems?.[0]
    // if (!system) return

    // const scoreWidth = system.PositionAndShape.size.width * OSMD_UNIT_PX * ZOOM
    // const padding = (outer.getBoundingClientRect().width - scoreWidth) / 2

    // // A score wider than its container would otherwise go off the left edge.
    // inner.style.transform = `translateX(${Math.max(0, padding)}px)`
  }

  useEffect(() => {
    if (!innerRef.current) return

    // OSMD's own autoResize re-renders without recentring, so we drive resize.
    const options = { autoResize: false, drawTitle, drawSubtitle, drawComposer, drawPartNames, drawingParameters }

    // A second OSMD on the same div leaves the previous one's SVG behind.
    if (!osmdRef.current) osmdRef.current = new OSMD(innerRef.current, options)

    const osmd = osmdRef.current
    osmd.zoom = ZOOM

    // load() is async: only the newest may draw, and not onto a dead node.
    let current = true

    osmd.load(file).then(() => {
      if (!current || !innerRef.current) return
      osmd.render()
      centre()
    })

    const handleResize = () => {
      if (!osmdRef.current || !innerRef.current) return
      osmdRef.current.render()
      centre()
    }
    if (autoResize) window.addEventListener('resize', handleResize)

    return () => {
      current = false
      window.removeEventListener('resize', handleResize)
    }
  }, [file, drawTitle, drawSubtitle, drawComposer, drawPartNames, drawingParameters, autoResize])

  // Drop the renderer only when the component actually goes away.
  useEffect(() => () => {
    osmdRef.current?.clear()
    osmdRef.current = null
  }, [])

  // Full width, or an ancestor's `items-center` shrinks the ruler to the score.
  return <div ref={outerRef} style={{ width: '100%' }}><div ref={innerRef} /></div>
}

export default OpenSheetMusicDisplay
