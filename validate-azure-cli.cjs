#!/usr/bin/env node

/**
 * Azure CLI Authentication Validation for MCP Server
 * This script validates that Azure CLI authentication is properly configured
 * and works seamlessly with Claude Desktop integration
 */

const { MicrosoftAuthClient, AuthMethod } = require('./build/index.js');

async function validateAzureCliAuth() {
    console.log('🚀 Azure CLI Authentication Validation for MCP Server');
    console.log('====================================================');
    
    try {
        // Create auth client
        const authClient = new MicrosoftAuthClient({
            clientId: 'dummy-client-id' // Not needed for Azure CLI auth
        });
        
        console.log('🔍 Step 1: Validating Azure CLI configuration...');
        const validation = await authClient.validateAzureCliForMCP();
        
        if (!validation.valid) {
            console.log(`❌ Validation failed: ${validation.message}`);
            if (validation.recommendations) {
                console.log('💡 Recommendations:');
                validation.recommendations.forEach((rec, index) => {
                    console.log(`   ${index + 1}. ${rec}`);
                });
            }
            process.exit(1);
        }
        
        console.log(`✅ ${validation.message}`);
        
        console.log('\n🔍 Step 2: Testing Azure CLI token acquisition...');
        const authResult = await authClient.authenticateWithAzureCli();
        
        console.log('✅ Token acquired successfully!');
        console.log(`   Token length: ${authResult.accessToken.length} characters`);
        console.log(`   Expires: ${authResult.expiresOn.toISOString()}`);
        console.log(`   Valid for: ${Math.round((authResult.expiresOn.getTime() - Date.now()) / 60000)} minutes`);
        
        console.log('\n🎉 Azure CLI authentication is properly configured!');
        console.log('\n📋 Summary:');
        console.log('✅ Azure CLI is installed and accessible');
        console.log('✅ User is logged in to Azure');
        console.log('✅ Microsoft Fabric API access token acquired');
        console.log('✅ Token is valid and not expired');
        console.log('\n🚀 Your MCP server will automatically authenticate users who have Azure CLI setup!');
        console.log('   Users will NOT need to manually provide bearer tokens.');
        console.log('   The server will seamlessly acquire tokens from Azure CLI.');
        
    } catch (error) {
        console.error('\n❌ Authentication validation failed:');
        console.error(`   Error: ${error.message}`);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Ensure Azure CLI is installed: az --version');
        console.error('   2. Login to Azure: az login');
        console.error('   3. Test Fabric access: az account get-access-token --scope https://api.fabric.microsoft.com/.default');
        console.error('   4. Verify permissions with your Azure/Fabric administrator');
        process.exit(1);
    }
}

if (require.main === module) {
    validateAzureCliAuth();
}

module.exports = { validateAzureCliAuth };
