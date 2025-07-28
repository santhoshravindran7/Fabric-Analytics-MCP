#!/usr/bin/env node

/**
 * Manual MCP Protocol Test
 * Debug MCP communication issues
 */

const { spawn } = require('child_process');

async function testMCPProtocol() {
  console.log('🔍 Manual MCP Protocol Test');
  console.log('=' .repeat(40));
  
  console.log('Starting MCP Server...');
  
  const serverProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
  
  let serverReady = false;
  
  // Wait for server to be ready
  await new Promise((resolve) => {
    serverProcess.stderr.on('data', (data) => {
      const message = data.toString();
      console.log('Server:', message.trim());
      if (message.includes('MCP server running')) {
        serverReady = true;
        resolve();
      }
    });
    
    setTimeout(() => {
      if (!serverReady) {
        console.log('Server ready timeout, continuing...');
        resolve();
      }
    }, 3000);
  });
  
  if (!serverReady) {
    console.log('❌ Server not ready, exiting');
    serverProcess.kill();
    return;
  }
  
  console.log('\n✅ Server ready, testing MCP communication...');
  
  // Test 1: Initialize MCP session
  console.log('\n1. Testing MCP initialization...');
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
  
  serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Test 2: List tools
  setTimeout(() => {
    console.log('\n2. Testing tools/list...');
    const toolsRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    };
    
    serverProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
  }, 1000);
  
  // Test 3: Call a specific tool
  setTimeout(() => {
    console.log('\n3. Testing tool call...');
    const toolCallRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "health-check",
        arguments: {}
      }
    };
    
    serverProcess.stdin.write(JSON.stringify(toolCallRequest) + '\n');
  }, 2000);
  
  // Listen for responses
  let responseCount = 0;
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('\nServer Response:', output.trim());
    
    responseCount++;
    if (responseCount >= 3) {
      console.log('\n✅ Received expected responses, cleaning up...');
      setTimeout(() => {
        serverProcess.kill();
      }, 1000);
    }
  });
  
  // Cleanup after 10 seconds
  setTimeout(() => {
    console.log('\n🔄 Test timeout, cleaning up...');
    serverProcess.kill();
  }, 10000);
  
  // Wait for process to exit
  await new Promise((resolve) => {
    serverProcess.on('close', () => {
      console.log('\n📊 MCP Protocol Test completed');
      resolve();
    });
  });
}

testMCPProtocol().catch(console.error);
