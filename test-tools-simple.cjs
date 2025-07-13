#!/usr/bin/env node

/**
 * Simple MCP Tools List Test
 * Sends a tools/list request to the running MCP server via stdin/stdout
 */

const { spawn } = require('child_process');

console.log('🔍 Testing MCP Server Tools via Direct Communication');
console.log('=================================================');

// Create a simple test to communicate with the running server
const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
};

console.log('📤 Sending tools/list request...');
console.log('📋 Request:', JSON.stringify(testRequest));

// Start a new server instance for testing
const server = spawn('node', ['build/index.js'], {
    env: { ...process.env, FABRIC_AUTH_METHOD: 'azure-cli' },
    stdio: ['pipe', 'pipe', 'pipe']
});

let responseReceived = false;

server.stdout.on('data', (data) => {
    const response = data.toString();
    console.log('📥 Response:', response);
    
    // Try to parse the response
    try {
        const lines = response.split('\n').filter(line => line.trim());
        for (const line of lines) {
            if (line.includes('tools') || line.includes('fabric_list_workspaces')) {
                const jsonResponse = JSON.parse(line);
                if (jsonResponse.result && jsonResponse.result.tools) {
                    console.log('✅ Tools list received!');
                    const tools = jsonResponse.result.tools;
                    console.log(`📊 Total tools: ${tools.length}`);
                    
                    // Check for workspace tools
                    const workspaceTools = tools.filter(t => t.name.includes('workspace'));
                    console.log(`🏢 Workspace tools: ${workspaceTools.length}`);
                    workspaceTools.forEach(tool => {
                        console.log(`   - ${tool.name}`);
                    });
                    
                    responseReceived = true;
                    server.kill();
                    process.exit(0);
                }
            }
        }
    } catch (e) {
        // Not JSON, continue
    }
});

server.stderr.on('data', (data) => {
    const error = data.toString();
    if (error.includes('EADDRINUSE')) {
        console.log('⚠️ Port 3000 in use, but MCP communication should still work');
    } else if (!error.includes('Warning') && !error.includes('Health endpoints')) {
        console.log('⚠️ Server error:', error.trim());
    }
});

server.on('close', (code) => {
    if (!responseReceived) {
        console.log('❌ No tools response received');
        process.exit(1);
    }
});

// Send the request after a short delay
setTimeout(() => {
    server.stdin.write(JSON.stringify(testRequest) + '\n');
}, 1000);

// Timeout after 5 seconds
setTimeout(() => {
    if (!responseReceived) {
        console.log('⏰ Timeout - no response from server');
        server.kill();
        process.exit(1);
    }
}, 5000);
