export enum Direction {
  Forward = 1,
  Zero = 0,
  Backward = -1,
}

export function linearSeekPast<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
  outPermitted: number = 1, // number of times you may go outside array bounds
  next: number = 0, // swallow N matches
): number[] {
  const out: (at: number) => boolean = (at: number) => at >= as.length || at < 0
  const visits: number[] = []

  do {
    if (out(current)) {
      if (outPermitted <= 0) break
      else {
        outPermitted--;
        visits.push(current)
        continue
      }
    }
    if (!exclude(as[current])) {
      if (next <= 0) visits.push(current)
      next--
    }

    if (direction == 0) break
    else current += Math.sign(direction)
  } while (true)

  return visits
}

export function linearSeek<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
): number[] {
  return linearSeekPast(as, current, direction, exclude, 0)
}

export function linearSeekNext<A>(
  as: A[],
  current: number,
  direction: Direction,
  exclude: (a: A) => boolean,
): number[] {
  return linearSeekPast(as, current, direction, exclude, 0, 1)
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
