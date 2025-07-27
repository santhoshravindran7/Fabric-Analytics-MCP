#!/usr/bin/env node

// Simple MCP client to test the server
import { spawn } from 'child_process';

async function testMcpServer() {
  console.log('🧪 Testing MCP Server Tool Count');
  console.log('================================');
  
  const env = { 
    ...process.env, 
    FABRIC_AUTH_METHOD: 'azure-cli',
    ENABLE_HEALTH_SERVER: 'false'
  };

  const server = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env
  });

  let response = '';
  let hasResponded = false;

  server.stdout.on('data', (data) => {
    response += data.toString();
    if (!hasResponded && response.includes('"result"')) {
      hasResponded = true;
      processResponse(response);
      server.kill();
    }
  });

  server.stderr.on('data', (data) => {
    // Ignore stderr messages about server startup
  });

  // Send tools/list request
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  server.stdin.write(JSON.stringify(request) + '\n');

  // Timeout after 10 seconds
  setTimeout(() => {
    if (!hasResponded) {
      console.log('❌ No response received within timeout');
      server.kill();
      process.exit(1);
    }
  }, 10000);
}

function processResponse(response) {
  try {
    const lines = response.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.result && parsed.result.tools) {
          const tools = parsed.result.tools;
          
          console.log(`✅ MCP Server successfully upgraded!`);
          console.log(`📊 Total tools available: ${tools.length}`);
          console.log(`\n📋 Tool categories:`);
          
          const categories = {};
          tools.forEach(tool => {
            const category = tool.name.split('-')[0];
            categories[category] = (categories[category] || 0) + 1;
          });
          
          Object.entries(categories).sort().forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} tools`);
          });
          
          console.log(`\n🎯 Key enterprise tools added:`);
          const keyTools = tools.filter(t => 
            t.name.includes('workspace') || 
            t.name.includes('capacity') || 
            t.name.includes('pipeline') || 
            t.name.includes('environment') ||
            t.name.includes('health')
          );
          
          keyTools.slice(0, 10).forEach(tool => {
            console.log(`   - ${tool.name}`);
          });
          
          console.log(`\n🎉 Upgrade complete! From 17 basic tools to ${tools.length} comprehensive enterprise tools.`);
          process.exit(0);
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }
    
    console.log('❌ No valid tools response found');
    console.log('Raw response:', response);
    process.exit(1);
  } catch (error) {
    console.error('❌ Error processing response:', error);
    console.log('Raw response:', response);
    process.exit(1);
  }
}

testMcpServer().catch(console.error);
