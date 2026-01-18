import { pick, shuffleMinDistance } from "../lib/Random"

export type Interface = {
  s: (s: string) => string[],
  ss: (s: string) => string[],
  cross: (sentence: string) => string[],
  times: <A>(n: number, a: A) => A[],
  parts: (n: number, m?: number) => string[],
  divide: <A>(as: A[], parts: number) => A[][],
  partChunks: (part: number, chunk: number, offset?: number) => string[][],
  partChunksJS: (part: number, chunk: number, offset?: number) => string[],
  mj: <A>(ass: A[][]) => string[],
  j: <A>(as: A[]) => string,
  jj: <A>(as: A[][]) => string,
  zip: (...as: string[][]) => string[],
  shuffle: <A>(a: A[]) => A[],
  pick: <A>(array: A[]) => A,
}

export function randomizeLangUtils(): Interface {
  function s(s: string): string[] {
    if (s.indexOf(' ') === -1) return s.split('')
    else return s.split(' ')
  }

  function ss(sentence: string): string[] {
    return shuffle(s(sentence))
  }

  function cross(sentence: string): string[] {
    const arrays = sentence.split(/ *x */).map(s)
    if (arrays.length > 1) {
      const [first, ...rest] = arrays
      return rest.reduce((as, others) => as.flatMap(a => others.map(o => `${a}${o}`)), first)
    } else {
      return []
    }
  }

  function times<A>(n: number, a: A): A[] {
    return Array(n).fill(a)
  }

  function parts(parts: number, offset?: number): string[] {
    return Array(parts).fill(null).map((_, i) => `${100 * (i + (offset || 0) / 100 * parts) / parts}%`)
  }

  function divide<A>(as: A[], parts: number) {
    const part = Math.floor(as.length / parts)
    const starts = Array(parts).fill(null).map((_, idx) => idx * part)
    return starts.map((start, idx) => as.slice(start, idx + 1 == starts.length ? undefined : start + part))
  }

  function partChunks(part: number, chunk: number, offset?: number): string[][] {
    return divide(parts(part, offset), chunk)
  }

  function partChunksJS(part: number, chunk: number, offset?: number): string[] {
    return mj(divide(shuffle(parts(part, offset)), chunk))
  }

  function mj<A>(ass: A[][]): string[] {
    return ass.map(as => as.join(' '))
  }

  function j<A>(as: A[]): string {
    return as.join(' ')
  }

  function jj<A>(as: A[][]): string {
    return as.map(a => a.join(' ')).join(', ')
  }

  // function zipT<A>(as: A[], bs: A[]): [A, A][] {
  //   return as.flatMap((_, i) => bs[i] ? [[as[i], bs[i]]] : [])
  // }

  function zip(...ass: string[][]): string[] {
    const minLength = ass.map(as => as.length).reduce((prev, next) => Math.min(prev, next), 100000)
    const width = Array(ass.length).fill(null).map((_, idx) => idx)
    return Array(minLength).fill(null).map((_, idx) => width.map(w => ass[w][idx]).join(''))
  }

  function shuffle<A>(a: A[]): A[] {
    return shuffleMinDistance(a, 1)
  }

  return {
    s,
    ss,
    cross,
    times,
    parts,
    divide,
    partChunks,
    partChunksJS,
    shuffle,
    zip,
    pick,
    mj,
    j,
    jj,
  }
}
