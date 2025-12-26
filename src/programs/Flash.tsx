import * as ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'
import { prepareNext, select, restart } from '../lib/Program'
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

var preloadCache = {}

function preloadCached(list) {
  list.forEach(url => {
    if (preloadCache[url]) return
    var img = new Image()
    img.src = url

    preloadCache[url] = 1
  })
}

function Flash(controls) {
  const directories = Object.groupBy(FlashList, f => f.match(/^[^\/]+/)[0])
  const directory = controls.state?.directory || Object.keys(directories)[0]
  const current = directories[directory]

  const prepare = (opts) => prepareNext({ ...controls, ...opts }, () => directory ? shuffleArray(current) : [''])

  preloadCached(current)
  prepare()

  const queue = controls?.state?.next
  const next = queue?.at(0)
  const perc = queue ? 100 - ((queue.length - 1) / current.length * 100) : 0

  return (
    <div className="flex flex-col w-full h-full text-center">
      <div className="directory w-full">
        directory: {select(controls, 'directory', Object.keys(directories))}
        <span className="mx-[1em]">/</span>
        <span onClick={e => { toggleFullScreen(document.getElementById('card')); e.preventDefault() }}>
          full
        </span>
        <span className="mx-[1em]">/</span>
        <span onClick={e => { prepare({ restart: true }); e.preventDefault() }}>
          restart
        </span>
      </div>

      {next &&
        <div id="card" className="flex-1 m-auto bg-contain bg-center bg-no-repeat w-full h-full flex flex-col justify-end" style={{ backgroundImage: `url(${encodeURI(next)})` }}>
          <div className="progress w-full h-[4px] mb-[5px]">
            <div className="h-full bg-[#ccf]" style={({ width: `${perc.toFixed(2)}%` })} />
          </div>
        </div>
      }

      <div className="w-full h-[4px] mb-[5px]">
        <div className="h-full bg-[#ccf]" style={({ width: `${perc.toFixed(2)}%` })} />
      </div>
    </div>
  )
}

// Note for cleaning up scans: convert $i -colorspace Gray -normalize -brightness-contrast 5x40 -sharpen 0x1.5 clean-$i

export default Flash
