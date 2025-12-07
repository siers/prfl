export function prepareNext(controls, makeData) {
  const {state, setState, advance} = controls

  if ((state?.next?.length || 0) < 1 || state?.restart) {
    setState(state => ({...state, restart: null, next: makeData(state)}))
  }

  if (advance && state?.next) {
    const [, ...remaining] = state?.next
    setState(state => ({...state, next: remaining}))
  }
}

export function renderNext(state, opts) {
  const next = state?.next
  const html = opts?.html || false

  const nextContent = next?.at(0)

  return (
    <>
      {html ? <div dangerouslySetInnerHTML={{__html: nextContent}} /> : nextContent}
      <br />
      queued: {next?.length ? next?.flat().length - 1 : 'n/a'}
    </>
  )
}

export function fromProducer(controls, makeData, opts) {
  prepareNext(controls, makeData)
  return renderNext(controls.state, opts)
}
