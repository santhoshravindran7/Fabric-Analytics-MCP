import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Server Configuration', () => {
  it('should have required configuration files', () => {
    const configFiles = [
      'tsconfig.json',
      'package.json'
    ];
    
    configFiles.forEach(file => {
      const filePath = path.resolve(__dirname, '..', file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  it('should validate package.json structure', () => {
    const packagePath = path.resolve(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    expect(packageJson.name).toBe('mcp-for-microsoft-fabric-analytics');
    expect(packageJson.dependencies).toBeDefined();
    expect(packageJson.scripts).toBeDefined();
  });
});
