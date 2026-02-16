export function roundToNaive(num: number, decimalPlaces: number = 0): number {
  var p = Math.pow(10, decimalPlaces)
  return Math.round(num * p) / p
}
