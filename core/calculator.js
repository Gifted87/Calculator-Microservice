/**
 * @fileoverview High-precision computational engine using BigInt for robust arithmetic.
 */

const ZERO = 0n;
const ONE = 1n;

/**
 * @typedef {Object} CalcResult
 * @property {boolean} success
 * @property {bigint|null} result
 * @property {'DIVISION_BY_ZERO'|'INVALID_INPUT'|'OVERFLOW'|'COMPUTATION_ERROR'|null} error
 */

/**
 * Validates if the input can be treated as a BigInt.
 * @param {any} value
 * @returns {bigint|null}
 */
function toBigInt(value) {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'string' || typeof value === 'number') {
      return BigInt(value);
    }
  } catch (e) {
    return null;
  }
  return null;
}

/**
 * Adds two numbers.
 * @param {bigint|string|number} a
 * @param {bigint|string|number} b
 * @returns {CalcResult}
 */
export function add(a, b) {
  const va = toBigInt(a);
  const vb = toBigInt(b);
  if (va === null || vb === null) return { success: false, result: null, error: 'INVALID_INPUT' };
  return { success: true, result: va + vb, error: null };
}

/**
 * Subtracts b from a.
 * @param {bigint|string|number} a
 * @param {bigint|string|number} b
 * @returns {CalcResult}
 */
export function subtract(a, b) {
  const va = toBigInt(a);
  const vb = toBigInt(b);
  if (va === null || vb === null) return { success: false, result: null, error: 'INVALID_INPUT' };
  return { success: true, result: va - vb, error: null };
}

/**
 * Multiplies two numbers.
 * @param {bigint|string|number} a
 * @param {bigint|string|number} b
 * @returns {CalcResult}
 */
export function multiply(a, b) {
  const va = toBigInt(a);
  const vb = toBigInt(b);
  if (va === null || vb === null) return { success: false, result: null, error: 'INVALID_INPUT' };
  return { success: true, result: va * vb, error: null };
}

/**
 * Divides a by b using truncation.
 * @param {bigint|string|number} a
 * @param {bigint|string|number} b
 * @returns {CalcResult}
 */
export function divide(a, b) {
  const va = toBigInt(a);
  const vb = toBigInt(b);
  if (va === null || vb === null) return { success: false, result: null, error: 'INVALID_INPUT' };
  if (vb === ZERO) return { success: false, result: null, error: 'DIVISION_BY_ZERO' };
  return { success: true, result: va / vb, error: null };
}

/**
 * Exponentiation by squaring.
 * @param {bigint|string|number} base
 * @param {bigint|string|number} exponent
 * @returns {CalcResult}
 */
export function power(base, exponent) {
  let b = toBigInt(base);
  let e = toBigInt(exponent);
  if (b === null || e === null || e < ZERO) return { success: false, result: null, error: 'INVALID_INPUT' };
  
  let res = ONE;
  while (e > ZERO) {
    if (e % 2n === ONE) res *= b;
    b *= b;
    e /= 2n;
  }
  return { success: true, result: res, error: null };
}

/**
 * Integer Square root using Babylonian method.
 * @param {bigint|string|number} value
 * @returns {CalcResult}
 */
export function sqrt(value) {
  const v = toBigInt(value);
  if (v === null || v < ZERO) return { success: false, result: null, error: 'INVALID_INPUT' };
  if (v === ZERO) return { success: true, result: ZERO, error: null };
  
  // Optimization: Start with an initial guess based on bit-length.
  // We use bitwise shifts to calculate bitLength to avoid the O(N^2) overhead 
  // of converting a massive BigInt to a string.
  let bitLength = 0;
  let temp = v;
  while (temp > 0n) {
    temp >>= 64n;
    bitLength += 64;
  }
  let x = ONE << BigInt(Math.ceil(bitLength / 2));
  
  let y = (x + v / x) >> 1n;
  while (y < x) {
    x = y;
    y = (x + v / x) >> 1n;
  }
  return { success: true, result: x, error: null };
}

/**
 * Modulo operation.
 * @param {bigint|string|number} a
 * @param {bigint|string|number} b
 * @returns {CalcResult}
 */
export function modulo(a, b) {
  const va = toBigInt(a);
  const vb = toBigInt(b);
  if (va === null || vb === null) return { success: false, result: null, error: 'INVALID_INPUT' };
  if (vb === ZERO) return { success: false, result: null, error: 'DIVISION_BY_ZERO' };
  return { success: true, result: va % vb, error: null };
}
