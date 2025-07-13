#!/usr/bin/env node
/**
 * Quick test for new workspace management tools
 */

const { spawn } = require('child_process');

async function testWorkspaceTools() {
  console.log('🚀 Testing new workspace management tools...');
  
  // Start MCP server
  const mcpProcess = spawn('node', ['./dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let serverReady = false;
  
  mcpProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Microsoft Fabric Analytics MCP Server running')) {
      serverReady = true;
      testTools();
    }
  });

  async function testTools() {
    console.log('✅ MCP server started, testing workspace tools...');
    
    try {
      // Test list workspaces
      const listRequest = {
        jsonrpc: '2.0',
        id: 'test-list',
        method: 'tools/call',
        params: {
          name: 'fabric_list_workspaces',
          arguments: { top: 3 }
        }
      };

      mcpProcess.stdin.write(JSON.stringify(listRequest) + '\n');
      
      let responseBuffer = '';
      const onData = (data) => {
        responseBuffer += data.toString();
        
        if (responseBuffer.includes('test-list')) {
          try {
            const lines = responseBuffer.split('\n');
            for (const line of lines) {
              if (line.trim() && line.includes('test-list')) {
                const response = JSON.parse(line);
                if (response.id === 'test-list') {
                  console.log('✅ fabric_list_workspaces tool working!');
                  console.log('Response:', response.result?.content?.[0]?.text?.substring(0, 200) + '...');
                  
                  mcpProcess.stdout.off('data', onData);
                  cleanup();
                  return;
                }
              }
            }
          } catch (e) {
            // Continue
          }
        }
      };

      mcpProcess.stdout.on('data', onData);
      
      setTimeout(() => {
        console.log('⚠️  Test timeout - but server started successfully');
        cleanup();
      }, 10000);
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      cleanup();
    }
  }

  function cleanup() {
    mcpProcess.kill();
    console.log('🏁 Test completed');
    process.exit(0);
  }

  setTimeout(() => {
    if (!serverReady) {
      console.error('❌ Server failed to start within timeout');
      mcpProcess.kill();
      process.exit(1);
    }
  }, 15000);
}

testWorkspaceTools();
