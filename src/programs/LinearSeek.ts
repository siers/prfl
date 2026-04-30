export enum Direction {
  Forward = 1,
  Zero = 0,
  Backward = -1,
}

export function linearSeek<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
): number[] {
  const out: (at: number) => boolean = (at: number) => at >= as.length || at < 0
  const visits: number[] = [current].filter(a => !out(a) && !exclude(as[a]))

  if (direction == 0) return visits

  do {
    current += Math.sign(direction)
    if (out(current)) break
    if (!exclude(as[current])) visits.push(current)
  } while (true)

  return visits
}

export function linearSeekNext<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
): number[] {
  return linearSeek(as, current + direction, direction, exclude)
}

export function linearSeekFull<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
): number[] {
  return linearSeek(as, current, direction, exclude).concat(linearSeek(as, current - direction, -direction, exclude))
}

export function linearSeekFullNext<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
): number[] {
  return linearSeek(as, current + direction, direction, exclude).concat(linearSeek(as, current, -direction, exclude))
}
