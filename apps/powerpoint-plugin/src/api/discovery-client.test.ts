/**
 * Unit tests for discovery client (Opal-style discovery + direct tool/API access with Bearer token).
 */

import {
  fetchDiscovery,
  getCachedDiscovery,
  listDiscoveredTools,
  callDiscoveredTool,
  type FetchLike,
} from './discovery-client';

const DISCOVERY_URL = 'https://opal.example.com/.well-known/discovery';

const mockDiscoveryResponse = {
  base_url: 'https://opal.example.com',
  version: '1.0',
  tools: [
    {
      id: 'chat',
      name: 'Chat',
      url: '/v1/chat',
      method: 'POST' as const,
      description: 'Send a message',
    },
    {
      id: 'status',
      name: 'Status',
      url: 'https://opal.example.com/health',
      method: 'GET' as const,
    },
  ],
};

function mockRes(ok: boolean, data: unknown, status = ok ? 200 : 404) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
}

function createMockFetch(discoveryPayload: unknown = mockDiscoveryResponse): FetchLike {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    if (url === DISCOVERY_URL && (init?.method === 'GET' || !init?.method)) {
      return mockRes(true, discoveryPayload);
    }
    if (url === 'https://opal.example.com/v1/chat' && init?.method === 'POST') {
      return mockRes(true, { reply: 'Hello' });
    }
    if (url === 'https://opal.example.com/health' && init?.method === 'GET') {
      return mockRes(true, { status: 'ok' });
    }
    return mockRes(false, {}, 404);
  };
}

describe('discovery-client', () => {
  describe('fetchDiscovery', () => {
    it('fetches and parses discovery document', async () => {
      const fetchFn = createMockFetch();
      const result = await fetchDiscovery(DISCOVERY_URL, undefined, fetchFn);
      expect(result.tools).toHaveLength(2);
      expect(result.base_url).toBe('https://opal.example.com');
      expect(result.tools[0].id).toBe('chat');
      expect(result.tools[0].method).toBe('POST');
      expect(result.tools[1].id).toBe('status');
    });

    it('sends Bearer token when provided', async () => {
      let capturedHeaders: Record<string, string> = {};
      const fetchFn: FetchLike = async (url, init) => {
        capturedHeaders = init?.headers ?? {};
        return mockRes(true, mockDiscoveryResponse);
      };
      await fetchDiscovery(DISCOVERY_URL, 'secret-token', fetchFn);
      expect(capturedHeaders['Authorization']).toBe('Bearer secret-token');
    });

    it('throws on invalid discovery URL', async () => {
      const fetchFn = createMockFetch();
      await expect(fetchDiscovery('', undefined, fetchFn)).rejects.toThrow('Invalid discovery URL');
      await expect(fetchDiscovery('not-a-url', undefined, fetchFn)).rejects.toThrow('Invalid discovery URL');
    });

    it('throws when response has no tools array', async () => {
      const fetchFn = createMockFetch({ base_url: 'https://x.com' });
      await expect(fetchDiscovery(DISCOVERY_URL, undefined, fetchFn)).rejects.toThrow('tools');
    });
  });

  describe('getCachedDiscovery', () => {
    it('returns cached discovery for same URL', async () => {
      const fetchFn = createMockFetch();
      await fetchDiscovery(DISCOVERY_URL, undefined, fetchFn);
      const cached = getCachedDiscovery(DISCOVERY_URL);
      expect(cached).not.toBeNull();
      expect(cached?.tools).toHaveLength(2);
    });

    it('returns null for different URL', () => {
      const cached = getCachedDiscovery('https://other.com/discovery');
      expect(cached).toBeNull();
    });
  });

  describe('listDiscoveredTools', () => {
    it('returns tools from discovery', async () => {
      const fetchFn = createMockFetch();
      const tools = await listDiscoveredTools(DISCOVERY_URL, undefined, fetchFn);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.id)).toEqual(['chat', 'status']);
    });
  });

  describe('callDiscoveredTool', () => {
    it('calls tool by id with Bearer token and returns result', async () => {
      const fetchFn = createMockFetch();
      const result = await callDiscoveredTool(DISCOVERY_URL, 'chat', {
        bearerToken: 'token',
        body: { message: 'Hi' },
        fetchFn,
      });
      expect(result).toEqual({ reply: 'Hello' });
    });

    it('calls GET tool with absolute URL', async () => {
      const fetchFn = createMockFetch();
      const result = await callDiscoveredTool(DISCOVERY_URL, 'status', {
        bearerToken: 'token',
        fetchFn,
      });
      expect(result).toEqual({ status: 'ok' });
    });

    it('throws when tool id not found', async () => {
      const fetchFn = createMockFetch();
      await expect(
        callDiscoveredTool(DISCOVERY_URL, 'nonexistent', { fetchFn })
      ).rejects.toThrow('Tool not found');
    });
  });
});
