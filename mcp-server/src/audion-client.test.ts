/**
 * Tests for audion-client: missing config, 200/401/500 responses, isAudionError.
 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert';
import { audionFetch, isAudionError } from './audion-client.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.AUDION_API_URL;
  delete process.env.AUDION_API_TOKEN;
});

test('missing AUDION_API_URL or AUDION_API_TOKEN returns error object', async () => {
  process.env.AUDION_API_URL = '';
  process.env.AUDION_API_TOKEN = 'x';
  const res = await audionFetch('/health');
  assert.strictEqual(isAudionError(res), true);
  assert.strictEqual((res as { error: boolean; message: string }).message, 'AUDION_API_URL or AUDION_API_TOKEN not configured');

  process.env.AUDION_API_URL = 'http://localhost:8000';
  process.env.AUDION_API_TOKEN = '';
  const res2 = await audionFetch('/health');
  assert.strictEqual(isAudionError(res2), true);
});

test('200 response returns data and is not AudionError', async () => {
  process.env.AUDION_API_URL = 'http://localhost:8000';
  process.env.AUDION_API_TOKEN = 'audion_abc123';
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'ok' }),
    }) as Response;

  const res = await audionFetch('/health');
  assert.strictEqual(isAudionError(res), false);
  assert.deepStrictEqual(res, { status: 'ok' });
});

test('401 response returns error object', async () => {
  process.env.AUDION_API_URL = 'http://localhost:8000';
  process.env.AUDION_API_TOKEN = 'bad';
  globalThis.fetch = async () =>
    ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Invalid token' }),
    }) as Response;

  const res = await audionFetch('/auth/me');
  assert.strictEqual(isAudionError(res), true);
  const err = res as { error: boolean; message: string; status?: number };
  assert.strictEqual(err.status, 401);
  assert.ok(err.message);
});

test('500 response returns error object', async () => {
  process.env.AUDION_API_URL = 'http://localhost:8000';
  process.env.AUDION_API_TOKEN = 'x';
  globalThis.fetch = async () =>
    ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }) as Response;

  const res = await audionFetch('/health');
  assert.strictEqual(isAudionError(res), true);
  const err = res as { error: boolean; message: string; status?: number };
  assert.strictEqual(err.status, 500);
});
