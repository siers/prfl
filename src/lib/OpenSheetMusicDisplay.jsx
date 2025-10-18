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
}) => {
  const divRef = useRef(null)
  const osmdRef = useRef(null)

  const setupOsmd = () => {
    if (!divRef.current) return

    const options = { autoResize, drawTitle, drawSubtitle, drawComposer, drawPartNames }
    osmdRef.current = new OSMD(divRef.current, options)

    osmdRef.current.load(file).then(() => osmdRef.current.render())
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
