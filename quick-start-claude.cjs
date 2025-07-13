#!/usr/bin/env node

/**
 * Quick Start Script for Claude Desktop Testing
 * One-click setup and validation
 */

const { spawn } = require('child_process');

console.log('🚀 Microsoft Fabric Analytics MCP Server - Quick Start for Claude Desktop\n');

async function runCommand(command, args, description) {
  console.log(`🔄 ${description}...`);
  
  return new Promise((resolve) => {
    const process = spawn(command, args, { stdio: 'inherit', shell: true });
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully\n`);
        resolve(true);
      } else {
        console.log(`❌ ${description} failed with code ${code}\n`);
        resolve(false);
      }
    });
    
    process.on('error', (error) => {
      console.log(`❌ ${description} error: ${error.message}\n`);
      resolve(false);
    });
  });
}

async function quickStart() {
  console.log('This script will:');
  console.log('1. Build the MCP server');
  console.log('2. Run validation tests');
  console.log('3. Generate Claude Desktop configuration');
  console.log('4. Provide setup instructions\n');
  
  // 1. Build the project
  const buildSuccess = await runCommand('npm', ['run', 'build'], 'Building MCP server');
  if (!buildSuccess) {
    console.log('❌ Build failed. Please check for TypeScript errors.');
    return false;
  }
  
  // 2. Run automated tests
  const testSuccess = await runCommand('npm', ['run', 'test:suite'], 'Running automated test suite');
  if (!testSuccess) {
    console.log('⚠️  Some tests failed, but continuing with setup...');
  }
  
  // 3. Setup Claude Desktop configuration
  const setupSuccess = await runCommand('npm', ['run', 'setup:claude'], 'Setting up Claude Desktop configuration');
  if (!setupSuccess) {
    console.log('❌ Claude setup failed.');
    return false;
  }
  
  console.log('🎉 Quick start completed successfully!\n');
  console.log('📋 Next Steps:');
  console.log('1. Install Azure CLI if not already installed');
  console.log('2. Login with: az login');
  console.log('3. Copy the generated claude_desktop_config_example.json to your Claude config location');
  console.log('4. Restart Claude Desktop');
  console.log('5. Start testing with: "List all my Fabric workspaces"\n');
  
  console.log('📚 References:');
  console.log('• Testing guide: CLAUDE_DESKTOP_TESTING_GUIDE.md');
  console.log('• Troubleshooting: README.md');
  console.log('• E2E testing: npm run setup:e2e && npm run test:e2e');
  
  return true;
}

quickStart()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Quick start failed:', error);
    process.exit(1);
  });
