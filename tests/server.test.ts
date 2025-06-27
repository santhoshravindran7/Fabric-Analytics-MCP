// Basic configuration validation test
import { testConfig } from './setup';
import * as fs from 'fs';
import * as path from 'path';

// Simple test runner
function test(name: string, testFn: () => void | Promise<void>) {
  console.log(`Testing: ${name}`);
  try {
    const result = testFn();
    if (result instanceof Promise) {
      result.then(() => {
        console.log(`✅ PASS: ${name}`);
      }).catch((error) => {
        console.log(`❌ FAIL: ${name} - ${error.message}`);
      });
    } else {
      console.log(`✅ PASS: ${name}`);
    }
  } catch (error) {
    console.log(`❌ FAIL: ${name} - ${(error as Error).message}`);
  }
}

// Test configuration files exist
test('Configuration files should exist', () => {
  const configFiles = [
    'tsconfig.json',
    'package.json',
    'jest.config.json',
    'eslint.config.json'
  ];
  
  configFiles.forEach(file => {
    const filePath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing configuration file: ${file}`);
    }
  });
});

// Test build output exists
test('Build output should exist', () => {
  const buildPath = path.resolve(__dirname, '..', 'build', 'index.js');
  if (!fs.existsSync(buildPath)) {
    throw new Error('Build output not found. Run "npm run build" first.');
  }
});

console.log('Running configuration tests...');
console.log('Test environment:', process.env.NODE_ENV);
