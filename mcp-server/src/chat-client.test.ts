import test from 'node:test';
import assert from 'node:assert';

test('isChatApiConfigured requires base URL and token', async () => {
  const prevChat = process.env.CHAT_API_URL;
  const prevToken = process.env.AUDION_API_TOKEN;
  delete process.env.CHAT_API_URL;
  delete process.env.AUDION_CHAT_API_URL;
  delete process.env.AUDION_API_TOKEN;

  const { isChatApiConfigured } = await import('./chat-client.js');
  assert.equal(isChatApiConfigured(), false);

  process.env.CHAT_API_URL = 'http://localhost:8001';
  assert.equal(isChatApiConfigured(), false);

  process.env.AUDION_API_TOKEN = 'audion_test';
  assert.equal(isChatApiConfigured(), true);

  if (prevChat !== undefined) process.env.CHAT_API_URL = prevChat;
  else delete process.env.CHAT_API_URL;
  if (prevToken !== undefined) process.env.AUDION_API_TOKEN = prevToken;
  else delete process.env.AUDION_API_TOKEN;
});
