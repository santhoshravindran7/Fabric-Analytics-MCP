#!/usr/bin/env node

/**
 * Simple MCP Tools Test - CommonJS Version
 * Tests what tools are available and verifies workspace tools
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 MCP Server Tools Test');
console.log('========================');

const serverPath = path.join(__dirname, 'build', 'index.js');
console.log(`📍 Testing server: ${serverPath}`);

const server = spawn('node', [serverPath], {
    env: { ...process.env, FABRIC_AUTH_METHOD: 'azure-cli' },
    stdio: ['pipe', 'pipe', 'pipe']
});

let toolsFound = false;
let serverReady = false;

const timeout = setTimeout(() => {
    if (!toolsFound) {
        console.log('⏰ Timeout waiting for tools response');
        server.kill();
        process.exit(1);
    }
}, 8000);

server.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Wait for server to be ready
    if (output.includes('MCP Server running') && !serverReady) {
        serverReady = true;
        console.log('✅ Server started');
        
        // Send tools request
        setTimeout(() => {
            console.log('📤 Requesting tools list...');
            const request = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
            server.stdin.write(JSON.stringify(request) + '\n');
        }, 1000);
    }
    
    // Check for tools response
    if (output.includes('"tools"')) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const jsonResponse = JSON.parse(line);
                if (jsonResponse.result && jsonResponse.result.tools) {
                    toolsFound = true;
                    clearTimeout(timeout);
                    
                    const tools = jsonResponse.result.tools;
                    console.log(`📊 Found ${tools.length} tools total`);
                    
                    // Check workspace tools
                    const workspaceTools = tools.filter(t => t.name.includes('workspace'));
                    console.log(`🏢 Workspace tools: ${workspaceTools.length}`);
                    
                    const requiredTools = [
                        'fabric_list_workspaces',
                        'fabric_create_workspace', 
                        'fabric_delete_workspace'
                    ];
                    
                    console.log('\n🔍 Checking required workspace tools:');
                    let allPresent = true;
                    requiredTools.forEach(toolName => {
                        const found = tools.find(t => t.name === toolName);
                        if (found) {
                            console.log(`   ✅ ${toolName}`);
                        } else {
                            console.log(`   ❌ ${toolName} - MISSING`);
                            allPresent = false;
                        }
                    });
                    
                    if (allPresent) {
                        console.log('\n🎉 All workspace tools found in MCP server!');
                        console.log('💡 The issue is with Claude Desktop connection.');
                    } else {
                        console.log('\n❌ Workspace tools missing from MCP server!');
                    }
                    
                    server.kill();
                    process.exit(allPresent ? 0 : 1);
                }
                break;
            }
        } catch (e) {
            // Continue if not valid JSON
        }
    }
});

server.stderr.on('data', (data) => {
    const error = data.toString();
    if (!error.includes('Health endpoints') && !error.includes('Warning')) {
        console.log('⚠️ Server:', error.trim());
    }
});

server.on('close', () => {
    clearTimeout(timeout);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err.message);
    process.exit(1);
});
