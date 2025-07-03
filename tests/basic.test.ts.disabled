describe('MCP Server', () => {
  test('should have working test environment', () => {
    expect(true).toBe(true);
  });

  test('should validate core dependencies', () => {
    const fs = require('fs');
    const path = require('path');
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
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
      '../package.json',
      '../jest.config.json'
    ];
    
    configFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
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
    
    sourceFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
