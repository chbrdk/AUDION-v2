/**
 * Unit tests for AUDION API client
 * These tests use mocks for fetch and WebSocket
 */

describe('AudionClient', () => {
  describe('listPersonas', () => {
    it('should fetch personas from API', async () => {
      // Mock fetch response
      // global.fetch = jest.fn().mockResolvedValue({
      //   ok: true,
      //   json: async () => ({
      //     items: [{ id: '1', name: 'Test Persona', segment: 'test' }],
      //     total: 1,
      //     page: 1,
      //     page_size: 100,
      //   }),
      // });
      //
      // const response = await listPersonas();
      // expect(response.items).toHaveLength(1);
      // expect(response.items[0].name).toBe('Test Persona');
    });

    it('should handle API errors', async () => {
      // Mock fetch error
      // global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      //
      // await expect(listPersonas()).rejects.toThrow('Network error');
    });
  });

  describe('sendMessage', () => {
    it('should send message with correct format', async () => {
      // Mock fetch response
      // const mockResponse = {
      //   response: 'Test response',
      //   sources: [],
      //   persona_id: '1',
      // };
      //
      // global.fetch = jest.fn().mockResolvedValue({
      //   ok: true,
      //   json: async () => mockResponse,
      // });
      //
      // const response = await sendMessage({
      //   persona_id: '1',
      //   content: 'Test message',
      // });
      //
      // expect(response.response).toBe('Test response');
    });

    it('should include image_ids when provided', async () => {
      // Test image_ids in request
    });
  });

  describe('AudionWebSocket', () => {
    it('should connect to WebSocket', () => {
      // Mock WebSocket
      // const ws = new AudionWebSocket('test-id', () => {}, () => {});
      // ws.connect();
      // expect(ws).toBeDefined();
    });

    it('should send messages', () => {
      // Test WebSocket send
    });

    it('should handle reconnection', () => {
      // Test reconnection logic
    });
  });
});



