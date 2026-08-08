import { directRange } from "./Array"

export function isPrime(i: number): boolean {
  return !directRange(2, Math.ceil(i / 2)).some(f => i % f == 0)
}

function getUniqueFactors(num: number): number[] {
  return directRange(2, num).filter(i => num % i === 0 && isPrime(i))
}

export function uniquePrimeFactors(maxNum: number) {
  return directRange(1, maxNum).map(i => {
    const factors = getUniqueFactors(i)
    return { number: i, factors: factors, count: factors.length }
  })
    .sort((a, b) => -(a.count !== b.count ? a.count - b.count : a.number - b.number))
    .map(n => [n.number, n.factors])
}
