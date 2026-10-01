import test from 'node:test';
import assert from 'node:assert';
import {
  audionWebUrlMisconfigMessage,
  formatFastApiErrorDetail,
  isAudionFastApiHealthPayload,
  isAudionV3HealthPayload,
  isAudionWebHealthPayload,
  isHtmlOrLoginBody,
} from './audion-api-detect.js';

test('detects Next.js web health payload', () => {
  assert.equal(
    isAudionWebHealthPayload({ status: 'ok', service: 'web', runtime: 'nextjs' }),
    true
  );
  assert.equal(isAudionFastApiHealthPayload({ status: 'ok', service: 'web' }), false);
});

test('detects audion-v3 health as valid assistant target', () => {
  assert.equal(
    isAudionV3HealthPayload({ ok: true, service: 'audion-v3', login: '/login' }),
    true
  );
  assert.equal(isAudionWebHealthPayload({ ok: true, service: 'audion-v3' }), false);
});

test('detects FastAPI health payload', () => {
  assert.equal(
    isAudionFastApiHealthPayload({ status: 'ok', ai_provider_configured: true }),
    true
  );
  assert.equal(isAudionWebHealthPayload({ status: 'ok', ai_provider_configured: true }), false);
});

test('formats validation detail arrays', () => {
  const msg = formatFastApiErrorDetail([
    { loc: ['body', 'segment'], msg: 'Field required' },
  ]);
  assert.ok(msg && msg.includes('segment') && msg.includes('Field required'));
});

test('detects html login bodies', () => {
  assert.equal(isHtmlOrLoginBody('text/html', '<html>'), true);
  assert.equal(isHtmlOrLoginBody('application/json', '{"ok":true}'), false);
});

test('misconfig message points at audion-v3 /api not FastAPI', () => {
  const msg = audionWebUrlMisconfigMessage();
  assert.ok(msg.includes('audion-v3'));
  assert.ok(msg.includes('/api'));
  assert.ok(msg.toLowerCase().includes('do not use fastapi'));
});
