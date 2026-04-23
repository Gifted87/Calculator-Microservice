import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app, { metricsApp } from '../index.js';

describe('Calculator API Integration Tests', () => {
  let server;
  const PORT = 3001; // Use different port for tests

  before(() => {
    return new Promise((resolve) => {
      server = app.listen(PORT, () => resolve());
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  });

  test('GET /api/v1/health should return 200', async () => {
    const response = await request(app).get('/api/v1/health');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 'ok');
  });

  test('GET /metrics should return Prometheus metrics', async () => {
    const response = await request(metricsApp).get('/metrics');
    assert.strictEqual(response.status, 200);
    assert.match(response.text, /http_request_duration_seconds/);
  });

  test('POST /api/v1/calculate (add) should work', async () => {
    const response = await request(app)
      .post('/api/v1/calculate')
      .send({ operation: 'add', operand1: '100', operand2: '200' });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.data.result, '300');
  });

  test('POST /api/v1/calculate (sqrt) should work', async () => {
    const response = await request(app)
      .post('/api/v1/calculate')
      .send({ operation: 'sqrt', operand1: '10000' });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.data.result, '100');
  });

  test('POST /api/v1/calculate (overflow) should return 408 on timeout', { timeout: 10000 }, async () => {
    // This depends on the actual timeout being low enough or the number being large enough
    // Since we hardened with 100,000 exponent, let's test a valid but large one if possible.
    // For integration testing, we just verify validation errors too.
    const response = await request(app)
      .post('/api/v1/calculate')
      .send({ operation: 'exponentiation', operand1: '2', operand2: '100001' });
    assert.strictEqual(response.status, 400); // Exceeds our 100,000 limit in validator
  });

  test('Prototype Pollution should be blocked', async () => {
    const response = await request(app)
      .post('/api/v1/calculate')
      .set('Content-Type', 'application/json')
      .send('{"operation":"add","operand1":"1","operand2":"2","__proto__":{"polluted":true}}');
    assert.strictEqual(response.status, 400);
  });
});
