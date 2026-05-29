import React, { useEffect, useRef } from 'react'
import { OpenSheetMusicDisplay as OSMD } from 'opensheetmusicdisplay'

// https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/develop/src/OpenSheetMusicDisplay/OSMDOptions.ts

const OpenSheetMusicDisplay = ({
  file,
  autoResize = true,
  drawTitle = false,
  drawSubtitle = false,
  drawComposer = false,
  drawPartNames = false,
  drawingParameters = "compacttight",
}) => {
  const divRef = useRef(null)
  const osmdRef = useRef(null)

  const setupOsmd = () => {
    if (!divRef.current) return

    const options = { autoResize, drawTitle, drawSubtitle, drawComposer, drawPartNames, drawingParameters }

    osmdRef.current = new OSMD(divRef.current, options)

    osmdRef.current.load(file).then(() => {
      osmdRef.current.render()
      const osmd = osmdRef.current

      const scoreWidth = osmd.graphic.musicPages[0].musicSystems[0].PositionAndShape.size.width;
      const sheetMusicDiv = divRef.current
      const padding = (divRef.current.getBoundingClientRect().width - 35 - parseInt(scoreWidth) * 10) / 2
      sheetMusicDiv.style.marginLeft = String(padding) + "px";
    })
  }

  useEffect(() => {
    setupOsmd()

    const handleResize = () => osmdRef.current?.render()
    if (autoResize) window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [file, drawTitle, autoResize])

  return <div ref={divRef} />
}

export default OpenSheetMusicDisplay
