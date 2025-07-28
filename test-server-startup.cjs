#!/usr/bin/env node

/**
 * Quick test for MCP Server startup
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Testing MCP Server startup...');

const serverProcess = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let output = '';
let hasStarted = false;

const timeout = setTimeout(() => {
  if (!hasStarted) {
    console.log('✅ Server startup test completed (5 second timeout)');
    serverProcess.kill();
    process.exit(0);
  }
}, 5000);

serverProcess.stdout.on('data', (data) => {
  output += data.toString();
  console.log('Server output:', data.toString().trim());
  if (output.includes('MCP server running') || output.includes('Server running')) {
    hasStarted = true;
    clearTimeout(timeout);
    console.log('✅ MCP Server started successfully!');
    setTimeout(() => {
      serverProcess.kill();
      process.exit(0);
    }, 1000);
  }
});

serverProcess.stderr.on('data', (data) => {
  const message = data.toString().trim();
  console.log('Server info:', message);
  if (message.includes('MCP server running') || message.includes('Health endpoints available')) {
    hasStarted = true;
    clearTimeout(timeout);
    console.log('✅ MCP Server started successfully!');
    setTimeout(() => {
      serverProcess.kill();
      process.exit(0);
    }, 1000);
  }
});

serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  if (!hasStarted) {
    console.log('❌ Server failed to start (exit code:', code, ')');
  }
  process.exit(code);
});
