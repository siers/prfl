import { JSX } from 'react'

// Declaration for the OpenSheetMusicDisplay.jsx wrapper. Options mirror
// https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/develop/src/OpenSheetMusicDisplay/OSMDOptions.ts
export type OpenSheetMusicDisplayProps = {
  file: string
  autoResize?: boolean
  drawTitle?: boolean
  drawSubtitle?: boolean
  drawComposer?: boolean
  drawPartNames?: boolean
  drawingParameters?: string
}

declare const OpenSheetMusicDisplay: (props: OpenSheetMusicDisplayProps) => JSX.Element
export default OpenSheetMusicDisplay
