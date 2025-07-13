#!/usr/bin/env node
/**
 * Setup script for End-to-End Testing
 * Helps users configure their environment for comprehensive testing
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class E2ESetup {
  constructor() {
    this.configFile = '.env.e2e';
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  async checkAzureCli() {
    this.log('info', 'Checking Azure CLI installation...');
    
    return new Promise((resolve) => {
      const azProcess = spawn('az', ['--version'], { stdio: 'pipe' });
      
      azProcess.on('exit', (code) => {
        if (code === 0) {
          this.log('info', '✅ Azure CLI is installed');
          resolve(true);
        } else {
          this.log('error', '❌ Azure CLI is not installed or not accessible');
          this.log('info', 'Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli');
          resolve(false);
        }
      });
      
      azProcess.on('error', () => {
        this.log('error', '❌ Azure CLI is not installed or not accessible');
        resolve(false);
      });
    });
  }

  async checkAzureLogin() {
    this.log('info', 'Checking Azure CLI login status...');
    
    return new Promise((resolve) => {
      const azProcess = spawn('az', ['account', 'show'], { stdio: 'pipe' });
      
      let output = '';
      azProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      azProcess.on('exit', (code) => {
        if (code === 0) {
          try {
            const account = JSON.parse(output);
            this.log('info', `✅ Logged in as: ${account.user?.name || 'Unknown'}`);
            this.log('info', `   Subscription: ${account.name} (${account.id})`);
            resolve(true);
          } catch (e) {
            this.log('error', '❌ Could not parse Azure account information');
            resolve(false);
          }
        } else {
          this.log('error', '❌ Not logged in to Azure CLI');
          this.log('info', 'Please run: az login');
          resolve(false);
        }
      });
    });
  }

  async listFabricCapacities() {
    this.log('info', 'Listing available Fabric capacities...');
    
    return new Promise((resolve) => {
      // Note: This uses the Azure REST API since there's no direct Azure CLI command for Fabric capacities yet
      const azProcess = spawn('az', [
        'rest',
        '--method', 'GET',
        '--url', 'https://api.fabric.microsoft.com/v1/capacities'
      ], { stdio: 'pipe' });
      
      let output = '';
      let errorOutput = '';
      
      azProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      azProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      azProcess.on('exit', (code) => {
        if (code === 0) {
          try {
            const response = JSON.parse(output);
            const capacities = response.value || [];
            
            if (capacities.length === 0) {
              this.log('warning', '⚠️  No Fabric capacities found');
              this.log('info', 'You may need to create a Fabric capacity in the Azure portal first');
              resolve([]);
            } else {
              this.log('info', `✅ Found ${capacities.length} Fabric capacities:`);
              capacities.forEach((capacity) => {
                this.log('info', `   - ${capacity.displayName} (${capacity.id})`);
                this.log('info', `     SKU: ${capacity.sku?.name || 'Unknown'}`);
                this.log('info', `     Region: ${capacity.region || 'Unknown'}`);
                this.log('info', '');
              });
            }
            resolve(capacities);
          } catch (e) {
            this.log('error', '❌ Could not parse capacities response');
            this.log('error', `Error: ${e.message}`);
            if (errorOutput) {
              this.log('error', `Azure CLI Error: ${errorOutput}`);
            }
            resolve([]);
          }
        } else {
          this.log('error', '❌ Failed to list Fabric capacities');
          this.log('error', `Azure CLI Error: ${errorOutput}`);
          this.log('info', 'Make sure you have access to Microsoft Fabric and the necessary permissions');
          resolve([]);
        }
      });
    });
  }

  async buildProject() {
    this.log('info', 'Building MCP server...');
    
    return new Promise((resolve) => {
      const npmProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
      
      npmProcess.on('exit', (code) => {
        if (code === 0) {
          this.log('info', '✅ MCP server built successfully');
          resolve(true);
        } else {
          this.log('error', '❌ Failed to build MCP server');
          resolve(false);
        }
      });
      
      npmProcess.on('error', (error) => {
        this.log('error', `❌ Build error: ${error.message}`);
        resolve(false);
      });
    });
  }

  createConfigFile(capacities) {
    this.log('info', 'Creating end-to-end test configuration...');
    
    let config = `# End-to-End Test Configuration
# This file contains environment variables for comprehensive testing

# Azure Authentication (automatically detected from Azure CLI)
# No additional configuration needed if you're logged in with 'az login'

# Optional: Fabric Capacity ID for workspace assignment testing
# Uncomment and set to one of your available capacity IDs:
`;

    if (capacities.length > 0) {
      config += `# FABRIC_CAPACITY_ID=${capacities[0].id}  # ${capacities[0].displayName}\n`;
      capacities.slice(1, 3).forEach((capacity) => {
        config += `# FABRIC_CAPACITY_ID=${capacity.id}  # ${capacity.displayName}\n`;
      });
    } else {
      config += `# FABRIC_CAPACITY_ID=your-capacity-id-here\n`;
    }

    config += `
# Test Configuration
E2E_TEST_TIMEOUT=300000
E2E_CLEANUP_ON_FAILURE=true
E2E_RETRY_COUNT=3

# Optional: Custom test names
# E2E_WORKSPACE_NAME=Custom-E2E-Test-Workspace
# E2E_NOTEBOOK_NAME=Custom-Test-Notebook
# E2E_LAKEHOUSE_NAME=Custom-Test-Lakehouse
`;

    fs.writeFileSync(this.configFile, config);
    this.log('info', `✅ Configuration file created: ${this.configFile}`);
    
    if (capacities.length > 0) {
      this.log('info', '💡 To test capacity assignment, uncomment and set FABRIC_CAPACITY_ID in the config file');
    }
  }

  async runQuickTest() {
    this.log('info', 'Running quick connectivity test...');
    
    return new Promise((resolve) => {
      const testProcess = spawn('node', ['test-auth.cjs'], { stdio: 'inherit' });
      
      testProcess.on('exit', (code) => {
        if (code === 0) {
          this.log('info', '✅ Quick test passed - ready for end-to-end testing');
          resolve(true);
        } else {
          this.log('error', '❌ Quick test failed - please check your configuration');
          resolve(false);
        }
      });
      
      testProcess.on('error', (error) => {
        this.log('error', `❌ Test error: ${error.message}`);
        resolve(false);
      });
    });
  }

  printInstructions() {
    this.log('info', '\n🎯 SETUP COMPLETE!');
    this.log('info', '================');
    this.log('info', '');
    this.log('info', 'Next steps:');
    this.log('info', '1. Review and edit the configuration file: .env.e2e');
    this.log('info', '2. Set FABRIC_CAPACITY_ID if you want to test capacity assignment');
    this.log('info', '3. Run the end-to-end test:');
    this.log('info', '   npm run test:e2e');
    this.log('info', '   # or directly: node test-end-to-end.cjs');
    this.log('info', '');
    this.log('info', 'The end-to-end test will:');
    this.log('info', '• Create a new Fabric workspace');
    this.log('info', '• Attach it to your capacity (if configured)');
    this.log('info', '• Create notebooks and lakehouses');
    this.log('info', '• Run actual jobs and monitor their execution');
    this.log('info', '• Clean up all created resources');
    this.log('info', '');
    this.log('info', '⚠️  Note: The test creates real resources in your Fabric tenant');
    this.log('info', '   Make sure you have the necessary permissions and capacity.');
  }

  async setup() {
    this.log('info', '🚀 Setting up End-to-End Testing Environment');
    this.log('info', '============================================');
    
    try {
      // 1. Check Azure CLI
      const hasAzureCli = await this.checkAzureCli();
      if (!hasAzureCli) {
        throw new Error('Azure CLI is required for end-to-end testing');
      }
      
      // 2. Check Azure login
      const isLoggedIn = await this.checkAzureLogin();
      if (!isLoggedIn) {
        throw new Error('Please log in to Azure CLI: az login');
      }
      
      // 3. Build project
      const buildSuccess = await this.buildProject();
      if (!buildSuccess) {
        throw new Error('Failed to build MCP server');
      }
      
      // 4. List Fabric capacities
      const capacities = await this.listFabricCapacities();
      
      // 5. Create configuration file
      this.createConfigFile(capacities);
      
      // 6. Run quick test
      const quickTestSuccess = await this.runQuickTest();
      if (!quickTestSuccess) {
        this.log('warning', '⚠️  Quick test failed, but continuing with setup');
      }
      
      // 7. Print instructions
      this.printInstructions();
      
      this.log('info', '✅ Setup completed successfully!');
      
    } catch (error) {
      this.log('error', `❌ Setup failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run setup
async function main() {
  const setup = new E2ESetup();
  await setup.setup();
}

if (require.main === module) {
  main();
}
