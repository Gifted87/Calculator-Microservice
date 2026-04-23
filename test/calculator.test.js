import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as calculator from '../core/calculator.js';

describe('Calculator Engine Unit Tests', () => {
  test('addition should work correctly', () => {
    const result = calculator.add(10, 20);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, 30n);
  });

  test('subtraction should work correctly', () => {
    const result = calculator.subtract(50, 25);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, 25n);
  });

  test('division by zero should return error', () => {
    const result = calculator.divide(10, 0);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'DIVISION_BY_ZERO');
  });

  test('sqrt of large BigInt should be efficient', () => {
    const large = 10n ** 100n;
    const result = calculator.sqrt(large);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, 10n ** 50n);
  });
});
