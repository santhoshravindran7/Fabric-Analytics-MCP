#!/usr/bin/env node

/**
 * Pre-Claude Desktop Test Validation
 * Ensures everything is ready for Claude Desktop testing
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Pre-Claude Desktop Test Validation\n');

class ClaudeTestValidator {
  constructor() {
    this.results = [];
  }

  log(status, message, details = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${status} ${message}`);
    if (details) {
      console.log(`   ${details}`);
    }
  }

  async checkAzureCli() {
    this.log('🔍', 'Checking Azure CLI authentication...');
    
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
            this.log('✅', 'Azure CLI authentication verified');
            this.log('ℹ️', `Logged in as: ${account.user?.name || 'Unknown'}`);
            this.log('ℹ️', `Subscription: ${account.name}`);
            this.results.push({ test: 'Azure CLI Auth', status: 'PASS' });
            resolve(true);
          } catch (e) {
            this.log('❌', 'Could not parse Azure account information');
            this.results.push({ test: 'Azure CLI Auth', status: 'FAIL', error: 'Parse error' });
            resolve(false);
          }
        } else {
          this.log('❌', 'Not logged in to Azure CLI');
          this.log('💡', 'Run: az login');
          this.results.push({ test: 'Azure CLI Auth', status: 'FAIL', error: 'Not logged in' });
          resolve(false);
        }
      });
    });
  }

  async checkFabricAccess() {
    this.log('🔍', 'Testing Fabric API access...');
    
    return new Promise((resolve) => {
      const azProcess = spawn('az', [
        'rest',
        '--method', 'GET',
        '--url', 'https://api.fabric.microsoft.com/v1/workspaces',
        '--query', 'value[0:3].{name:name,id:id,type:type}'
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
            const workspaces = JSON.parse(output);
            this.log('✅', 'Fabric API access verified');
            this.log('ℹ️', `Found ${workspaces.length} accessible workspaces`);
            if (workspaces.length > 0) {
              this.log('ℹ️', `Sample: ${workspaces[0].name} (${workspaces[0].type})`);
            }
            this.results.push({ test: 'Fabric API Access', status: 'PASS' });
            resolve(true);
          } catch (e) {
            this.log('❌', 'Could not parse Fabric API response');
            this.results.push({ test: 'Fabric API Access', status: 'FAIL', error: 'Parse error' });
            resolve(false);
          }
        } else {
          this.log('❌', 'Failed to access Fabric API');
          this.log('ℹ️', `Error: ${errorOutput}`);
          this.results.push({ test: 'Fabric API Access', status: 'FAIL', error: errorOutput });
          resolve(false);
        }
      });
    });
  }

  checkBuildFiles() {
    this.log('🔍', 'Checking MCP server build files...');
    
    const buildPath = path.join(process.cwd(), 'build', 'index.js');
    
    if (fs.existsSync(buildPath)) {
      const stats = fs.statSync(buildPath);
      this.log('✅', 'MCP server build file exists');
      this.log('ℹ️', `Size: ${Math.round(stats.size / 1024)}KB, Modified: ${stats.mtime.toISOString()}`);
      
      // Check for new workspace tools
      const content = fs.readFileSync(buildPath, 'utf8');
      const hasWorkspaceTools = content.includes('fabric_list_workspaces') && 
                               content.includes('fabric_create_workspace') && 
                               content.includes('fabric_delete_workspace');
      
      if (hasWorkspaceTools) {
        this.log('✅', 'New workspace management tools found in build');
        this.results.push({ test: 'Build Files', status: 'PASS' });
        return true;
      } else {
        this.log('❌', 'Missing workspace management tools in build');
        this.log('💡', 'Run: npm run build');
        this.results.push({ test: 'Build Files', status: 'FAIL', error: 'Missing workspace tools' });
        return false;
      }
    } else {
      this.log('❌', 'MCP server build file not found');
      this.log('💡', 'Run: npm run build');
      this.results.push({ test: 'Build Files', status: 'FAIL', error: 'Build file missing' });
      return false;
    }
  }

  generateClaudeConfig() {
    this.log('🔍', 'Generating Claude Desktop configuration...');
    
    const buildPath = path.join(process.cwd(), 'build', 'index.js');
    const absolutePath = path.resolve(buildPath);
    
    const config = {
      mcpServers: {
        "fabric-analytics": {
          command: "node",
          args: [absolutePath],
          env: {
            FABRIC_AUTH_METHOD: "azure-cli"
          }
        }
      }
    };

    const configPath = path.join(process.cwd(), 'claude_desktop_config_example.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    this.log('✅', 'Claude Desktop configuration generated');
    this.log('ℹ️', `Example config saved to: ${configPath}`);
    
    // Show platform-specific config location
    const platform = os.platform();
    let configLocation = '';
    
    if (platform === 'win32') {
      configLocation = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    } else if (platform === 'darwin') {
      configLocation = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
      configLocation = '~/.config/Claude/claude_desktop_config.json';
    }
    
    this.log('ℹ️', `Copy this config to: ${configLocation}`);
    this.results.push({ test: 'Claude Config', status: 'PASS' });
    
    return config;
  }

  async testMcpServer() {
    this.log('🔍', 'Testing MCP server startup...');
    
    return new Promise((resolve) => {
      const buildPath = path.join(process.cwd(), 'build', 'index.js');
      const mcpProcess = spawn('node', [buildPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FABRIC_AUTH_METHOD: 'azure-cli' }
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          mcpProcess.kill();
          this.log('❌', 'MCP server startup timeout');
          this.results.push({ test: 'MCP Server Startup', status: 'FAIL', error: 'Timeout' });
          resolve(false);
        }
      }, 10000);

      mcpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Microsoft Fabric Analytics MCP Server running')) {
          clearTimeout(timeout);
          started = true;
          mcpProcess.kill();
          this.log('✅', 'MCP server started successfully');
          this.results.push({ test: 'MCP Server Startup', status: 'PASS' });
          resolve(true);
        }
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.log('❌', `MCP server error: ${error.message}`);
        this.results.push({ test: 'MCP Server Startup', status: 'FAIL', error: error.message });
        resolve(false);
      });
    });
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log(`\n📈 Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total:  ${this.results.length}`);

    console.log(`\n📋 Test Details:`);
    this.results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${status} ${result.test}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    if (failed === 0) {
      console.log(`\n🎉 All validations passed! Ready for Claude Desktop testing.`);
      console.log(`\n🚀 Next Steps:`);
      console.log(`1. Copy the generated claude_desktop_config_example.json to your Claude config location`);
      console.log(`2. Restart Claude Desktop`);
      console.log(`3. Test the scenarios in CLAUDE_DESKTOP_TESTING_GUIDE.md`);
      console.log(`4. Start with: "List all my Fabric workspaces"`);
    } else {
      console.log(`\n⚠️  Some validations failed. Please fix the issues above before testing with Claude Desktop.`);
    }

    return failed === 0;
  }

  async validate() {
    this.log('🚀', 'Starting Claude Desktop test validation...\n');
    
    try {
      // 1. Check Azure CLI authentication
      await this.checkAzureCli();
      
      // 2. Test Fabric API access
      await this.checkFabricAccess();
      
      // 3. Check build files
      this.checkBuildFiles();
      
      // 4. Generate Claude config
      this.generateClaudeConfig();
      
      // 5. Test MCP server startup
      await this.testMcpServer();
      
      // 6. Print summary
      const success = this.printSummary();
      
      return success;
      
    } catch (error) {
      this.log('❌', `Validation failed: ${error.message}`);
      return false;
    }
  }
}

// Run validation
async function main() {
  const validator = new ClaudeTestValidator();
  const success = await validator.validate();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}
