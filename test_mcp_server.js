#!/usr/bin/env node

// Test script to check MCP server response
import { spawn } from 'child_process';

const serverProcess = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// MCP initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

// List tools request
const listToolsRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
};

serverProcess.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
});

serverProcess.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

// Send initialization
setTimeout(() => {
  console.log('Sending init request...');
  serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
}, 100);

// Send list tools request
setTimeout(() => {
  console.log('Sending list tools request...');
  serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 500);

// Cleanup
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 2000);
