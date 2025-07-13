#!/usr/bin/env node

/**
 * Technical Setup Validation for Claude Desktop Testing
 * Validates build files and generates configuration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Claude Desktop Setup Validation\n');

class SetupValidator {
  constructor() {
    this.results = [];
  }

  log(status, message, details = null) {
    console.log(`${status} ${message}`);
    if (details) {
      console.log(`   ${details}`);
    }
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
      const tools = {
        'fabric_list_workspaces': content.includes('fabric_list_workspaces'),
        'fabric_create_workspace': content.includes('fabric_create_workspace'),
        'fabric_delete_workspace': content.includes('fabric_delete_workspace'),
        'fabric_assign_workspace_to_capacity': content.includes('fabric_assign_workspace_to_capacity')
      };
      
      const toolCount = Object.values(tools).filter(Boolean).length;
      
      if (toolCount === 4) {
        this.log('✅', 'All new workspace management tools found in build');
        this.results.push({ test: 'Build Files', status: 'PASS' });
        return true;
      } else {
        this.log('❌', `Missing workspace tools (${toolCount}/4 found)`);
        Object.entries(tools).forEach(([tool, found]) => {
          this.log(found ? '✅' : '❌', `  ${tool}`);
        });
        this.log('💡', 'Run: npm run build');
        this.results.push({ test: 'Build Files', status: 'FAIL', error: `Missing ${4-toolCount} tools` });
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
    const absolutePath = path.resolve(buildPath).replace(/\\/g, '/'); // Use forward slashes for JSON
    
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
    
    return { config, configLocation };
  }

  checkPackageJson() {
    this.log('🔍', 'Checking package.json scripts...');
    
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      const requiredScripts = ['setup:e2e', 'test:e2e', 'test:suite', 'build'];
      const foundScripts = requiredScripts.filter(script => scripts[script]);
      
      if (foundScripts.length === requiredScripts.length) {
        this.log('✅', 'All required npm scripts found');
        this.results.push({ test: 'NPM Scripts', status: 'PASS' });
        return true;
      } else {
        const missing = requiredScripts.filter(script => !scripts[script]);
        this.log('❌', `Missing npm scripts: ${missing.join(', ')}`);
        this.results.push({ test: 'NPM Scripts', status: 'FAIL', error: `Missing: ${missing.join(', ')}` });
        return false;
      }
    } else {
      this.log('❌', 'package.json not found');
      this.results.push({ test: 'NPM Scripts', status: 'FAIL', error: 'package.json missing' });
      return false;
    }
  }

  printInstructions(configLocation) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 CLAUDE DESKTOP SETUP INSTRUCTIONS');
    console.log('='.repeat(60));

    console.log('\n🔧 Setup Steps:');
    console.log('1. Ensure Azure CLI is installed and you are logged in:');
    console.log('   • Download: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli');
    console.log('   • Login: az login');
    console.log('   • Test: az account show');
    
    console.log('\n2. Copy the Claude Desktop configuration:');
    console.log(`   • Copy: claude_desktop_config_example.json`);
    console.log(`   • To: ${configLocation}`);
    
    console.log('\n3. Restart Claude Desktop completely');
    
    console.log('\n4. Test the MCP connection in Claude Desktop:');
    console.log('   • Try: "List all my Fabric workspaces"');
    console.log('   • Or: "What MCP tools are available?"');
    
    console.log('\n🧪 Test Scenarios:');
    console.log('1. Basic workspace listing and management');
    console.log('2. Create a test workspace');
    console.log('3. Create notebooks and lakehouses');
    console.log('4. Execute notebook jobs');
    console.log('5. Monitor Spark applications');
    console.log('6. Clean up test resources');
    
    console.log('\n📚 Reference:');
    console.log('• Full testing guide: CLAUDE_DESKTOP_TESTING_GUIDE.md');
    console.log('• Troubleshooting: README.md');
    console.log('• E2E testing: npm run setup:e2e');
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log(`\n📈 Technical Setup:`);
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

    return failed === 0;
  }

  validate() {
    this.log('🚀', 'Starting technical setup validation...\n');
    
    try {
      // 1. Check build files
      const buildOk = this.checkBuildFiles();
      
      // 2. Check package.json scripts
      const scriptsOk = this.checkPackageJson();
      
      // 3. Generate Claude config
      const { config, configLocation } = this.generateClaudeConfig();
      
      // 4. Print summary
      const success = this.printSummary();
      
      // 5. Print instructions
      this.printInstructions(configLocation);
      
      if (success) {
        console.log('\n🎉 Technical setup validation passed!');
        console.log('📋 Ready for Claude Desktop testing once Azure CLI is configured.');
      } else {
        console.log('\n⚠️  Please fix the issues above before proceeding.');
      }
      
      return success;
      
    } catch (error) {
      this.log('❌', `Validation failed: ${error.message}`);
      return false;
    }
  }
}

// Run validation
const validator = new SetupValidator();
const success = validator.validate();
process.exit(success ? 0 : 1);
