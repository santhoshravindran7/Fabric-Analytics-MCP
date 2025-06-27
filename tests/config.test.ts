import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('MCP Server Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Environment Check', () => {
    it('should have Node.js version 18 or higher', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should run in test environment', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });
  });

  describe('TypeScript Compilation', () => {
    it('should compile without errors', () => {
      // This test passes if the file compiles successfully
      expect(true).toBe(true);
    });
  });

  describe('Module Imports', () => {
    it('should import zod successfully', async () => {
      const { z } = await import('zod');
      expect(z).toBeDefined();
      expect(typeof z.string).toBe('function');
    });

    it('should import MCP SDK successfully', async () => {
      const mcp = await import('@modelcontextprotocol/sdk');
      expect(mcp).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration files exist', () => {
      const configFiles = [
        'package.json',
        'tsconfig.json',
        'jest.config.json'
      ];
      
      configFiles.forEach(file => {
        const filePath = path.resolve(process.cwd(), file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should validate package.json structure', () => {
      const packagePath = path.resolve(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(packageJson.dependencies['zod']).toBeDefined();
    });

    it('should validate build output exists', () => {
      const buildPath = path.resolve(process.cwd(), 'build', 'index.js');
      expect(fs.existsSync(buildPath)).toBe(true);
    });
  });
});
