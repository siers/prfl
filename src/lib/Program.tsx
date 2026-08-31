import { JSX } from 'react'
import { shuffleArray } from '../lib/Random'

// Programs keep their own state shapes; the fields below are the ones this
// module reads and writes.
export type ProgramState = {
  next?: any[] | null
  size?: number
  lastLast?: any
  [key: string]: any
}

export type Controls = {
  state?: ProgramState | null
  setState: (next: (state: ProgramState) => ProgramState) => void
  advance?: string | boolean
  restart?: boolean
}

export type RenderOpts = {
  html?: boolean
  count?: number
}

function avoidLastFirstMatch<A>(lastLast: A | undefined, list: A[]): A[] {
  if (lastLast && list.length > 1 && lastLast == list[0]) {
    const [head, next, ...rest] = list
    return [next, ...(shuffleArray([head, ...rest]))]
  } else {
    return list
  }
}

export function prepareNext(controls: Controls, makeData: (state?: ProgramState | null) => any[]) {
  const {state, setState, advance, restart} = controls

  if (restart || (state?.next?.length || 0) < 1) {
    const last = state?.next?.at(0) || state?.lastLast
    const newData = avoidLastFirstMatch(last, makeData(state))
    setState(state => ({...state, next: newData, size: newData.length, lastLast: newData?.at(-1)}))
  } else if (advance && state?.next) {
    const [, ...remaining] = state?.next
    setState(state => ({...state, next: remaining}))
  }
}

export function renderNext(state: ProgramState | null | undefined, opts?: RenderOpts): JSX.Element {
  const next = state?.next
  const html = opts?.html || false

  return (
    <>
      {
        (next?.slice(0, opts?.count || 1) || []).map((nextContent, idx) =>
          <div key={idx}>
            { html ? <div dangerouslySetInnerHTML={{__html: nextContent}} /> : nextContent}
          </div>
        )
      }
      <br />
      queued: {next?.length ? next?.flat().length - 1 : 'n/a'}
    </>
  )
}

export function fromProducer(controls: Controls, makeData: (state?: ProgramState | null) => any[], opts?: RenderOpts): JSX.Element {
  prepareNext(controls, makeData)
  return renderNext(controls.state, opts)
}

// doesn't work, if given as onChange to select()
// export function newBatch(controls) {
//   controls.setState(state => ({...state, next: null}))
// }

export function select(
  controls: Controls,
  name: string,
  selection: string[],
  onChange?: (value: string) => void,
): JSX.Element {
  const set = (value: string) => controls.setState(state => ({...state, [name]: value, next: null}))
  const current = (controls.state || {})[name] || selection[0]

  const change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    set(e.target.value)
    onChange && onChange(e.target.value)
  }

  return <select onChange={change} value={current}>
    {selection.map(p => <option value={p} key={p}>{p}</option>)}
  </select>
}
