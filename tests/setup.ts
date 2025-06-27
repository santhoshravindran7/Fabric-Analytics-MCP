// Test setup file
// This file is run before each test file

// Set test environment
process.env.NODE_ENV = 'test';

// Export test utilities
export const testConfig = {
  timeout: 10000,
  mockWorkspaceId: 'test-workspace-id',
  mockBearerToken: 'test-token'
};
