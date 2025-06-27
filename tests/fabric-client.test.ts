import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FabricApiClient } from '../src/fabric-client.js';

// Mock fetch for testing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('FabricApiClient', () => {
  let client: FabricApiClient;
  const mockToken = 'test-bearer-token';
  const mockWorkspaceId = 'test-workspace-123';

  beforeEach(() => {
    client = new FabricApiClient(mockToken, mockWorkspaceId);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided token and workspace', () => {
      expect(client).toBeDefined();
      expect(client['bearerToken']).toBe(mockToken);
      expect(client['workspaceId']).toBe(mockWorkspaceId);
    });

    it('should use default config when none provided', () => {
      expect(client['config'].apiBaseUrl).toBe('https://api.fabric.microsoft.com/v1');
      expect(client['config'].timeout).toBe(30000);
    });
  });

  describe('makeRequest', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { items: ['item1', 'item2'] };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.makeRequest('items');

      expect(fetch).toHaveBeenCalledWith(
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

    it('should make successful POST request with body', async () => {
      const requestBody = { displayName: 'Test Item', type: 'Lakehouse' };
      const mockResponse = { id: 'new-item-123', ...requestBody };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.makeRequest('items', {
        method: 'POST',
        body: requestBody
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody)
        })
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle HTTP errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      const result = await client.makeRequest('items');

      expect(result.status).toBe('error');
      expect(result.error).toContain('HTTP 401');
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await client.makeRequest('items');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Request failed: Network error');
    });

    it('should handle timeout', async () => {
      const shortTimeoutClient = new FabricApiClient(mockToken, mockWorkspaceId, {
        apiBaseUrl: 'https://api.fabric.microsoft.com/v1',
        version: '1.0.0',
        userAgent: 'test',
        timeout: 100
      });

      (fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await shortTimeoutClient.makeRequest('items');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Request failed');
    });
  });

  describe('CRUD operations', () => {
    it('should list items', async () => {
      const mockItems = { value: [{ id: '1', displayName: 'Item 1' }] };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockItems)
      });

      const result = await client.listItems();

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockItems);
    });

    it('should list items with type filter', async () => {
      const mockItems = { value: [{ id: '1', type: 'Lakehouse' }] };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockItems)
      });

      await client.listItems('Lakehouse');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('items?type=Lakehouse'),
        expect.any(Object)
      );
    });

    it('should create item', async () => {
      const newItem = { id: 'new-123', displayName: 'New Item', type: 'Notebook' };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newItem)
      });

      const result = await client.createItem('Notebook', 'New Item', 'Description');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            displayName: 'New Item',
            type: 'Notebook',
            description: 'Description'
          })
        })
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(newItem);
    });

    it('should get item by ID', async () => {
      const item = { id: 'item-123', displayName: 'Test Item' };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(item)
      });

      const result = await client.getItem('item-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/item-123'),
        expect.any(Object)
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(item);
    });

    it('should update item', async () => {
      const updates = { displayName: 'Updated Name' };
      const updatedItem = { id: 'item-123', ...updates };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedItem)
      });

      const result = await client.updateItem('item-123', updates);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/item-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updates)
        })
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(updatedItem);
    });

    it('should delete item', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await client.deleteItem('item-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/item-123'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );

      expect(result.status).toBe('success');
    });
  });

  describe('Job operations', () => {
    it('should execute notebook', async () => {
      const jobResult = { id: 'job-123', status: 'Running' };
      const parameters = { param1: 'value1', param2: 42 };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(jobResult)
      });

      const result = await client.executeNotebook('notebook-123', parameters);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/notebook-123/jobs/instances'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ parameters })
        })
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(jobResult);
    });

    it('should submit Spark job', async () => {
      const sparkJob = { id: 'spark-123', status: 'Submitted' };
      const code = 'print("Hello Spark")';
      const config = { driverCores: 2, driverMemory: '4g' };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sparkJob)
      });

      const result = await client.submitSparkJob('lakehouse-123', code, 'python', config);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/lakehouse-123/jobs/spark'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            code,
            language: 'python',
            lakehouseId: 'lakehouse-123',
            clusterConfig: config
          })
        })
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(sparkJob);
    });

    it('should get job status', async () => {
      const jobStatus = { id: 'job-123', status: 'Completed' };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(jobStatus)
      });

      const result = await client.getJobStatus('job-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/job-123'),
        expect.any(Object)
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(jobStatus);
    });
  });
});

describe('SimulationService', () => {
  describe('simulateApiCall', () => {
    it('should simulate list-items operation', async () => {
      const result = await SimulationService.simulateApiCall('list-items');

      expect(result.status).toBe('success');
      expect(result.data?.value).toBeDefined();
      expect(Array.isArray(result.data.value)).toBe(true);
      expect(result.data.value.length).toBeGreaterThan(0);
    });

    it('should simulate create-item operation', async () => {
      const params = { 
        itemType: 'Lakehouse', 
        displayName: 'Test Lakehouse',
        description: 'Test description'
      };
      
      const result = await SimulationService.simulateApiCall('create-item', params);

      expect(result.status).toBe('success');
      expect(result.data?.displayName).toBe(params.displayName);
      expect(result.data?.type).toBe(params.itemType);
      expect(result.data?.id).toBeDefined();
    });

    it('should simulate execute-notebook operation', async () => {
      const params = { notebookId: 'nb-123', parameters: { key: 'value' } };
      
      const result = await SimulationService.simulateApiCall('execute-notebook', params);

      expect(result.status).toBe('success');
      expect(result.data?.id).toBeDefined();
      expect(result.data?.status).toBe('Running');
      expect(result.data?.type).toBe('NotebookExecution');
    });

    it('should simulate spark-job operation', async () => {
      const params = { 
        lakehouseId: 'lh-123',
        code: 'print("test")',
        language: 'python',
        config: { driverCores: 4 }
      };
      
      const result = await SimulationService.simulateApiCall('spark-job', params);

      expect(result.status).toBe('success');
      expect(result.data?.id).toBeDefined();
      expect(result.data?.status).toBe('Submitted');
      expect(result.data?.language).toBe(params.language);
    });

    it('should simulate job-status operation', async () => {
      const params = { jobId: 'job-123' };
      
      const result = await SimulationService.simulateApiCall('job-status', params);

      expect(result.status).toBe('success');
      expect(result.data?.id).toBe(params.jobId);
      expect(result.data?.status).toBeDefined();
      expect(['Running', 'Completed', 'Failed', 'Cancelled']).toContain(result.data.status);
    });

    it('should handle unknown operation', async () => {
      const result = await SimulationService.simulateApiCall('unknown-operation');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Unknown simulation operation');
    });

    it('should include network delay simulation', async () => {
      const startTime = Date.now();
      await SimulationService.simulateApiCall('list-items');
      const endTime = Date.now();

      // Should take at least 500ms (minimum simulated delay)
      expect(endTime - startTime).toBeGreaterThanOrEqual(500);
    });
  });
});
