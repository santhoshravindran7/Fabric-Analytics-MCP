#!/usr/bin/env node

/**
 * Direct MCP Tools Test
 * Tests what tools are actually available in the current MCP server build
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Testing MCP Server Tools Availability');
console.log('========================================');

const serverPath = join(__dirname, 'build', 'index.js');

console.log(`📍 Server path: ${serverPath}`);
console.log('🔧 Environment: FABRIC_AUTH_METHOD=azure-cli');
console.log('⏳ Starting server and requesting tools list...\n');

const server = spawn('node', [serverPath], {
    env: { ...process.env, FABRIC_AUTH_METHOD: 'azure-cli' },
    stdio: ['pipe', 'pipe', 'pipe']
});

let toolsReceived = false;
let startupComplete = false;

// Timeout after 10 seconds
const timeout = setTimeout(() => {
    if (!toolsReceived) {
        console.log('⏰ Timeout - Server may not be responding to tools list request');
        server.kill();
        process.exit(1);
    }
}, 10000);

server.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Wait for server startup to complete before sending request
    if (output.includes('Microsoft Fabric Analytics MCP Server running') && !startupComplete) {
        startupComplete = true;
        console.log('✅ Server started successfully');
        
        // Send tools list request after server is ready
        setTimeout(() => {
            console.log('📤 Sending tools/list request...');
            const request = {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
            };
            server.stdin.write(JSON.stringify(request) + '\n');
        }, 1000);
    }
    
    // Check for tools response
    try {
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
            if (line.includes('"tools"') || line.includes('fabric_list_workspaces')) {
                const jsonResponse = JSON.parse(line);
                if (jsonResponse.result && jsonResponse.result.tools) {
                    toolsReceived = true;
                    clearTimeout(timeout);
                    
                    const tools = jsonResponse.result.tools;
                    console.log(`✅ Tools list received! Found ${tools.length} tools\n`);
                    
                    // Check for workspace tools specifically
                    const workspaceTools = tools.filter(t => t.name.includes('workspace'));
                    console.log(`🏢 Workspace management tools: ${workspaceTools.length}`);
                    if (workspaceTools.length > 0) {
                        workspaceTools.forEach(tool => {
                            console.log(`   ✅ ${tool.name} - ${tool.description}`);
                        });
                    } else {
                        console.log('   ❌ No workspace tools found!');
                    }
                    
                    // Check for the specific tools we need
                    const requiredTools = [
                        'fabric_list_workspaces',
                        'fabric_create_workspace', 
                        'fabric_delete_workspace',
                        'fabric_assign_workspace_to_capacity'
                    ];
                    
                    console.log('\n🔍 Required workspace tools check:');
                    let allFound = true;
                    requiredTools.forEach(toolName => {
                        const found = tools.find(t => t.name === toolName);
                        if (found) {
                            console.log(`   ✅ ${toolName}`);
                        } else {
                            console.log(`   ❌ ${toolName} - MISSING!`);
                            allFound = false;
                        }
                    });
                    
                    if (allFound) {
                        console.log('\n🎉 All workspace management tools are available!');
                        console.log('   The issue may be with Claude Desktop configuration or connection.');
                    } else {
                        console.log('\n❌ Some workspace tools are missing from the build.');
                        console.log('   This explains why Claude Desktop cannot list workspaces.');
                    }
                    
                    setTimeout(() => {
                        server.kill();
                        process.exit(allFound ? 0 : 1);
                    }, 1000);
                    break;
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
        console.log('⚠️ Port 3000 in use (expected - health server)');
    } else if (!error.includes('Warning') && !error.includes('Health endpoints')) {
        console.log('⚠️ Server error:', error.trim());
    }
});

server.on('close', (code) => {
    clearTimeout(timeout);
    if (!toolsReceived) {
        console.log('❌ No tools response received');
        console.log('   The MCP server may not be working properly.');
        process.exit(1);
    }
});

server.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
});
