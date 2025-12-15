export function prepareNext(controls, makeData) {
  const {state, setState, advance} = controls

  if ((state?.next?.length || 0) < 1) {
    setState(state => ({...state, next: makeData(state)}))
  }

  if (advance && state?.next) {
    const [, ...remaining] = state?.next
    setState(state => ({...state, next: remaining}))
  }
}

export function renderNext(state, opts) {
  const next = state?.next
  const html = opts?.html || false

  return (
    <>
      {
        (next?.slice(0, opts.count || 1) || []).map((nextContent, idx) =>
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

export function fromProducer(controls, makeData, opts) {
  prepareNext(controls, makeData)
  return renderNext(controls.state, opts)
}

// doesn't work, if given as onChange to select()
// export function newBatch(controls) {
//   controls.setState(state => ({...state, next: null}))
// }

export function select(controls, name, selection, onChange) {
  const set = value => controls.setState(state => ({...state, [name]: value, next: null}))
  const current = (controls.state || {})[name] || selection[0]

  const change = e => {
    set(e.target.value)
    onChange && onChange(e.target.value)
  }

  return <select onChange={change} value={current}>
    {selection.map(p => <option value={p} key={p}>{p}</option>)}
  </select>
}
