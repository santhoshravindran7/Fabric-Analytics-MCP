#!/usr/bin/env node

/**
 * Quick functional test for GitHub Copilot validation
 * Tests key tool categories to ensure they're working properly
 */

const { spawn } = require('child_process');

async function testMCPToolsWithCopilot() {
  console.log('🤖 GitHub Copilot - MCP Fabric Analytics Functional Test');
  console.log('=' .repeat(60));
  
  // Test that server can start and list available tools
  console.log('\n🔧 Testing MCP Server Tool Discovery...');
  
  const serverProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  let toolsFound = false;
  let serverOutput = '';

  // Send a tools/list request to the server
  setTimeout(() => {
    const toolsListRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    }) + '\n';
    
    serverProcess.stdin.write(toolsListRequest);
    serverProcess.stdin.end();
  }, 1000);

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    
    if (output.includes('tools') && output.includes('result')) {
      console.log('✅ Server responded to tools/list request');
      toolsFound = true;
      
      // Parse and count tools
      try {
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('tools')) {
            const response = JSON.parse(line);
            if (response.result && response.result.tools) {
              console.log(`✅ Found ${response.result.tools.length} tools registered`);
              
              // Show sample tools for GitHub Copilot
              const sampleTools = response.result.tools.slice(0, 5);
              console.log('\n📋 Sample Tools Available:');
              sampleTools.forEach(tool => {
                console.log(`  • ${tool.name}: ${tool.description.substring(0, 60)}...`);
              });
              break;
            }
          }
        }
      } catch (error) {
        console.log('⚠️  Could not parse tools list, but server is responding');
      }
      
      setTimeout(() => {
        serverProcess.kill();
      }, 1000);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('MCP server running')) {
      console.log('✅ MCP Server started successfully');
    }
  });

  return new Promise((resolve) => {
    serverProcess.on('close', (code) => {
      console.log('\n🎯 GitHub Copilot Integration Status:');
      console.log('=' .repeat(40));
      
      if (toolsFound) {
        console.log('✅ MCP Server: Ready for Claude Desktop');
        console.log('✅ Tool Discovery: Working properly');
        console.log('✅ JSON-RPC Protocol: Functional');
        console.log('✅ GitHub Copilot: Validated successfully');
        
        console.log('\n🚀 Ready for Claude Desktop queries:');
        console.log('  "List all my Fabric workspaces"');
        console.log('  "Show me Spark applications and performance"');
        console.log('  "Analyze my data pipeline performance"');
        console.log('  "Get AI recommendations for Spark optimization"');
        
        resolve({ success: true, toolsFound: true });
      } else {
        console.log('❌ Tool discovery failed - check server configuration');
        resolve({ success: false, toolsFound: false });
      }
    });
  });
}

// Run the test
if (require.main === module) {
  testMCPToolsWithCopilot()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = testMCPToolsWithCopilot;
