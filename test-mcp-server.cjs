#!/usr/bin/env node

/**
 * Quick MCP Server Test
 * Tests the MCP server directly to verify it's working before Claude Desktop testing
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing MCP Server Directly');
console.log('===============================');

// Set environment variables
const env = {
    ...process.env,
    FABRIC_AUTH_METHOD: 'azure-cli'
};

console.log('🔄 Starting MCP server...');
const serverPath = path.join(__dirname, 'build', 'index.js');

const server = spawn('node', [serverPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe']
});

let hasStarted = false;
let responseReceived = false;

// Timeout after 10 seconds
const timeout = setTimeout(() => {
    if (!responseReceived) {
        console.log('⏰ Timeout - Server might be running but not responding to test');
        server.kill();
        process.exit(1);
    }
}, 10000);

server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📤 Server output:', output.trim());
    
    if (!hasStarted && output.includes('Server started')) {
        hasStarted = true;
        console.log('✅ MCP server started successfully!');
        
        // Send a simple list tools request
        setTimeout(() => {
            console.log('🔄 Testing tools list...');
            const request = {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
            };
            
            server.stdin.write(JSON.stringify(request) + '\n');
        }, 1000);
    }
    
    // Check for tools response
    if (output.includes('fabric_list_workspaces') || output.includes('tools')) {
        responseReceived = true;
        clearTimeout(timeout);
        console.log('✅ MCP server is responding to requests!');
        console.log('✅ Fabric tools are available!');
        console.log('');
        console.log('🎉 Server test completed successfully!');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('1. Open Claude Desktop');
        console.log('2. Look for the "fabric-analytics" MCP connection');
        console.log('3. Try: "List all my Fabric workspaces"');
        console.log('4. Or: "What MCP tools are available?"');
        
        setTimeout(() => {
            server.kill();
            process.exit(0);
        }, 1000);
    }
});

server.stderr.on('data', (data) => {
    const error = data.toString();
    if (!error.includes('Warning') && !error.includes('DeprecationWarning')) {
        console.log('⚠️ Server error:', error.trim());
    }
});

server.on('close', (code) => {
    clearTimeout(timeout);
    if (code === 0) {
        console.log('✅ Server closed successfully');
    } else {
        console.log(`❌ Server exited with code ${code}`);
        process.exit(code);
    }
});

server.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
});

console.log('📍 Server path:', serverPath);
console.log('🔧 Environment: FABRIC_AUTH_METHOD=azure-cli');
console.log('⏳ Waiting for server to start...');
