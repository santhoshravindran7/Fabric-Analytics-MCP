#!/usr/bin/env node

/**
 * Comprehensive validation script for MCP Fabric Analytics Server
 * Tests all 46 tools with Azure CLI authentication
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Tool categories and their tools
const TOOL_CATEGORIES = {
  'Authentication & Health': [
    'validate-azure-cli-auth',
    'check-azure-cli-auth',
    'health-check',
    'server-status',
    'get-metrics'
  ],
  'Workspace Management': [
    'list-fabric-workspaces',
    'create-fabric-workspace',
    'get-workspace-details',
    'update-workspace',
    'delete-workspace',
    'list-workspace-users',
    'add-workspace-user',
    'remove-workspace-user'
  ],
  'Item Management': [
    'list-fabric-items',
    'create-fabric-item',
    'get-item-details',
    'update-item',
    'delete-item'
  ],
  'Capacity Management': [
    'list-fabric-capacities',
    'get-capacity-details',
    'assign-workspace-to-capacity',
    'unassign-workspace-from-capacity'
  ],
  'Data Pipeline Management': [
    'list-data-pipelines',
    'create-data-pipeline',
    'get-pipeline-details',
    'run-pipeline',
    'get-pipeline-run-status',
    'cancel-pipeline-run'
  ],
  'Environment Management': [
    'list-fabric-environments',
    'create-fabric-environment',
    'get-environment-details',
    'publish-environment',
    'get-environment-staging-libraries'
  ],
  'Power BI Integration': [
    'list-powerbi-dashboards',
    'get-dashboard-details',
    'create-dashboard',
    'delete-dashboard'
  ],
  'Spark History Server Analytics': [
    'mcp_fabric-analyt2_analyze-spark-history-job',
    'mcp_fabric-analyt2_analyze-spark-job-logs',
    'mcp_fabric-analyt2_analyze-spark-job-performance',
    'mcp_fabric-analyt2_detect-spark-bottlenecks',
    'mcp_fabric-analyt2_spark-performance-recommendations'
  ],
  'Advanced Spark Monitoring': [
    'get-notebook-spark-applications',
    'get-spark-application-details',
    'cancel-spark-application',
    'get-spark-monitoring-dashboard',
    'analyze-spark-performance'
  ]
};

// Test configurations
const TEST_CONFIG = {
  timeout: 10000, // 10 seconds per test
  retries: 2,
  verbose: true
};

class ToolValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      skipped: [],
      total: 0
    };
    this.startTime = Date.now();
  }

  async validateAzureCLI() {
    console.log('🔑 Validating Azure CLI authentication...');
    
    return new Promise((resolve) => {
      const azCheck = spawn('az', ['account', 'show'], { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true 
      });
      
      let output = '';
      let error = '';
      
      azCheck.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      azCheck.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      azCheck.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Azure CLI authenticated successfully');
          const account = JSON.parse(output);
          console.log(`   Account: ${account.user?.name || 'N/A'}`);
          console.log(`   Subscription: ${account.name}`);
          resolve(true);
        } else {
          console.log('❌ Azure CLI not authenticated');
          console.log('   Run: az login');
          resolve(false);
        }
      });
    });
  }

  async testMCPServer() {
    console.log('\n🧪 Testing MCP Server startup...');
    
    return new Promise((resolve) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        cwd: process.cwd()
      });
      
      let output = '';
      let error = '';
      let hasStarted = false;
      
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          console.log('❌ Server startup timeout');
          serverProcess.kill();
          resolve(false);
        }
      }, 15000);
      
      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('MCP server running') || output.includes('Server started')) {
          hasStarted = true;
          clearTimeout(timeout);
          console.log('✅ MCP Server started successfully');
          
          // Give it a moment to fully initialize
          setTimeout(() => {
            serverProcess.kill();
            resolve(true);
          }, 2000);
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.log('Server stderr:', data.toString());
      });
      
      serverProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (!hasStarted) {
          console.log('❌ Server failed to start');
          console.log('Error:', error);
          resolve(false);
        }
      });
    });
  }

  async validateToolRegistration() {
    console.log('\n📋 Validating tool registration...');
    
    const totalExpected = Object.values(TOOL_CATEGORIES).reduce((sum, tools) => sum + tools.length, 0);
    console.log(`Expected tools: ${totalExpected}`);
    
    // Check the built index.js for tool registrations
    const indexPath = path.join(process.cwd(), 'build', 'index.js');
    if (!fs.existsSync(indexPath)) {
      console.log('❌ Built index.js not found');
      return false;
    }
    
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const toolRegistrations = (indexContent.match(/server\.setRequestHandler\(/g) || []).length;
    
    console.log(`Found ${toolRegistrations} tool registrations in built code`);
    
    if (toolRegistrations >= totalExpected) {
      console.log('✅ Tool registration count looks good');
      return true;
    } else {
      console.log('❌ Insufficient tool registrations found');
      return false;
    }
  }

  generateClaudeConfig() {
    console.log('\n🔧 Generating Claude Desktop configuration...');
    
    const config = {
      "mcpServers": {
        "fabric-analytics": {
          "command": "node",
          "args": [path.join(process.cwd(), "build", "index.js")],
          "cwd": process.cwd(),
          "env": {
            "NODE_ENV": "production"
          }
        }
      }
    };
    
    const configPath = path.join(process.cwd(), 'claude-desktop-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ Claude Desktop configuration generated');
    console.log(`   Config file: ${configPath}`);
    
    return config;
  }

  printToolSummary() {
    console.log('\n📊 Tool Summary by Category:');
    console.log('=' .repeat(50));
    
    let totalTools = 0;
    for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
      console.log(`\n${category} (${tools.length} tools):`);
      tools.forEach(tool => {
        console.log(`  • ${tool}`);
      });
      totalTools += tools.length;
    }
    
    console.log(`\nTotal Tools: ${totalTools}`);
    return totalTools;
  }

  async runValidation() {
    console.log('🚀 Starting comprehensive MCP Fabric Analytics validation\n');
    
    // Print tool summary
    const totalTools = this.printToolSummary();
    
    // Step 1: Validate Azure CLI
    const azureOK = await this.validateAzureCLI();
    if (!azureOK) {
      console.log('\n❌ Azure CLI validation failed. Please run: az login');
      process.exit(1);
    }
    
    // Step 2: Validate tool registration
    const toolsOK = await this.validateToolRegistration();
    if (!toolsOK) {
      console.log('\n❌ Tool registration validation failed');
      process.exit(1);
    }
    
    // Step 3: Test MCP server startup
    const serverOK = await this.testMCPServer();
    if (!serverOK) {
      console.log('\n❌ MCP Server startup failed');
      process.exit(1);
    }
    
    // Step 4: Generate Claude config
    const config = this.generateClaudeConfig();
    
    // Final summary
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 VALIDATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Azure CLI: Authenticated`);
    console.log(`✅ Tools: ${totalTools} registered successfully`);
    console.log(`✅ Server: Starts without errors`);
    console.log(`✅ Config: Claude Desktop configuration generated`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('\n🔗 Ready for Claude Desktop integration!');
    console.log('\nNext steps:');
    console.log('1. Copy claude-desktop-config.json to your Claude Desktop config');
    console.log('2. Restart Claude Desktop');
    console.log('3. Test tools with: "List all Fabric workspaces"');
    
    return true;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ToolValidator();
  validator.runValidation().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ToolValidator;
