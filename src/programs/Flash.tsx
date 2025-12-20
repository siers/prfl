import ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'
import { prepareNext, select } from '../lib/Program'
import { chunk } from '../lib/Array'
import FlashList from './FlashList.js'

function toggleFullScreen(video) {
  if (!document.fullscreenElement) {
    video.requestFullscreen()
  } else {
    document.exitFullscreen?.()
  }
}

// % pwd | grep -q perflab$ && (jq -R -n -c '[inputs]' <(find public/ -type f | sed 's:^public/::') | sed 's/^/export default /; s:^:/* automatically generated, don'\''t touch */ :' > src/programs/FlashList.js)

function Flash(controls) {
  const directories = Object.groupBy(FlashList, f => f.match(/^[^\/]+/)[0])
  const directory = controls.state?.directory || Object.keys(directories)[0]

  prepareNext(controls, () => directory ? shuffleArray(directories[directory]) : [''])

  const next = controls?.state?.next?.at(0)

  return (
    <div className="flex flex-col w-full h-full text-center">
      <div className="directory w-full">
        directory: {select(controls, 'directory', Object.keys(directories))}
        <span className="mx-[1em]">/</span>
        <span onClick={e => { toggleFullScreen(document.getElementById('root')); e.preventDefault() }}>
          toggle full
        </span>
      </div>

      {next &&
        <div id="card" className="block flex-1 m-auto bg-contain bg-center bg-no-repeat w-full h-full" style={{backgroundImage: `url(${next})`}}>
        </div>
      }
    </div>
  )
}

export default Flash
