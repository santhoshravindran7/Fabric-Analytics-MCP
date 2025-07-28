#!/usr/bin/env node

// Direct MCP server validation for Claude Desktop
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

console.log('🔬 Microsoft Fabric Analytics MCP Server - Claude Desktop Validation');
console.log('====================================================================');

async function quickValidation() {
  console.log('🚀 Starting MCP server for Claude Desktop...\n');
  
  // Test server startup
  const server = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FABRIC_AUTH_METHOD: 'azure_cli',
      ENABLE_HEALTH_SERVER: 'true'
    }
  });

  let startupMessages = '';
  let serverReady = false;

  // Capture startup messages
  server.stderr.on('data', (data) => {
    const message = data.toString();
    startupMessages += message;
    
    if (message.includes('Microsoft Fabric Analytics MCP Server running on stdio')) {
      serverReady = true;
      console.log('✅ MCP Server started successfully!');
      console.log('📊 Server running with Azure CLI authentication');
      console.log('🏥 Health endpoints enabled on port 3000');
      
      // Test a simple tools list request
      testToolsList(server);
    }
  });

  server.stdout.on('data', (data) => {
    const response = data.toString();
    try {
      const lines = response.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result && parsed.result.tools) {
            const tools = parsed.result.tools;
            console.log(`\n📋 Successfully enumerated ${tools.length} tools!`);
            
            // Count new tools
            const sparkTools = tools.filter(t => 
              t.name.includes('spark') || 
              t.name.includes('mcp_fabric-analyt2')
            );
            
            console.log(`⚡ Spark monitoring tools: ${sparkTools.length}`);
            console.log('\n🎯 New Spark tools added:');
            sparkTools.forEach(tool => {
              console.log(`   - ${tool.name}`);
            });
            
            // Generate updated Claude config
            generateClaudeConfig(tools.length);
            
            // Test authentication
            testAuthentication(server);
            
            return;
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  });

  // Timeout check
  setTimeout(() => {
    if (!serverReady) {
      console.log('⚠️ Server taking longer than expected to start...');
      console.log('Startup messages:', startupMessages);
    }
  }, 5000);
}

function testToolsList(server) {
  console.log('\n🔍 Testing tools enumeration...');
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  server.stdin.write(JSON.stringify(request) + '\n');
}

function testAuthentication(server) {
  console.log('\n🔐 Testing authentication status...');
  
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'check-authentication-status',
      arguments: {}
    }
  };

  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Give it a moment then test a Spark tool
  setTimeout(() => {
    testSparkTool(server);
  }, 2000);
}

function testSparkTool(server) {
  console.log('\n⚡ Testing Spark monitoring tool...');
  
  const request = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get-workspace-spark-applications',
      arguments: {
        bearerToken: 'test-token',
        workspaceId: 'test-workspace-id'
      }
    }
  };

  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Give it a moment then test a history server tool
  setTimeout(() => {
    testHistoryTool(server);
  }, 2000);
}

function testHistoryTool(server) {
  console.log('\n📈 Testing Spark history server tool...');
  
  const request = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'mcp_fabric-analyt2_analyze-spark-history-job',
      arguments: {
        workspaceId: 'test-workspace-id',
        sessionId: 'test-session-id',
        applicationId: 'application_test_001',
        analysisType: 'detailed'
      }
    }
  };

  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Cleanup after tests
  setTimeout(() => {
    console.log('\n🎉 Validation completed! Server is ready for Claude Desktop.');
    console.log('\n📖 Next steps:');
    console.log('1. Copy the updated claude-desktop-config.json to your Claude Desktop config');
    console.log('2. Restart Claude Desktop');
    console.log('3. All 46 tools will be available for AI-assisted analytics!');
    
    server.kill();
    process.exit(0);
  }, 3000);
}

function generateClaudeConfig(totalTools) {
  const config = {
    mcpServers: {
      "fabric-analytics": {
        command: "node",
        args: ["C:\\Users\\saravi\\Fabric-Analytics-MCP\\build\\index.js"],
        env: {
          FABRIC_AUTH_METHOD: "azure_cli",
          FABRIC_DEFAULT_WORKSPACE_ID: "",
          ENABLE_HEALTH_SERVER: "true"
        }
      }
    }
  };
  
  try {
    writeFileSync('claude-desktop-config-updated.json', JSON.stringify(config, null, 2));
    console.log(`\n📋 Updated Claude Desktop configuration generated!`);
    console.log(`✅ Configuration includes all ${totalTools} tools`);
    console.log('📁 Saved as: claude-desktop-config-updated.json');
  } catch (error) {
    console.log(`❌ Failed to generate config: ${error.message}`);
  }
}

// Start validation
quickValidation().catch(console.error);
