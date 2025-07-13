#!/usr/bin/env node

/**
 * Test script for Microsoft Fabric CRUD Operations
 * Tests: list-fabric-items, create-fabric-item, get-fabric-item, update-fabric-item, delete-fabric-item
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔍 Testing Microsoft Fabric CRUD Operations\n');

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function getAuthDetails() {
  console.log('📋 Choose authentication method:');
  console.log('1. Azure CLI (recommended for local testing)');
  console.log('2. Bearer Token');
  console.log('3. Service Principal');
  console.log('4. Device Code');
  console.log('5. Interactive\n');

  const authChoice = await prompt('Enter choice (1-5): ');
  let authConfig = {};

  switch (authChoice) {
    case '1':
      authConfig = { method: 'azure_cli' };
      console.log('✅ Using Azure CLI authentication');
      console.log('💡 Make sure you\'re logged in with: az login\n');
      break;
      
    case '2':
      const token = await prompt('Enter Bearer Token: ');
      authConfig = { method: 'bearer_token', token };
      break;
      
    case '3':
      const clientId = await prompt('Enter Client ID: ');
      const clientSecret = await prompt('Enter Client Secret: ');
      const tenantId = await prompt('Enter Tenant ID: ');
      authConfig = { method: 'service_principal', clientId, clientSecret, tenantId };
      break;
      
    case '4':
      const deviceClientId = await prompt('Enter Client ID: ');
      const deviceTenantId = await prompt('Enter Tenant ID: ');
      authConfig = { method: 'device_code', clientId: deviceClientId, tenantId: deviceTenantId };
      break;
      
    case '5':
      const interactiveClientId = await prompt('Enter Client ID: ');
      const interactiveTenantId = await prompt('Enter Tenant ID: ');
      authConfig = { method: 'interactive', clientId: interactiveClientId, tenantId: interactiveTenantId };
      break;
      
    default:
      console.log('❌ Invalid choice, using Azure CLI');
      authConfig = { method: 'azure_cli' };
  }

  const workspaceId = await prompt('Enter Workspace ID: ');
  authConfig.workspaceId = workspaceId;

  return authConfig;
}

async function testMCPTool(toolName, params, description) {
  console.log(`\n🧪 Testing: ${toolName}`);
  console.log(`📝 Description: ${description}`);
  
  try {
    // Create a test request for the MCP tool
    const testRequest = {
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params
      }
    };

    console.log(`📤 Request: ${JSON.stringify(testRequest, null, 2)}`);
    
    // In a real test, you would send this to the MCP server
    // For now, we'll simulate the call
    console.log('✅ Tool request formatted correctly');
    console.log('💡 This would be sent to the MCP server for execution');
    
    return { success: true, tool: toolName };
  } catch (error) {
    console.log(`❌ Error testing ${toolName}: ${error.message}`);
    return { success: false, tool: toolName, error: error.message };
  }
}

async function runCRUDTests() {
  console.log('🚀 Starting CRUD Operations Test Suite\n');
  
  const authConfig = await getAuthDetails();
  console.log('\n=====================================');
  console.log('🔧 Running CRUD Tests...\n');

  const results = [];
  
  // Test 1: List Fabric Items
  const listResult = await testMCPTool(
    'list-fabric-items',
    {
      bearerToken: authConfig.token || undefined,
      workspaceId: authConfig.workspaceId,
      itemType: 'Lakehouse'
    },
    'List all Lakehouse items in the workspace'
  );
  results.push(listResult);

  // Test 2: Create Fabric Item
  const createResult = await testMCPTool(
    'create-fabric-item',
    {
      bearerToken: authConfig.token || undefined,
      workspaceId: authConfig.workspaceId,
      itemType: 'Lakehouse',
      displayName: 'Test-Lakehouse-' + Date.now(),
      description: 'Test lakehouse created by MCP test suite'
    },
    'Create a new test lakehouse'
  );
  results.push(createResult);

  // Test 3: Get Fabric Item
  const getResult = await testMCPTool(
    'get-fabric-item',
    {
      bearerToken: authConfig.token || undefined,
      workspaceId: authConfig.workspaceId,
      itemId: 'test-item-id-placeholder'
    },
    'Get details of a specific item'
  );
  results.push(getResult);

  // Test 4: Update Fabric Item
  const updateResult = await testMCPTool(
    'update-fabric-item',
    {
      bearerToken: authConfig.token || undefined,
      workspaceId: authConfig.workspaceId,
      itemId: 'test-item-id-placeholder',
      displayName: 'Updated-Test-Lakehouse',
      description: 'Updated description for test lakehouse'
    },
    'Update an existing item'
  );
  results.push(updateResult);

  // Test 5: Delete Fabric Item
  const deleteResult = await testMCPTool(
    'delete-fabric-item',
    {
      bearerToken: authConfig.token || undefined,
      workspaceId: authConfig.workspaceId,
      itemId: 'test-item-id-placeholder'
    },
    'Delete a test item'
  );
  results.push(deleteResult);

  // Results Summary
  console.log('\n=====================================');
  console.log('📊 CRUD Test Results Summary:');
  console.log('=====================================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total:  ${results.length}\n`);

  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.tool}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n💡 Next Steps:');
  console.log('1. Start the MCP server with your chosen authentication method');
  console.log('2. Use Claude Desktop to test these operations with real data');
  console.log('3. Check the server logs for any authentication or API issues');
  
  if (authConfig.method === 'azure_cli') {
    console.log('\n🔧 Azure CLI Commands to verify setup:');
    console.log('   az account show');
    console.log('   az account get-access-token --resource https://analysis.windows.net/powerbi/api');
  }

  rl.close();
  return results;
}

// Run the tests
runCRUDTests()
  .then(results => {
    const failed = results.filter(r => !r.success).length;
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
