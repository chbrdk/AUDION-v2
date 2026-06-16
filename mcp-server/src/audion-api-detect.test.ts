import test from 'node:test';
import assert from 'node:assert';
import {
  audionWebUrlMisconfigMessage,
  formatFastApiErrorDetail,
  isAudionFastApiHealthPayload,
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
  assert.ok(msg?.includes('segment'));
  assert.ok(msg?.includes('Field required'));
});

test('detects html login bodies', () => {
  assert.equal(isHtmlOrLoginBody('text/html', '<!DOCTYPE html><html>'), true);
  assert.equal(
    isHtmlOrLoginBody('application/json', '{"detail":"x"}'),
    false
  );
});

test('misconfig message mentions internal API URL', () => {
  assert.ok(audionWebUrlMisconfigMessage().includes('audion-api:8000'));
});
