#!/usr/bin/env node

/**
 * Local Testing Suite for MCP Fabric Analytics Server
 * 
 * This script provides multiple ways to test the MCP server and its tools locally:
 * 1. Direct MCP Protocol Testing
 * 2. Tool-by-Tool Validation
 * 3. Interactive Testing Mode
 * 4. Authentication Testing
 * 5. Performance Testing
 */

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

class MCPLocalTester {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Tool categories for organized testing
  getToolCategories() {
    return {
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
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async startServer() {
    this.log('Starting MCP Server for testing...');
    
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd()
    });

    return new Promise((resolve, reject) => {
      let hasStarted = false;
      
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          reject(new Error('Server startup timeout'));
        }
      }, 10000);

      this.serverProcess.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('MCP server running') || message.includes('Health endpoints available')) {
          hasStarted = true;
          clearTimeout(timeout);
          this.log('✅ MCP Server started successfully');
          resolve();
        }
      });

      this.serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async sendMCPRequest(method, params = {}) {
    if (!this.serverProcess) {
      throw new Error('Server not started');
    }

    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: method,
      params: params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      let responseBuffer = '';

      const dataHandler = (data) => {
        responseBuffer += data.toString();
        
        // Try to parse complete JSON responses
        const lines = responseBuffer.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('"id"')) {
            try {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                clearTimeout(timeout);
                this.serverProcess.stdout.removeListener('data', dataHandler);
                resolve(response);
                return;
              }
            } catch (e) {
              // Not a complete JSON yet, continue
            }
          }
        }
      };

      this.serverProcess.stdout.on('data', dataHandler);

      // Send the request
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async testToolsList() {
    this.log('Testing tools/list endpoint...');
    
    try {
      const response = await this.sendMCPRequest('tools/list');
      
      if (response.result && response.result.tools) {
        this.log(`✅ Found ${response.result.tools.length} tools`);
        
        // Show first few tools
        console.log('\n📋 Available Tools (first 10):');
        response.result.tools.slice(0, 10).forEach((tool, index) => {
          console.log(`  ${index + 1}. ${tool.name}: ${tool.description.substring(0, 60)}...`);
        });
        
        return response.result.tools;
      } else {
        this.log('❌ No tools found in response', 'ERROR');
        return [];
      }
    } catch (error) {
      this.log(`❌ Failed to get tools list: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async testSpecificTool(toolName, params = {}) {
    this.log(`Testing tool: ${toolName}`);
    
    // Default parameters for different tool types
    const defaultParams = {
      'validate-azure-cli-auth': {},
      'check-azure-cli-auth': {},
      'health-check': {},
      'server-status': {},
      'get-metrics': {},
      'list-fabric-workspaces': {
        bearerToken: 'test-token-will-use-simulation'
      },
      'list-fabric-items': {
        bearerToken: 'test-token-will-use-simulation',
        workspaceId: 'test-workspace-id'
      },
      'get-notebook-spark-applications': {
        bearerToken: 'test-token-will-use-simulation',
        workspaceId: 'test-workspace-id'
      }
    };

    const testParams = { ...defaultParams[toolName], ...params };

    try {
      const response = await this.sendMCPRequest('tools/call', {
        name: toolName,
        arguments: testParams
      });

      if (response.result) {
        this.log(`✅ Tool ${toolName} executed successfully`);
        
        // Show response content (truncated)
        const content = Array.isArray(response.result.content) 
          ? response.result.content[0]?.text || JSON.stringify(response.result)
          : JSON.stringify(response.result);
        
        console.log(`   Response: ${content.substring(0, 200)}...`);
        return response.result;
      } else if (response.error) {
        this.log(`❌ Tool ${toolName} failed: ${response.error.message}`, 'ERROR');
        return null;
      }
    } catch (error) {
      this.log(`❌ Failed to test tool ${toolName}: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async runQuickTests() {
    console.log('\n🧪 Running Quick Test Suite');
    console.log('=' .repeat(50));

    const quickTests = [
      'validate-azure-cli-auth',
      'health-check',
      'server-status',
      'list-fabric-workspaces',
      'get-notebook-spark-applications'
    ];

    for (const toolName of quickTests) {
      await this.testSpecificTool(toolName);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  async runCategoryTests(category) {
    const categories = this.getToolCategories();
    const tools = categories[category];
    
    if (!tools) {
      this.log(`❌ Category '${category}' not found`, 'ERROR');
      return;
    }

    console.log(`\n🧪 Testing Category: ${category}`);
    console.log('=' .repeat(50));

    for (const toolName of tools) {
      await this.testSpecificTool(toolName);
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
    }
  }

  async interactiveMode() {
    const categories = this.getToolCategories();
    
    while (true) {
      console.log('\n🎯 Interactive Testing Mode');
      console.log('=' .repeat(30));
      console.log('Options:');
      console.log('1. Test all tools (quick)');
      console.log('2. Test by category');
      console.log('3. Test specific tool');
      console.log('4. Get tools list');
      console.log('5. Test authentication');
      console.log('6. Exit');
      
      const choice = await this.prompt('Enter your choice (1-6): ');
      
      switch (choice) {
        case '1':
          await this.runQuickTests();
          break;
        case '2':
          console.log('\nAvailable Categories:');
          Object.keys(categories).forEach((cat, index) => {
            console.log(`  ${index + 1}. ${cat}`);
          });
          const catChoice = await this.prompt('Enter category number: ');
          const categoryName = Object.keys(categories)[parseInt(catChoice) - 1];
          if (categoryName) {
            await this.runCategoryTests(categoryName);
          }
          break;
        case '3':
          const toolName = await this.prompt('Enter tool name: ');
          await this.testSpecificTool(toolName);
          break;
        case '4':
          await this.testToolsList();
          break;
        case '5':
          await this.testSpecificTool('validate-azure-cli-auth');
          await this.testSpecificTool('check-azure-cli-auth');
          break;
        case '6':
          return;
        default:
          console.log('Invalid choice');
      }
    }
  }

  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  cleanup() {
    if (this.serverProcess && !this.serverProcess.killed) {
      this.log('Stopping MCP Server...');
      this.serverProcess.kill();
    }
    this.rl.close();
  }

  async runTestSuite() {
    try {
      console.log('🚀 MCP Fabric Analytics - Local Testing Suite');
      console.log('=' .repeat(60));
      
      // Start server
      await this.startServer();
      
      // Wait a bit for full initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test tools list first
      const tools = await this.testToolsList();
      
      if (tools.length === 0) {
        this.log('❌ No tools found - cannot continue testing', 'ERROR');
        return;
      }
      
      // Ask user what they want to test
      console.log('\nWhat would you like to test?');
      console.log('1. Quick test (5 core tools)');
      console.log('2. Interactive mode');
      console.log('3. All tools (full suite)');
      
      const choice = await this.prompt('Enter your choice (1-3): ');
      
      switch (choice) {
        case '1':
          await this.runQuickTests();
          break;
        case '2':
          await this.interactiveMode();
          break;
        case '3':
          const categories = this.getToolCategories();
          for (const category of Object.keys(categories)) {
            await this.runCategoryTests(category);
          }
          break;
        default:
          console.log('Invalid choice, running quick tests...');
          await this.runQuickTests();
      }
      
      console.log('\n✅ Testing completed!');
      
    } catch (error) {
      this.log(`❌ Test suite failed: ${error.message}`, 'ERROR');
    } finally {
      this.cleanup();
    }
  }
}

// Run the test suite if called directly
if (require.main === module) {
  const tester = new MCPLocalTester();
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Testing interrupted by user');
    tester.cleanup();
    process.exit(0);
  });
  
  tester.runTestSuite().catch(error => {
    console.error('❌ Fatal error:', error);
    tester.cleanup();
    process.exit(1);
  });
}

module.exports = MCPLocalTester;
