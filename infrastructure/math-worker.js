import * as mathEngine from '../core/calculator.js';

/**
 * Worker function to execute CPU-bound mathematical operations.
 * Designed for use with Piscina worker pool to prevent main-thread blocking.
 */
export default (task) => {
  const { operation, operand1, operand2 } = task;
  let result;

  try {
    switch (operation) {
      case 'add':
        result = mathEngine.add(operand1, operand2);
        break;
      case 'subtract':
        result = mathEngine.subtract(operand1, operand2);
        break;
      case 'multiply':
        result = mathEngine.multiply(operand1, operand2);
        break;
      case 'divide':
        result = mathEngine.divide(operand1, operand2);
        break;
      case 'exponentiation':
        result = mathEngine.power(operand1, operand2);
        break;
      case 'sqrt':
        result = mathEngine.sqrt(operand1);
        break;
      case 'modulo':
        result = mathEngine.modulo(operand1, operand2);
        break;
      default:
        result = { success: false, error: 'INVALID_OPERATION' };
    }
    return result;
  } catch (err) {
    return {
      success: false,
      error: 'COMPUTATION_ERROR',
      message: err.message
    };
  }
};
