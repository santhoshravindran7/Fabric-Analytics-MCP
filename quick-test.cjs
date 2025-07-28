#!/usr/bin/env node

/**
 * Simple MCP Tool Tester
 * Quick and easy way to test MCP Fabric Analytics tools locally
 */

const { spawn } = require('child_process');

async function quickTest() {
  console.log('🧪 Quick MCP Tool Test');
  console.log('=' .repeat(30));
  
  // Test 1: Check if Azure CLI is available
  console.log('\n1. Testing Azure CLI...');
  try {
    const azResult = await runCommand('az', ['account', 'show']);
    if (azResult.success) {
      console.log('✅ Azure CLI authenticated');
      const account = JSON.parse(azResult.output);
      console.log(`   Account: ${account.user?.name}`);
    } else {
      console.log('❌ Azure CLI not authenticated - run: az login');
    }
  } catch (error) {
    console.log('❌ Azure CLI not available');
  }
  
  // Test 2: Check if server builds and starts
  console.log('\n2. Testing MCP Server startup...');
  try {
    const serverResult = await testServerStartup();
    if (serverResult.success) {
      console.log('✅ MCP Server starts successfully');
    } else {
      console.log('❌ MCP Server startup failed');
      console.log(`   Error: ${serverResult.error}`);
    }
  } catch (error) {
    console.log('❌ Server test failed:', error.message);
  }
  
  // Test 3: Check health endpoints
  console.log('\n3. Testing health endpoints...');
  try {
    const healthResult = await testHealthEndpoint();
    if (healthResult.success) {
      console.log('✅ Health endpoint responding');
    } else {
      console.log('❌ Health endpoint failed');
    }
  } catch (error) {
    console.log('❌ Health test failed:', error.message);
  }
  
  console.log('\n🎯 Test Summary:');
  console.log('- If all tests pass: Ready for Claude Desktop!');
  console.log('- If Azure CLI fails: Run "az login"');
  console.log('- If server fails: Check build with "npm run build"');
  console.log('- For detailed testing: Run "node test-direct-tools.cjs"');
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      ...options
    });
    
    let output = '';
    let error = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output.trim(),
        error: error.trim(),
        code
      });
    });
    
    process.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        code: -1
      });
    });
  });
}

function testServerStartup() {
  return new Promise((resolve) => {
    const serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    let hasStarted = false;
    
    const timeout = setTimeout(() => {
      if (!hasStarted) {
        serverProcess.kill();
        resolve({ success: false, error: 'Startup timeout' });
      }
    }, 5000);
    
    serverProcess.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('MCP server running') || message.includes('Health endpoints')) {
        hasStarted = true;
        clearTimeout(timeout);
        serverProcess.kill();
        resolve({ success: true });
      }
    });
    
    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ success: false, error: error.message });
    });
    
    serverProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (!hasStarted && code !== 0) {
        resolve({ success: false, error: `Exit code ${code}` });
      }
    });
  });
}

function testHealthEndpoint() {
  return new Promise(async (resolve) => {
    // Start server first
    const serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    // Wait for server to start
    await new Promise((resolveWait) => {
      const timeout = setTimeout(resolveWait, 3000);
      serverProcess.stderr.on('data', (data) => {
        if (data.toString().includes('Health server listening')) {
          clearTimeout(timeout);
          resolveWait();
        }
      });
    });
    
    // Test health endpoint
    try {
      const http = require('http');
      const request = http.get('http://localhost:3000/health', (response) => {
        serverProcess.kill();
        resolve({ success: response.statusCode === 200 });
      });
      
      request.on('error', () => {
        serverProcess.kill();
        resolve({ success: false });
      });
      
      request.setTimeout(2000, () => {
        request.destroy();
        serverProcess.kill();
        resolve({ success: false });
      });
    } catch (error) {
      serverProcess.kill();
      resolve({ success: false });
    }
  });
}

// Run quick test
quickTest().catch(console.error);
