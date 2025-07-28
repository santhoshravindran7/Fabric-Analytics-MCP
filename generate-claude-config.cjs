#!/usr/bin/env node

/**
 * Generate Claude Desktop configuration for MCP Fabric Analytics Server
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Generating Claude Desktop configuration for MCP Fabric Analytics...\n');

// Tool categories and counts
const TOOL_CATEGORIES = {
  'Authentication & Health': 5,
  'Workspace Management': 8,
  'Item Management': 5,
  'Capacity Management': 4,
  'Data Pipeline Management': 6,
  'Environment Management': 5,
  'Power BI Integration': 4,
  'Spark History Server Analytics': 5,
  'Advanced Spark Monitoring': 5
};

const totalTools = Object.values(TOOL_CATEGORIES).reduce((sum, count) => sum + count, 0);

console.log('📊 Tool Categories Summary:');
console.log('=' .repeat(40));
for (const [category, count] of Object.entries(TOOL_CATEGORIES)) {
  console.log(`• ${category}: ${count} tools`);
}
console.log(`\nTotal Tools: ${totalTools}`);

// Generate Claude Desktop configuration
const config = {
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": [path.join(process.cwd(), "build", "index.js")],
      "cwd": process.cwd(),
      "env": {
        "NODE_ENV": "production",
        "FABRIC_AUTH_METHOD": "azure-cli"
      }
    }
  }
};

// Write configuration file
const configPath = path.join(process.cwd(), 'claude-desktop-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('\n✅ Claude Desktop configuration generated!');
console.log(`📁 Config file: ${configPath}`);

// Read and display the configuration
console.log('\n📋 Configuration Content:');
console.log('=' .repeat(40));
console.log(JSON.stringify(config, null, 2));

console.log('\n🚀 Setup Instructions:');
console.log('=' .repeat(40));
console.log('1. Copy the configuration to your Claude Desktop settings:');

if (process.platform === 'win32') {
  console.log('   Location: %APPDATA%\\Claude\\claude_desktop_config.json');
} else if (process.platform === 'darwin') {
  console.log('   Location: ~/Library/Application Support/Claude/claude_desktop_config.json');
} else {
  console.log('   Location: ~/.config/claude/claude_desktop_config.json');
}

console.log('\n2. Restart Claude Desktop');
console.log('3. Test with: "List all my Fabric workspaces"');
console.log('4. For Spark monitoring: "Show me Spark applications in my workspace"');

console.log('\n🔐 Authentication:');
console.log('=' .repeat(40));
console.log('• Uses Azure CLI authentication (already configured)');
console.log('• Ensure you are logged in: az login');
console.log('• Account:', 'saravi@microsoft.com');

console.log('\n🛠️ Available Tool Categories:');
console.log('=' .repeat(40));
console.log('• Workspace & Item Management');
console.log('• Capacity & Pipeline Management');
console.log('• Power BI Integration');
console.log('• Advanced Spark Monitoring & Analytics');
console.log('• Health & Authentication Tools');

console.log('\n✨ Ready for production use with Claude Desktop!');
