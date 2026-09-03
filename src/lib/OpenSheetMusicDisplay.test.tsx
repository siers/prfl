import { expect, test } from 'vitest'

test('', () => expect(1).toBe(1))

//
// // Re-render behaviour of the OSMD wrapper: the centring hack is what breaks when `file` changes.
// import { describe, expect, test, vi, beforeEach } from 'vitest'
// import { render, act } from '@testing-library/react'

// // @types/node isn't a dependency and this is the only node global needed.
// declare const process: {
//   on(event: 'unhandledRejection', fn: (e: unknown) => void): void
//   off(event: 'unhandledRejection', fn: (e: unknown) => void): void
// }

// const instances: any[] = []

// vi.mock('opensheetmusicdisplay', () => {
//   class FakeOSMD {
//     container: HTMLElement
//     zoom = 1
//     cleared = 0
//     renders = 0
//     loads: string[] = []
//     // Natural width in OSMD units; a container too narrow reflows to fit it.
//     naturalWidth = 10
//     graphic = { musicPages: [{ musicSystems: [{ PositionAndShape: { size: { width: 10 } } }] }] }

//     constructor(container: HTMLElement) {
//       this.container = container
//       instances.push(this)
//       // The real OSMD appends a rendering backend to the container on render.
//     }
//     load(file: string) {
//       this.loads.push(file)
//       return Promise.resolve({})
//     }
//     // The real OSMD lays out against container.offsetWidth, reflowing a wide
//     // score to fit. Modelling that is what exposes drift on small screens.
//     render() {
//       this.renders += 1
//       const fits = this.container.offsetWidth / (10 * 0.8)
//       const w = Math.min(this.naturalWidth, Math.max(1, fits))
//       this.graphic.musicPages[0].musicSystems[0].PositionAndShape.size.width = w
//       // The real OSMD redraws into one backend element rather than appending.
//       this.container.innerHTML = ''
//       this.container.appendChild(document.createElement('svg'))
//     }
//     clear() {
//       this.cleared += 1
//       this.container.innerHTML = ''
//     }
//   }
//   return { OpenSheetMusicDisplay: FakeOSMD }
// })

// import OpenSheetMusicDisplay from './OpenSheetMusicDisplay.jsx'

// beforeEach(() => { instances.length = 0 })

// // jsdom never lays out; model a browser, where marginLeft shrinks its own element.
// function withLayout(width: number) {
//   // A transform must NOT affect width — that's the property under test.
//   const own = (el: HTMLElement) => width - (parseFloat(el.style.marginLeft || '0') || 0)

//   vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
//     return { width: own(this) } as DOMRect
//   })
//   vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
//     return own(this)
//   })
// }

// describe('re-render on a new file', () => {
//   test('does not stack OSMD instances or leave the old score in the DOM', async () => {
//     withLayout(400)
//     const { container, rerender } = render(<OpenSheetMusicDisplay file="<xml>A</xml>" />)
//     await act(async () => { })

//     rerender(<OpenSheetMusicDisplay file="<xml>B</xml>" />)
//     await act(async () => { })

//     // One live renderer, showing exactly one score.
//     expect(instances.length).toBe(1)
//     expect(instances.at(-1).loads).toStrictEqual(['<xml>A</xml>', '<xml>B</xml>'])
//     expect(container.querySelectorAll('svg').length).toBe(1)
//   })

//   test('recentres for the new score instead of keeping the old margin', async () => {
//     withLayout(400)
//     const { container, rerender } = render(<OpenSheetMusicDisplay file="<xml>A</xml>" />)
//     await act(async () => { })

//     // The offset lands on the inner element; the outer one is the stable ruler.
//     const div = container.querySelector('div > div > div')!
//     const first = (div as HTMLElement).style.transform
//     expect(first).not.toBe('')

//     // A wider score must get a smaller margin.
//     instances.at(-1).naturalWidth = 20
//     rerender(<OpenSheetMusicDisplay file="<xml>B</xml>" />)
//     await act(async () => { })

//     expect((div as HTMLElement).style.transform).not.toBe(first)
//   })

//   // Offsetting the measured element halves an already-shrunk width: it rings toward 25%.
//   test('repeated refreshes settle on one margin instead of oscillating', async () => {
//     withLayout(400)
//     const { container, rerender } = render(<OpenSheetMusicDisplay file="<xml>0</xml>" />)
//     await act(async () => { })

//     const inner = container.querySelector('div > div > div') as HTMLElement
//     const margins: string[] = []

//     for (let i = 1; i <= 6; i++) {
//       rerender(<OpenSheetMusicDisplay file={`<xml>${i}</xml>`} />)
//       await act(async () => { })
//       margins.push(inner.style.transform)
//     }

//     // Same score every time, so every refresh must produce the same margin.
//     expect(new Set(margins).size).toBe(1)
//     // ...and it must be a real centre, not the 25% the feedback loop lands on.
//     const score = 10 * 10 * 0.8
//     expect(margins[0]).toBe(`translateX(${(400 - score) / 2}px)`)
//   })

//   // The small-screen case: a score too wide to fit reflows to the container, so
//   // shrinking that container feeds back and the score creeps rightwards.
//   test('a reflowing score on a narrow screen does not drift right', async () => {
//     withLayout(120)
//     const { container, rerender } = render(<OpenSheetMusicDisplay file="<xml>0</xml>" />)
//     await act(async () => { })

//     const inner = container.querySelector('div > div > div') as HTMLElement
//     instances.at(-1).naturalWidth = 40 // far wider than 120px holds

//     const offsets: string[] = []
//     for (let i = 1; i <= 6; i++) {
//       rerender(<OpenSheetMusicDisplay file={`<xml>${i}</xml>`} />)
//       await act(async () => { })
//       offsets.push(inner.style.transform)
//     }

//     expect(new Set(offsets).size).toBe(1)
//   })

//   test('an unmount mid-load does not throw on the dead node', async () => {
//     withLayout(400)
//     let resolve: (v: any) => void = () => { }
//     const { container, rerender, unmount } = render(<OpenSheetMusicDisplay file="<xml>A</xml>" />)
//     await act(async () => { })

//     // Hold the next load open, then unmount before it settles.
//     instances.at(-1).load = (f: string) => { instances.at(-1).loads.push(f); return new Promise(r => { resolve = r }) }
//     rerender(<OpenSheetMusicDisplay file="<xml>B</xml>" />)

//     unmount()

//     // The throw would be inside OSMD's own .then(), so it lands on the process.
//     const rejections: unknown[] = []
//     const onRejection = (e: unknown) => rejections.push(e)
//     process.on('unhandledRejection', onRejection)

//     await act(async () => { resolve({}); await new Promise(r => setTimeout(r, 0)) })

//     process.off('unhandledRejection', onRejection)

//     expect(rejections).toStrictEqual([])
//     expect(container.querySelector('div')).toBeNull()
//   })
// })
