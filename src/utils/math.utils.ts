// Returns the greatest common divisor of two integers using the Euclidean algorithm
export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
