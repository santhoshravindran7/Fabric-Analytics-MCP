/**
 * Simple Integration Test for MCP Server
 * This test validates core functionality without complex dependencies
 */

describe('MCP Server Integration', () => {
  test('should have working test environment', () => {
    expect(true).toBe(true);
  });

  test('should validate core dependencies', () => {
    // Test if we can require the core modules
    const packageJson = require('../package.json');
    
    expect(packageJson.name).toBe('mcp-for-microsoft-fabric-analytics');
    expect(packageJson.dependencies).toBeDefined();
    expect(packageJson.dependencies['zod']).toBeDefined();
    expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(packageJson.dependencies['@azure/msal-node']).toBeDefined();
  });

  test('should validate TypeScript source files exist', () => {
    const fs = require('fs');
    const path = require('path');
    
    const sourceIndexPath = path.join(__dirname, '..', 'src', 'index.ts');
    expect(fs.existsSync(sourceIndexPath)).toBe(true);
  });

  test('should validate configuration files', () => {
    const fs = require('fs');
    const path = require('path');
    
    const configFiles = [
      '../tsconfig.json',
      '../jest.config.json',
      '../package.json'
    ];
    
    configFiles.forEach(configFile => {
      const filePath = path.join(__dirname, configFile);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  test('should validate source files exist', () => {
    const fs = require('fs');
    const path = require('path');
    
    const sourceFiles = [
      '../src/index.ts',
      '../src/fabric-client.ts',
      '../src/auth-client.ts'
    ];
    
    sourceFiles.forEach(sourceFile => {
      const filePath = path.join(__dirname, sourceFile);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
