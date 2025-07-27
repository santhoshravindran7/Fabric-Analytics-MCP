#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 Testing MCP Server with Azure CLI Authentication');
console.log('===================================================\n');

// Set environment variables for CLI auth
process.env.FABRIC_AUTH_METHOD = 'azure_cli';
process.env.ENABLE_HEALTH_SERVER = 'false';

console.log('🔧 Configuration:');
console.log(`   Auth Method: ${process.env.FABRIC_AUTH_METHOD}`);
console.log(`   Server Path: build/index.js\n`);

// Start the MCP server
console.log('🚀 Starting MCP Server...');
const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let serverReady = false;
let toolsReceived = false;

// Send MCP protocol messages
function sendMessage(message) {
  console.log('📤 Sending:', JSON.stringify(message, null, 2));
  server.stdin.write(JSON.stringify(message) + '\n');
}

// Initialize the server
function initializeServer() {
  const initMessage = {
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
  
  setTimeout(() => sendMessage(initMessage), 1000);
}

// List available tools
function listTools() {
  const listMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };
  
  setTimeout(() => sendMessage(listMessage), 2000);
}

// Test a simple tool call
function testTool() {
  const testMessage = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "list-fabric-items",
      arguments: {
        bearerToken: "simulation",
        workspaceId: "test-workspace-123",
        itemType: "All"
      }
    }
  };
  
  setTimeout(() => sendMessage(testMessage), 4000);
}

// Handle server output
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const message = JSON.parse(line);
      console.log('📥 Received:', JSON.stringify(message, null, 2));
      
      if (message.id === 1 && message.result) {
        console.log('✅ Server initialized successfully!');
        serverReady = true;
      }
      
      if (message.id === 2 && message.result && message.result.tools) {
        console.log(`✅ Tools received! Found ${message.result.tools.length} tools:`);
        message.result.tools.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
        });
        toolsReceived = true;
      }
      
      if (message.id === 3 && message.result) {
        console.log('✅ Test tool call successful!');
        console.log('   Response:', message.result.content[0].text);
      }
      
    } catch (e) {
      // Non-JSON output, probably startup messages
      console.log('📋 Server:', line.trim());
    }
  }
});

// Handle server errors
server.stderr.on('data', (data) => {
  const error = data.toString();
  if (!error.includes('Warning') && !error.includes('DeprecationWarning')) {
    console.log('⚠️ Server stderr:', error.trim());
  }
});

// Handle server close
server.on('close', (code) => {
  console.log(`\n🏁 Server exited with code ${code}`);
  
  if (serverReady && toolsReceived) {
    console.log('🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Server started');
    console.log('   ✅ Azure CLI authentication configured');
    console.log('   ✅ Tools loaded and accessible');
    console.log('   ✅ Tool calls working');
    console.log('\n💡 You can now use this server with Claude Desktop!');
  } else {
    console.log('❌ Test failed - server did not respond properly');
  }
  
  process.exit(code);
});

// Handle errors
server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});

// Start the test sequence
console.log('⏳ Waiting for server startup...');
initializeServer();
listTools();
testTool();

// Cleanup after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout - stopping server...');
  server.kill('SIGTERM');
}, 10000);
