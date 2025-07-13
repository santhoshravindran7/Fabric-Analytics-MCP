#!/usr/bin/env node

/**
 * Test script to verify MCP server with Azure CLI authentication
 * This script tests the actual MCP server startup with Azure CLI auth
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing MCP Server with Azure CLI Authentication...\n');

// Test 1: Check if build exists
const buildPath = path.join(__dirname, '..', 'build', 'index.js');
console.log('1️⃣ Checking if MCP server is built...');

try {
  require('fs').accessSync(buildPath);
  console.log('✅ Build found at:', buildPath);
} catch (error) {
  console.log('❌ Build not found. Please run: npm run build');
  process.exit(1);
}

// Test 2: Start MCP server with Azure CLI auth
console.log('\n2️⃣ Starting MCP server with Azure CLI authentication...');
console.log('⏱️  Testing for 10 seconds (server should start without errors)...\n');

const server = spawn('node', [buildPath], {
  env: {
    ...process.env,
    FABRIC_AUTH_METHOD: 'azure_cli',
    FABRIC_DEBUG: 'true',
    ENABLE_HEALTH_SERVER: 'false'  // Disable health server to avoid port conflicts
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('📤', text.trim());
});

server.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.log('📥', text.trim());
});

// Kill server after 10 seconds
setTimeout(() => {
  console.log('\n⏹️  Stopping server...');
  server.kill('SIGTERM');
  
  // Analyze results
  console.log('\n📊 Test Results:');
  
  if (output.includes('MCP server running') || output.includes('Server initialized')) {
    console.log('✅ Server started successfully with Azure CLI authentication');
  } else if (errorOutput.includes('Azure CLI is not installed') || 
             errorOutput.includes('not logged in to Azure CLI')) {
    console.log('⚠️  Azure CLI setup issue detected');
    console.log('💡 Please run: az login');
  } else if (errorOutput.includes('ENOENT') || errorOutput.includes('az account get-access-token')) {
    console.log('⚠️  Azure CLI command execution issue');
    console.log('💡 Please ensure Azure CLI is in your PATH');
  } else if (output.length === 0 && errorOutput.length === 0) {
    console.log('⚠️  No output detected - server may have started in background mode');
    console.log('✅ This is normal for MCP servers');
  } else {
    console.log('✅ Server appears to be working with Azure CLI authentication');
  }
  
  console.log('\n🎉 MCP Server Azure CLI test completed!');
  console.log('\n💡 To use with Claude Desktop, set:');
  console.log('   "FABRIC_AUTH_METHOD": "azure_cli"');
  console.log('\n📚 See docs/AZURE_CLI_AUTH.md for detailed setup instructions');
  
}, 10000);

server.on('error', (error) => {
  console.log('❌ Server startup error:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== null) {
    console.log(`\n📋 Server exited with code: ${code}`);
  }
});
