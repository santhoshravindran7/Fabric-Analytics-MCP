import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FabricApiClient } from '../src/fabric-client';

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe('FabricApiClient', () => {
  let client: FabricApiClient;
  const mockToken = 'test-bearer-token';
  const mockWorkspaceId = 'test-workspace-123';
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    client = new FabricApiClient(mockToken, mockWorkspaceId);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with provided token and workspace', () => {
      expect(client).toBeDefined();
      expect((client as any)._bearerToken).toBe(mockToken);
      expect((client as any)._workspaceId).toBe(mockWorkspaceId);
    });

    it('should use default config when none provided', () => {
      expect((client as any)._config.apiBaseUrl).toBe('https://api.fabric.microsoft.com/v1');
      expect((client as any)._config.timeout).toBe(30000);
    });
  });

  describe('makeRequest', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { items: ['item1', 'item2'] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as any);

      const result = await client.makeRequest('items');

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.fabric.microsoft.com/v1/workspaces/${mockWorkspaceId}/items`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      } as any);

      const result = await client.makeRequest('items');

      expect(result.status).toBe('error');
      expect(result.error).toContain('HTTP 401');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.makeRequest('items');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Request failed');
    });
  });

  describe('Basic API operations', () => {
    it('should list items', async () => {
      const mockItems = { value: [{ id: '123', displayName: 'Test Item' }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockItems)
      } as any);

      const result = await client.listItems();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.any(Object)
      );
      expect(result.status).toBe('success');
    });
  });
});
