#!/usr/bin/env node

/**
 * Test script for Azure CLI authentication
 * This script helps users verify their Azure CLI setup and test authentication
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testAzureCliAuth() {
  console.log('🔍 Testing Azure CLI Authentication Setup\n');

  try {
    // Step 1: Check Azure CLI installation
    console.log('1️⃣ Checking Azure CLI installation...');
    await execAsync('az --version');
    console.log('✅ Azure CLI is installed\n');

    // Step 2: Check login status
    console.log('2️⃣ Checking Azure login status...');
    const { stdout: accountInfo } = await execAsync('az account show --output json');
    const account = JSON.parse(accountInfo);
    
    console.log('✅ Successfully logged in to Azure');
    console.log(`   Account: ${account.user?.name || account.user?.type || 'Unknown'}`);
    console.log(`   Subscription: ${account.name} (${account.id})`);
    console.log(`   Tenant: ${account.tenantId}\n`);

    // Step 3: Test getting Fabric token
    console.log('3️⃣ Testing Microsoft Fabric token acquisition...');
    const fabricScope = 'https://api.fabric.microsoft.com/.default';
    const { stdout: tokenInfo } = await execAsync(`az account get-access-token --scope "${fabricScope}" --output json`);
    const token = JSON.parse(tokenInfo);
    
    if (token.accessToken) {
      console.log('✅ Successfully obtained Microsoft Fabric access token');
      console.log(`   Token type: ${token.tokenType || 'Bearer'}`);
      console.log(`   Expires: ${new Date(token.expiresOn).toISOString()}\n`);
    } else {
      throw new Error('Failed to get access token');
    }

    // Step 4: Test Power BI token (alternative scope)
    console.log('4️⃣ Testing Power BI API token acquisition...');
    const powerBiScope = 'https://analysis.windows.net/powerbi/api/.default';
    const { stdout: pbiTokenInfo } = await execAsync(`az account get-access-token --scope "${powerBiScope}" --output json`);
    const pbiToken = JSON.parse(pbiTokenInfo);
    
    if (pbiToken.accessToken) {
      console.log('✅ Successfully obtained Power BI access token');
      console.log(`   Token type: ${pbiToken.tokenType || 'Bearer'}`);
      console.log(`   Expires: ${new Date(pbiToken.expiresOn).toISOString()}\n`);
    } else {
      throw new Error('Failed to get Power BI access token');
    }

    console.log('🎉 All tests passed! You can now use Azure CLI authentication with the MCP server.\n');
    
    console.log('📋 To use Azure CLI authentication, set the following environment variable:');
    console.log('   FABRIC_AUTH_METHOD=azure_cli\n');
    
    console.log('💡 Example usage:');
    console.log('   export FABRIC_AUTH_METHOD=azure_cli');
    console.log('   npm run start\n');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('az: command not found') || errorMessage.includes("'az' is not recognized")) {
      console.error('❌ Azure CLI is not installed');
      console.error('\n📥 Install Azure CLI:');
      console.error('   Windows: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows');
      console.error('   macOS: brew install azure-cli');
      console.error('   Linux: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-linux');
      
    } else if (errorMessage.includes('Please run')) {
      console.error('❌ Azure CLI is installed but you are not logged in');
      console.error('\n🔐 Login to Azure:');
      console.error('   az login');
      console.error('   # Follow the browser prompts to complete authentication');
      
    } else if (errorMessage.includes('AADSTS')) {
      console.error('❌ Authentication error - your login may have expired');
      console.error('\n🔄 Try logging in again:');
      console.error('   az logout');
      console.error('   az login');
      
    } else {
      console.error(`❌ Test failed: ${errorMessage}`);
      console.error('\n🔧 Troubleshooting:');
      console.error('   1. Ensure you have the correct permissions for Microsoft Fabric');
      console.error('   2. Try: az login --tenant <your-tenant-id>');
      console.error('   3. Verify your account has access to Fabric workspaces');
    }
    
    process.exit(1);
  }
}

testAzureCliAuth().catch(console.error);
