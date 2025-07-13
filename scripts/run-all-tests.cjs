#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Microsoft Fabric Analytics MCP Server
 * Runs all test scripts and provides a comprehensive validation report
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Microsoft Fabric Analytics MCP Server - Complete Test Suite\n');

class TestRunner {
  constructor() {
    this.results = [];
    this.testScripts = [
      {
        name: 'Azure CLI Authentication',
        script: 'test:azure-cli',
        description: 'Tests Azure CLI authentication setup and token acquisition',
        category: 'Authentication'
      },
      {
        name: 'MCP Server with Azure CLI',
        script: 'test:mcp-azure-cli',
        description: 'Tests MCP server startup with Azure CLI authentication',
        category: 'Server'
      },
      {
        name: 'All Functionality',
        script: 'test:all',
        description: 'Comprehensive test of all MCP server functionality',
        category: 'Integration'
      },
      {
        name: 'CRUD Operations',
        script: 'test:crud',
        description: 'Tests Fabric item CRUD operations (interactive)',
        category: 'Tools',
        interactive: true
      },
      {
        name: 'Notebook Management',
        script: 'test:notebooks',
        description: 'Tests notebook creation and management (interactive)',
        category: 'Tools',
        interactive: true
      },
      {
        name: 'Livy Integration',
        script: 'test:livy',
        description: 'Tests Livy API integration (interactive)',
        category: 'Tools',
        interactive: true
      },
      {
        name: 'Spark Monitoring',
        script: 'test:spark',
        description: 'Tests Spark application monitoring (interactive)',
        category: 'Tools',
        interactive: true
      },
      {
        name: 'End-to-End Setup',
        script: 'setup:e2e',
        description: 'Sets up environment for end-to-end testing',
        category: 'E2E',
        interactive: true
      },
      {
        name: 'End-to-End Test',
        script: 'test:e2e',
        description: 'Complete workspace creation and job execution test',
        category: 'E2E',
        interactive: true,
        requiresSetup: true
      }
    ];
  }

  async runNonInteractiveTests() {
    console.log('🔍 Running Non-Interactive Tests...\n');
    
    const nonInteractiveTests = this.testScripts.filter(test => !test.interactive);
    
    for (const test of nonInteractiveTests) {
      await this.runTest(test);
    }
  }

  async runTest(test) {
    console.log(`🧪 Running: ${test.name}`);
    console.log(`📝 ${test.description}\n`);
    
    try {
      const result = await this.executeTest(test.script);
      this.results.push({
        name: test.name,
        category: test.category,
        status: result.code === 0 ? 'PASSED' : 'FAILED',
        output: result.output,
        error: result.error
      });
      
      if (result.code === 0) {
        console.log(`✅ ${test.name}: PASSED\n`);
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        if (result.error) {
          console.log(`   Error: ${result.error}\n`);
        }
      }
    } catch (error) {
      this.results.push({
        name: test.name,
        category: test.category,
        status: 'ERROR',
        error: error.message
      });
      console.log(`❌ ${test.name}: ERROR - ${error.message}\n`);
    }
  }

  async executeTest(scriptName) {
    return new Promise((resolve) => {
      const child = spawn('npm', ['run', scriptName], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, output, error });
      });

      child.on('error', (err) => {
        resolve({ code: 1, output: '', error: err.message });
      });
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;

    console.log(`\n📈 Overall Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🚫 Errors: ${errors}`);
    console.log(`📋 Total:  ${this.results.length}`);

    // Group by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    console.log(`\n📋 Results by Category:`);
    categories.forEach(category => {
      const categoryTests = this.results.filter(r => r.category === category);
      const categoryPassed = categoryTests.filter(r => r.status === 'PASSED').length;
      
      console.log(`\n🏷️  ${category}:`);
      categoryTests.forEach(test => {
        const status = test.status === 'PASSED' ? '✅' : test.status === 'FAILED' ? '❌' : '🚫';
        console.log(`  ${status} ${test.name}`);
      });
    });

    // Failed tests details
    const failedTests = this.results.filter(r => r.status === 'FAILED' || r.status === 'ERROR');
    if (failedTests.length > 0) {
      console.log(`\n🔍 Failed Test Details:`);
      failedTests.forEach(test => {
        console.log(`\n❌ ${test.name}:`);
        if (test.error) {
          console.log(`   Error: ${test.error}`);
        }
      });
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (passed === this.results.length) {
      console.log('🎉 All tests passed! Your MCP server is ready for use.');
      console.log('✅ Azure CLI authentication is working properly');
      console.log('✅ MCP server starts successfully');
      console.log('✅ All tool validation completed');
    } else {
      console.log('⚠️  Some tests failed. Please check the errors above.');
      
      if (failedTests.some(t => t.name.includes('Azure CLI'))) {
        console.log('🔧 Azure CLI issues detected:');
        console.log('   • Run: az login');
        console.log('   • Run: az account show');
        console.log('   • Ensure you have proper subscriptions');
      }
      
      if (failedTests.some(t => t.name.includes('MCP Server'))) {
        console.log('🔧 MCP Server issues detected:');
        console.log('   • Run: npm run build');
        console.log('   • Check for TypeScript compilation errors');
        console.log('   • Verify all dependencies are installed');
      }
    }

    // Interactive tests information
    const interactiveTests = this.testScripts.filter(test => test.interactive);
    if (interactiveTests.length > 0) {
      console.log(`\n📋 Interactive Tests Available:`);
      console.log('These tests require user input and should be run separately:');
      
      // Regular interactive tests
      const regularTests = interactiveTests.filter(test => test.category !== 'E2E');
      if (regularTests.length > 0) {
        console.log('\n🔧 Tool Testing:');
        regularTests.forEach(test => {
          console.log(`  🧪 npm run ${test.script} - ${test.description}`);
        });
      }
      
      // E2E tests
      const e2eTests = interactiveTests.filter(test => test.category === 'E2E');
      if (e2eTests.length > 0) {
        console.log('\n🚀 End-to-End Testing:');
        e2eTests.forEach(test => {
          console.log(`  🧪 npm run ${test.script} - ${test.description}`);
        });
        console.log('\n⚠️  E2E tests create real Fabric resources - ensure proper permissions!');
      }
    }

    console.log(`\n🚀 Next Steps:`);
    console.log('1. Fix any failed tests using the recommendations above');
    console.log('2. Run interactive tests to validate tool functionality');
    console.log('3. Setup and run end-to-end tests: npm run setup:e2e');
    console.log('4. Configure Claude Desktop with your preferred auth method');
    console.log('5. Start using the MCP server for Fabric analytics!');

    return {
      total: this.results.length,
      passed,
      failed,
      errors,
      success: failed === 0 && errors === 0
    };
  }

  async run() {
    console.log('🏁 Starting Complete Test Suite...\n');
    console.log('This will run all non-interactive tests automatically.\n');
    console.log('Interactive tests can be run separately using npm scripts.\n');
    
    await this.runNonInteractiveTests();
    
    const summary = this.generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 TEST SUITE COMPLETE');
    console.log('='.repeat(60));
    
    return summary;
  }
}

// Run the complete test suite
const testRunner = new TestRunner();
testRunner.run()
  .then(summary => {
    process.exit(summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
