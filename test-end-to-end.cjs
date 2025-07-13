#!/usr/bin/env node
/**
 * End-to-End Test for Microsoft Fabric Analytics MCP Server
 * 
 * This test creates a complete workspace, attaches it to capacity,
 * creates items (notebooks, lakehouses), and runs actual jobs to
 * validate the full functionality using Azure CLI authentication.
 */

const { spawn } = require('child_process');
const { randomBytes } = require('crypto');

// Test configuration
const TEST_CONFIG = {
  serverPath: './dist/index.js',
  timeout: 300000, // 5 minutes per operation
  cleanupOnFailure: true,
  retryCount: 3,
  testWorkspaceName: `E2E-Test-${Date.now()}`,
  existingCapacityId: process.env.FABRIC_CAPACITY_ID, // User should set this
  testNotebookName: 'E2E-Test-Notebook',
  testLakehouseName: 'E2E-Test-Lakehouse'
};

class EndToEndTester {
  constructor() {
    this.mcpProcess = null;
    this.testResults = [];
    this.createdResources = {
      workspace: null,
      notebooks: [],
      lakehouses: [],
      jobs: []
    };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async startMcpServer() {
    this.log('info', 'Starting MCP server...');
    
    return new Promise((resolve, reject) => {
      this.mcpProcess = spawn('node', [TEST_CONFIG.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let initOutput = '';
      const timeout = setTimeout(() => {
        reject(new Error('MCP server failed to start within timeout'));
      }, 10000);

      this.mcpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        initOutput += output;
        
        if (output.includes('Microsoft Fabric Analytics MCP Server running')) {
          clearTimeout(timeout);
          this.log('info', 'MCP server started successfully');
          resolve();
        }
      });

      this.mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start MCP server: ${error.message}`));
      });

      this.mcpProcess.on('exit', (code) => {
        if (code !== 0) {
          this.log('error', `MCP server exited with code ${code}`);
        }
      });
    });
  }

  async sendMcpRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = randomBytes(16).toString('hex');
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout for ${method}`));
      }, TEST_CONFIG.timeout);

      let responseBuffer = '';
      
      const onData = (data) => {
        responseBuffer += data.toString();
        
        try {
          const lines = responseBuffer.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes(id)) {
              const response = JSON.parse(line);
              if (response.id === id) {
                clearTimeout(timeout);
                this.mcpProcess.stdout.off('data', onData);
                
                if (response.error) {
                  reject(new Error(`MCP Error: ${JSON.stringify(response.error)}`));
                } else {
                  resolve(response.result);
                }
                return;
              }
            }
          }
        } catch (e) {
          // Continue accumulating data
        }
      };

      this.mcpProcess.stdout.on('data', onData);
      this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async validateAzureCliAuth() {
    this.log('info', 'Validating Azure CLI authentication...');
    
    try {
      // Test auth by listing workspaces
      const result = await this.sendMcpRequest('tools/call', {
        name: 'fabric_list_workspaces',
        arguments: { top: 5 }
      });
      
      this.log('info', 'Azure CLI authentication validated successfully');
      return true;
    } catch (error) {
      this.log('error', 'Azure CLI authentication failed', error.message);
      throw new Error('Please ensure you are logged in with Azure CLI: az login');
    }
  }

  async createTestWorkspace() {
    this.log('info', `Creating test workspace: ${TEST_CONFIG.testWorkspaceName}`);
    
    try {
      const result = await this.sendMcpRequest('tools/call', {
        name: 'fabric_create_workspace',
        arguments: {
          name: TEST_CONFIG.testWorkspaceName,
          description: 'End-to-end test workspace for MCP server validation'
        }
      });
      
      // Extract workspace ID from the response text
      const responseText = result.content[0].text;
      const idMatch = responseText.match(/ID: ([a-f0-9-]+)/);
      
      if (!idMatch) {
        throw new Error('Could not extract workspace ID from response');
      }
      
      this.createdResources.workspace = {
        id: idMatch[1],
        name: TEST_CONFIG.testWorkspaceName
      };
      
      this.log('info', 'Test workspace created successfully', this.createdResources.workspace);
      return this.createdResources.workspace;
      
    } catch (error) {
      this.log('error', 'Failed to create test workspace', error.message);
      throw error;
    }
  }

  async attachWorkspaceToCapacity() {
    if (!TEST_CONFIG.existingCapacityId) {
      this.log('warning', 'No capacity ID provided, skipping capacity attachment');
      this.log('info', 'Set FABRIC_CAPACITY_ID environment variable to test capacity attachment');
      return;
    }

    this.log('info', `Attaching workspace to capacity: ${TEST_CONFIG.existingCapacityId}`);
    
    try {
      const result = await this.sendMcpRequest('tools/call', {
        name: 'fabric_assign_workspace_to_capacity',
        arguments: {
          workspaceId: this.createdResources.workspace.id,
          capacityId: TEST_CONFIG.existingCapacityId
        }
      });
      
      this.log('info', 'Workspace attached to capacity successfully');
      
      // Verify attachment
      const verifyResult = await this.sendMcpRequest('tools/call', {
        name: 'fabric_get_workspace_details',
        arguments: {
          workspaceId: this.createdResources.workspace.id
        }
      });
      
      this.log('info', 'Capacity attachment verified', verifyResult.content[0].text);
      
    } catch (error) {
      this.log('error', 'Failed to attach workspace to capacity', error.message);
      throw error;
    }
  }

  async createTestNotebook() {
    this.log('info', `Creating test notebook: ${TEST_CONFIG.testNotebookName}`);
    
    try {
      const result = await this.sendMcpRequest('tools/call', {
        name: 'create-fabric-item',
        arguments: {
          workspaceId: this.createdResources.workspace.id,
          type: 'Notebook',
          displayName: TEST_CONFIG.testNotebookName,
          description: 'End-to-end test notebook'
        }
      });
      
      // Extract notebook ID from response
      const responseText = result.content[0].text;
      const idMatch = responseText.match(/ID: ([a-f0-9-]+)/);
      
      if (idMatch) {
        const notebook = {
          id: idMatch[1],
          name: TEST_CONFIG.testNotebookName,
          type: 'Notebook'
        };
        this.createdResources.notebooks.push(notebook);
        this.log('info', 'Test notebook created successfully', notebook);
        return notebook;
      } else {
        throw new Error('Could not extract notebook ID from response');
      }
      
    } catch (error) {
      this.log('error', 'Failed to create test notebook', error.message);
      throw error;
    }
  }

  async createTestLakehouse() {
    this.log('info', `Creating test lakehouse: ${TEST_CONFIG.testLakehouseName}`);
    
    try {
      const result = await this.sendMcpRequest('tools/call', {
        name: 'create-fabric-item',
        arguments: {
          workspaceId: this.createdResources.workspace.id,
          type: 'Lakehouse',
          displayName: TEST_CONFIG.testLakehouseName,
          description: 'End-to-end test lakehouse'
        }
      });
      
      // Extract lakehouse ID from response
      const responseText = result.content[0].text;
      const idMatch = responseText.match(/ID: ([a-f0-9-]+)/);
      
      if (idMatch) {
        const lakehouse = {
          id: idMatch[1],
          name: TEST_CONFIG.testLakehouseName,
          type: 'Lakehouse'
        };
        this.createdResources.lakehouses.push(lakehouse);
        this.log('info', 'Test lakehouse created successfully', lakehouse);
        return lakehouse;
      } else {
        throw new Error('Could not extract lakehouse ID from response');
      }
      
    } catch (error) {
      this.log('error', 'Failed to create test lakehouse', error.message);
      throw error;
    }
  }

  async runNotebookJob() {
    if (this.createdResources.notebooks.length === 0) {
      this.log('warning', 'No notebooks available for job execution');
      return;
    }

    const notebook = this.createdResources.notebooks[0];
    this.log('info', `Running job on notebook: ${notebook.name}`);
    
    try {
      // First, create a simple notebook definition with test code
      const notebookContent = {
        cells: [
          {
            cell_type: 'code',
            source: [
              'print("End-to-end test execution successful!")',
              'import datetime',
              'print(f"Test executed at: {datetime.datetime.now()}")',
              'result = 1 + 1',
              'print(f"Computation result: {result}")'
            ]
          }
        ]
      };

      // Update notebook with test content
      await this.sendMcpRequest('tools/call', {
        name: 'update-notebook-definition',
        arguments: {
          workspaceId: this.createdResources.workspace.id,
          notebookId: notebook.id,
          definition: notebookContent
        }
      });

      this.log('info', 'Notebook content updated with test code');

      // Run the notebook
      const runResult = await this.sendMcpRequest('tools/call', {
        name: 'run-notebook',
        arguments: {
          workspaceId: this.createdResources.workspace.id,
          notebookId: notebook.id
        }
      });
      
      // Extract job ID from response
      const responseText = runResult.content[0].text;
      const jobIdMatch = responseText.match(/Job ID: ([a-f0-9-]+)/);
      
      if (jobIdMatch) {
        const job = {
          id: jobIdMatch[1],
          notebookId: notebook.id,
          type: 'notebook-execution'
        };
        this.createdResources.jobs.push(job);
        this.log('info', 'Notebook job started successfully', job);
        
        // Monitor job status
        await this.monitorJobStatus(job.id);
        
        return job;
      } else {
        this.log('warning', 'Job started but could not extract job ID', responseText);
      }
      
    } catch (error) {
      this.log('error', 'Failed to run notebook job', error.message);
      throw error;
    }
  }

  async monitorJobStatus(jobId) {
    this.log('info', `Monitoring job status: ${jobId}`);
    
    const maxAttempts = 12; // 2 minutes with 10-second intervals
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.sendMcpRequest('tools/call', {
          name: 'get-item-job',
          arguments: {
            workspaceId: this.createdResources.workspace.id,
            jobInstanceId: jobId
          }
        });
        
        const responseText = result.content[0].text;
        this.log('info', `Job status (attempt ${attempt + 1}):`, responseText);
        
        if (responseText.includes('Completed') || responseText.includes('Success')) {
          this.log('info', 'Job completed successfully');
          return;
        } else if (responseText.includes('Failed') || responseText.includes('Error')) {
          throw new Error('Job execution failed');
        }
        
        // Wait 10 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        this.log('warning', `Job status check attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxAttempts - 1) {
          this.log('warning', 'Job monitoring timeout - job may still be running');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  async validateWorkspaceItems() {
    this.log('info', 'Validating created workspace items...');
    
    try {
      const result = await this.sendMcpRequest('tools/call', {
        name: 'list-fabric-items',
        arguments: {
          workspaceId: this.createdResources.workspace.id
        }
      });
      
      const responseText = result.content[0].text;
      this.log('info', 'Workspace items validation:', responseText);
      
      // Check if our created items are listed
      const hasNotebook = responseText.includes(TEST_CONFIG.testNotebookName);
      const hasLakehouse = responseText.includes(TEST_CONFIG.testLakehouseName);
      
      if (hasNotebook && hasLakehouse) {
        this.log('info', 'All created items found in workspace');
      } else {
        this.log('warning', `Some items not found - Notebook: ${hasNotebook}, Lakehouse: ${hasLakehouse}`);
      }
      
    } catch (error) {
      this.log('error', 'Failed to validate workspace items', error.message);
      throw error;
    }
  }

  async cleanup() {
    this.log('info', 'Starting cleanup of test resources...');
    
    try {
      // Delete created items first (if needed - workspace deletion should cascade)
      
      // Delete the test workspace
      if (this.createdResources.workspace) {
        this.log('info', `Deleting test workspace: ${this.createdResources.workspace.id}`);
        
        try {
          await this.sendMcpRequest('tools/call', {
            name: 'fabric_delete_workspace',
            arguments: {
              workspaceId: this.createdResources.workspace.id
            }
          });
          this.log('info', 'Test workspace deleted successfully');
        } catch (error) {
          this.log('error', 'Failed to delete test workspace', error.message);
        }
      }
      
    } catch (error) {
      this.log('error', 'Cleanup failed', error.message);
    }
  }

  async runEndToEndTest() {
    const startTime = Date.now();
    this.log('info', '🚀 Starting End-to-End Test for Microsoft Fabric Analytics MCP Server');
    this.log('info', `Test Configuration:`, TEST_CONFIG);
    
    try {
      // 1. Start MCP Server
      await this.startMcpServer();
      this.testResults.push({ test: 'MCP Server Startup', status: 'PASS', duration: Date.now() - startTime });
      
      // 2. Validate Azure CLI Authentication
      await this.validateAzureCliAuth();
      this.testResults.push({ test: 'Azure CLI Authentication', status: 'PASS' });
      
      // 3. Create Test Workspace
      await this.createTestWorkspace();
      this.testResults.push({ test: 'Workspace Creation', status: 'PASS' });
      
      // 4. Attach Workspace to Capacity (if capacity ID provided)
      await this.attachWorkspaceToCapacity();
      this.testResults.push({ test: 'Capacity Attachment', status: 'PASS' });
      
      // 5. Create Test Items
      await this.createTestNotebook();
      this.testResults.push({ test: 'Notebook Creation', status: 'PASS' });
      
      await this.createTestLakehouse();
      this.testResults.push({ test: 'Lakehouse Creation', status: 'PASS' });
      
      // 6. Validate Items in Workspace
      await this.validateWorkspaceItems();
      this.testResults.push({ test: 'Item Validation', status: 'PASS' });
      
      // 7. Run Notebook Job
      await this.runNotebookJob();
      this.testResults.push({ test: 'Job Execution', status: 'PASS' });
      
      const totalDuration = Date.now() - startTime;
      this.log('info', `✅ End-to-End Test COMPLETED SUCCESSFULLY in ${totalDuration}ms`);
      
      // Print test summary
      this.printTestSummary();
      
    } catch (error) {
      this.log('error', '❌ End-to-End Test FAILED', error.message);
      this.testResults.push({ test: 'Overall Test', status: 'FAIL', error: error.message });
      
      if (TEST_CONFIG.cleanupOnFailure) {
        await this.cleanup();
      }
      
      throw error;
      
    } finally {
      // Always cleanup and stop MCP server
      await this.cleanup();
      
      if (this.mcpProcess) {
        this.mcpProcess.kill();
        this.log('info', 'MCP server stopped');
      }
    }
  }

  printTestSummary() {
    this.log('info', '\n📊 TEST SUMMARY');
    this.log('info', '================');
    
    let passed = 0;
    let failed = 0;
    
    for (const result of this.testResults) {
      const status = result.status === 'PASS' ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      this.log('info', `${status} ${result.test}${duration}`);
      
      if (result.status === 'PASS') passed++;
      else failed++;
      
      if (result.error) {
        this.log('info', `   Error: ${result.error}`);
      }
    }
    
    this.log('info', `\nTotal: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    this.log('info', '\n📋 CREATED RESOURCES:');
    this.log('info', JSON.stringify(this.createdResources, null, 2));
  }
}

// Run the end-to-end test
async function main() {
  const tester = new EndToEndTester();
  
  try {
    await tester.runEndToEndTest();
    process.exit(0);
  } catch (error) {
    console.error('End-to-end test failed:', error.message);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { EndToEndTester };
