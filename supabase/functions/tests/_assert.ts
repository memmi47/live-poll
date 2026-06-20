/**
 * Tiny zero-dependency assertion helpers so the test suite runs in any
 * environment (no network access to deno.land / jsr required).
 */

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(msg ?? `assertEquals failed:\n  actual:   ${a}\n  expected: ${e}`);
  }
}

export function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance = 1e-7,
  msg?: string,
): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      msg ?? `assertAlmostEquals failed: |${actual} - ${expected}| > ${tolerance}`,
    );
  }
}
