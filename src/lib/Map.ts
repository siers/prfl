export function mapSerialize<A, B>(m: Map<A, B>): string {
  return JSON.stringify(Array.from(m.entries()))
}

export function mapParse<A, B>(s: string): Map<A, B> {
  return new Map(JSON.parse(s))
}

export function mapCopy<A, B>(m: Map<A, B>): Map<A, B> {
  return mapParse(mapSerialize(m))
}
