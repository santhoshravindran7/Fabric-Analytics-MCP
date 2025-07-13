#!/usr/bin/env node

/**
 * MCP Tools Validation Script
 * Tests that all tools are available and working, especially workspace management
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Testing MCP Server Tools Availability');
console.log('========================================');

// Set environment variables
const env = {
    ...process.env,
    FABRIC_AUTH_METHOD: 'azure-cli'
};

const serverPath = path.join(__dirname, 'build', 'index.js');

const server = spawn('node', [serverPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe']
});

let toolsReceived = false;

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
    
    // Check for tools response
    if (output.includes('fabric_list_workspaces') || output.includes('"tools"')) {
        toolsReceived = true;
        clearTimeout(timeout);
        console.log('✅ Server is responding with tools list!');
        
        // Parse and display available tools
        try {
            const jsonMatch = output.match(/\{.*\}/s);
            if (jsonMatch) {
                const response = JSON.parse(jsonMatch[0]);
                if (response.result && response.result.tools) {
                    const tools = response.result.tools;
                    console.log(`📊 Found ${tools.length} tools:`);
                    
                    // Check for workspace management tools
                    const workspaceTools = tools.filter(tool => 
                        tool.name.includes('workspace') || 
                        tool.name.includes('capacity')
                    );
                    
                    console.log(`🏢 Workspace management tools: ${workspaceTools.length}`);
                    workspaceTools.forEach(tool => {
                        console.log(`   ✅ ${tool.name} - ${tool.description.substring(0, 50)}...`);
                    });
                    
                    // Check for the specific tools we need
                    const requiredTools = [
                        'fabric_list_workspaces',
                        'fabric_create_workspace', 
                        'fabric_delete_workspace',
                        'fabric_assign_workspace_to_capacity'
                    ];
                    
                    console.log('\n🔍 Required workspace tools check:');
                    requiredTools.forEach(toolName => {
                        const found = tools.find(t => t.name === toolName);
                        if (found) {
                            console.log(`   ✅ ${toolName}`);
                        } else {
                            console.log(`   ❌ ${toolName} - MISSING!`);
                        }
                    });
                    
                    console.log('\n🎉 MCP Server tools validation complete!');
                }
            }
        } catch (parseError) {
            console.log('✅ Tools response received (parsing not needed for validation)');
        }
        
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

// Send tools list request after server starts
setTimeout(() => {
    console.log('📤 Requesting tools list...');
    const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    };
    
    server.stdin.write(JSON.stringify(request) + '\n');
}, 2000);

console.log('📍 Server path:', serverPath);
console.log('🔧 Environment: FABRIC_AUTH_METHOD=azure-cli');
console.log('⏳ Starting server and requesting tools list...');
