#!/usr/bin/env node

/**
 * Direct Tool Testing - Bypass MCP Protocol
 * 
 * This script tests individual tools by importing and calling them directly,
 * which is useful for debugging and development.
 */

const { spawn } = require('child_process');
const fs = require('fs');

class DirectToolTester {
  constructor() {
    this.testResults = [];
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  // Test Azure CLI authentication
  async testAzureCLI() {
    this.log('🔐 Testing Azure CLI Authentication...');
    
    return new Promise((resolve) => {
      const azCheck = spawn('az', ['account', 'show', '--output', 'json'], {
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
        if (code === 0 && output.trim()) {
          try {
            const account = JSON.parse(output);
            this.log('✅ Azure CLI authenticated successfully');
            console.log(`   Account: ${account.user?.name || 'Unknown'}`);
            console.log(`   Subscription: ${account.name}`);
            console.log(`   Tenant: ${account.tenantId}`);
            resolve({ success: true, account });
          } catch (parseError) {
            this.log('❌ Failed to parse Azure CLI output', 'ERROR');
            resolve({ success: false, error: 'Invalid JSON response' });
          }
        } else {
          this.log('❌ Azure CLI not authenticated', 'ERROR');
          console.log('   Run: az login');
          console.log(`   Error: ${error.trim()}`);
          resolve({ success: false, error: error.trim() });
        }
      });
    });
  }

  // Test server startup and basic functionality
  async testServerStartup() {
    this.log('🚀 Testing MCP Server Startup...');
    
    return new Promise((resolve) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        cwd: process.cwd()
      });

      let hasStarted = false;
      let output = '';

      const timeout = setTimeout(() => {
        if (!hasStarted) {
          this.log('⚠️ Server startup timeout (5 seconds)', 'WARN');
          serverProcess.kill();
          resolve({ success: false, error: 'Timeout' });
        }
      }, 5000);

      serverProcess.stderr.on('data', (data) => {
        const message = data.toString();
        output += message;
        
        if (message.includes('MCP server running') || message.includes('Health endpoints available')) {
          hasStarted = true;
          clearTimeout(timeout);
          this.log('✅ MCP Server started successfully');
          
          // Kill server after successful startup test
          setTimeout(() => {
            serverProcess.kill();
            resolve({ success: true, output: output.substring(0, 200) });
          }, 1000);
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`❌ Server startup failed: ${error.message}`, 'ERROR');
        resolve({ success: false, error: error.message });
      });

      serverProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (!hasStarted) {
          this.log(`❌ Server exited with code ${code}`, 'ERROR');
          resolve({ success: false, error: `Exit code ${code}` });
        }
      });
    });
  }

  // Test health endpoints
  async testHealthEndpoints() {
    this.log('🏥 Testing Health Endpoints...');
    
    // Start server in background
    const serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd()
    });

    // Wait for server to start
    await new Promise((resolve) => {
      serverProcess.stderr.on('data', (data) => {
        if (data.toString().includes('Health server listening')) {
          resolve();
        }
      });
      
      setTimeout(resolve, 3000); // Timeout after 3 seconds
    });

    const endpoints = [
      { path: '/health', name: 'Health Check' },
      { path: '/ready', name: 'Readiness Check' },
      { path: '/metrics', name: 'Metrics Endpoint' }
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const result = await this.testHttpEndpoint(`http://localhost:3000${endpoint.path}`);
        const success = result.status >= 200 && result.status < 300;
        
        this.log(`${success ? '✅' : '❌'} ${endpoint.name}: HTTP ${result.status}`);
        if (success && result.data) {
          console.log(`   Response: ${result.data.substring(0, 100)}...`);
        }
        
        results.push({
          endpoint: endpoint.name,
          success,
          status: result.status,
          data: result.data?.substring(0, 100)
        });
      } catch (error) {
        this.log(`❌ ${endpoint.name}: ${error.message}`, 'ERROR');
        results.push({
          endpoint: endpoint.name,
          success: false,
          error: error.message
        });
      }
    }

    // Clean up server
    serverProcess.kill();
    
    return results;
  }

  testHttpEndpoint(url) {
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            data: data
          });
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  // Test build and compilation
  async testBuildSystem() {
    this.log('🔧 Testing Build System...');
    
    const checks = [];
    
    // Check if TypeScript source exists
    const srcExists = fs.existsSync('src/index.ts');
    checks.push({
      name: 'TypeScript Source',
      success: srcExists,
      message: srcExists ? 'src/index.ts found' : 'src/index.ts missing'
    });

    // Check if build output exists
    const buildExists = fs.existsSync('build/index.js');
    checks.push({
      name: 'Build Output',
      success: buildExists,
      message: buildExists ? 'build/index.js found' : 'build/index.js missing'
    });

    // Check package.json
    const packageExists = fs.existsSync('package.json');
    if (packageExists) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      checks.push({
        name: 'Package Config',
        success: true,
        message: `${packageJson.name} v${packageJson.version}`
      });
    }

    // Check tsconfig.json
    const tsconfigExists = fs.existsSync('tsconfig.json');
    checks.push({
      name: 'TypeScript Config',
      success: tsconfigExists,
      message: tsconfigExists ? 'tsconfig.json found' : 'tsconfig.json missing'
    });

    checks.forEach(check => {
      this.log(`${check.success ? '✅' : '❌'} ${check.name}: ${check.message}`);
    });

    return checks;
  }

  // Test tool count in built file
  async testToolRegistration() {
    this.log('🛠️ Testing Tool Registration...');
    
    if (!fs.existsSync('build/index.js')) {
      this.log('❌ Built file not found - run npm run build first', 'ERROR');
      return { success: false, error: 'Build file missing' };
    }

    const buildContent = fs.readFileSync('build/index.js', 'utf8');
    
    // Count different types of registrations
    const serverToolCalls = (buildContent.match(/server\.tool\(/g) || []).length;
    const toolDefinitions = (buildContent.match(/name:\s*["'][^"']+["']/g) || []).length;
    const mcpServerRefs = (buildContent.match(/McpServer/g) || []).length;
    
    console.log(`   server.tool() calls: ${serverToolCalls}`);
    console.log(`   Tool name definitions: ${toolDefinitions}`);
    console.log(`   McpServer references: ${mcpServerRefs}`);
    
    // Check for specific tool names
    const sampleTools = [
      'list-fabric-workspaces',
      'validate-azure-cli-auth',
      'get-notebook-spark-applications'
    ];
    
    const foundTools = sampleTools.filter(tool => 
      buildContent.includes(tool)
    );
    
    console.log(`   Sample tools found: ${foundTools.length}/${sampleTools.length}`);
    foundTools.forEach(tool => console.log(`     ✅ ${tool}`));
    
    const success = serverToolCalls > 10 || foundTools.length >= 2;
    this.log(`${success ? '✅' : '❌'} Tool registration: ${success ? 'OK' : 'Insufficient tools found'}`);
    
    return {
      success,
      serverToolCalls,
      toolDefinitions,
      foundTools: foundTools.length,
      sampleTools: foundTools
    };
  }

  // Generate test report
  generateReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LOCAL TESTING REPORT');
    console.log('='.repeat(60));
    console.log(`🗓️ Generated: ${new Date().toISOString()}`);
    
    let passCount = 0;
    let totalTests = 0;
    
    Object.entries(results).forEach(([testName, result]) => {
      if (typeof result === 'object' && result !== null) {
        if (Array.isArray(result)) {
          // Health endpoints
          const passed = result.filter(r => r.success).length;
          const total = result.length;
          console.log(`\n🏥 ${testName}: ${passed}/${total} passed`);
          totalTests += total;
          passCount += passed;
        } else if (result.success !== undefined) {
          const icon = result.success ? '✅' : '❌';
          console.log(`\n${icon} ${testName}: ${result.success ? 'PASS' : 'FAIL'}`);
          if (result.error) console.log(`   Error: ${result.error}`);
          totalTests++;
          if (result.success) passCount++;
        }
      }
    });
    
    const percentage = Math.round((passCount / totalTests) * 100);
    console.log(`\n📈 Overall Score: ${passCount}/${totalTests} (${percentage}%)`);
    
    if (percentage >= 80) {
      console.log('🎉 Excellent! Your MCP server is ready for production.');
    } else if (percentage >= 60) {
      console.log('⚠️ Good, but some issues need attention.');
    } else {
      console.log('❌ Several issues detected. Review the failures above.');
    }
    
    console.log('\n🔗 Next Steps:');
    console.log('1. Fix any failed tests');
    console.log('2. Run: node test-local-tools.cjs (for full MCP protocol testing)');
    console.log('3. Test with Claude Desktop integration');
    
    console.log('\n' + '='.repeat(60));
  }

  async runAllTests() {
    console.log('🧪 Direct Tool Testing Suite');
    console.log('🔍 Testing without MCP protocol overhead');
    console.log('=' .repeat(60));
    
    const results = {};
    
    // Run all tests
    results.buildSystem = await this.testBuildSystem();
    results.toolRegistration = await this.testToolRegistration();
    results.azureCLI = await this.testAzureCLI();
    results.serverStartup = await this.testServerStartup();
    results.healthEndpoints = await this.testHealthEndpoints();
    
    // Generate report
    this.generateReport(results);
    
    return results;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DirectToolTester();
  
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = DirectToolTester;
