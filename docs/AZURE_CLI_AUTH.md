# Azure CLI Authentication for Microsoft Fabric Analytics MCP

This guide explains how to use Azure CLI authentication for easy local testing of the Microsoft Fabric Analytics MCP server.

## 🎯 **Why Azure CLI Authentication?**

Azure CLI authentication provides the **easiest way** for users to test the MCP server locally by leveraging their existing Azure credentials without needing to:
- Register Azure applications
- Manage client secrets
- Handle complex authentication flows

## 🚀 **Quick Start**

### 1. **Install Azure CLI**

**Windows:**
```powershell
# Using winget
winget install Microsoft.AzureCLI

# Or download from: https://aka.ms/installazurecliwindows
```

**macOS:**
```bash
brew install azure-cli
```

**Linux:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### 2. **Login to Azure**

```bash
# Login with your Microsoft account
az login

# For specific tenant (if you have multiple)
az login --tenant <your-tenant-id>

# Verify login
az account show
```

### 3. **Test Authentication Setup**

```bash
# Run the built-in test script
npm run test:azure-cli
```

This will verify:
- ✅ Azure CLI installation
- ✅ Login status  
- ✅ Microsoft Fabric token acquisition
- ✅ Power BI API access

### 4. **Run MCP Server with Azure CLI Auth**

```bash
# Set authentication method
export FABRIC_AUTH_METHOD=azure_cli

# Start the server
npm run start
```

**Windows PowerShell:**
```powershell
$env:FABRIC_AUTH_METHOD="azure_cli"
npm run start
```

## 🔧 **Configuration Options**

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `FABRIC_AUTH_METHOD` | Yes | Set to `azure_cli` | `azure_cli` |
| `FABRIC_DEFAULT_WORKSPACE_ID` | Optional | Default workspace for operations | `12345678-1234-...` |

### Example Configuration

**.env file:**
```bash
# Authentication method
FABRIC_AUTH_METHOD=azure_cli

# Optional: Default workspace
FABRIC_DEFAULT_WORKSPACE_ID=12345678-1234-1234-1234-123456789abc

# Optional: Tenant ID for multi-tenant scenarios
FABRIC_TENANT_ID=87654321-4321-4321-4321-210987654321
```

## 🎭 **How It Works**

1. **Token Acquisition**: Uses `az account get-access-token` to get valid tokens
2. **Scope Management**: Automatically requests appropriate scopes:
   - `https://api.fabric.microsoft.com/.default` (Microsoft Fabric - primary)
   - `https://api.powerbi.com/.default` (Power BI)
3. **Token Caching**: Caches tokens until expiration for better performance
4. **Auto Refresh**: Automatically refreshes expired tokens

## 🔍 **Troubleshooting**

### **❌ "Azure CLI is not installed"**
```bash
# Install Azure CLI (see installation section above)
# Then verify:
az --version
```

### **❌ "Please run 'az login'"**
```bash
az login
# Follow browser prompts to complete authentication
```

### **❌ "Authentication error - login may have expired"**
```bash
az logout
az login
```

### **❌ "Failed to get access token"**
This usually means permission issues:

1. **Check Fabric Access:**
   ```bash
   # Test if you can access Fabric
   az account get-access-token --scope "https://api.fabric.microsoft.com/.default"
   ```

2. **Verify Permissions:**
   - Ensure your account has access to Microsoft Fabric
   - Check if you're in the correct tenant
   - Verify workspace permissions

3. **Try Specific Tenant:**
   ```bash
   az login --tenant <your-fabric-tenant-id>
   ```

### **❌ "Multiple subscriptions found"**
```bash
# Set default subscription
az account set --subscription "<subscription-name-or-id>"

# Or use specific subscription
az login --subscription "<subscription-id>"
```

## 🔒 **Security Considerations**

### **Permissions Required**
Your Azure account needs:
- **Microsoft Fabric Access**: Ability to access Fabric workspaces
- **Power BI Access**: Read/write permissions to Power BI content
- **Resource Access**: Permissions for specific workspaces/items you want to access

### **Token Scope**
Azure CLI authentication uses these scopes:
- `https://api.fabric.microsoft.com/.default` (Primary Fabric API)
- `https://api.powerbi.com/.default` (Power BI API when needed)

### **Best Practices**
- Use least-privilege accounts for testing
- Regularly rotate Azure credentials
- Use specific tenants when working with multiple organizations
- Monitor token usage in Azure AD logs

## 🚀 **Example Usage**

### **1. List Workspaces**
```bash
# Set auth method
export FABRIC_AUTH_METHOD=azure_cli

# Start MCP server
npm run start
```

Then in your MCP client:
```json
{
  "method": "tools/call",
  "params": {
    "name": "list-workspaces"
  }
}
```

### **2. Create Items**
```json
{
  "method": "tools/call", 
  "params": {
    "name": "create-fabric-item",
    "arguments": {
      "workspaceId": "your-workspace-id",
      "itemType": "Lakehouse",
      "displayName": "My Test Lakehouse"
    }
  }
}
```

### **3. Run Data Pipelines**
```json
{
  "method": "tools/call",
  "params": {
    "name": "fabric_run_data_pipeline",
    "arguments": {
      "workspaceId": "your-workspace-id", 
      "pipelineId": "your-pipeline-id"
    }
  }
}
```

## 🔄 **Token Lifecycle**

1. **First Request**: Acquires token using `az account get-access-token`
2. **Subsequent Requests**: Uses cached token if still valid
3. **Token Expiry**: Automatically refreshes when expired
4. **Error Handling**: Falls back to fresh authentication on failures

## 📊 **Monitoring**

The MCP server provides helpful logging:

```bash
✅ Azure CLI is installed
✅ Logged in as: user@company.com
   Subscription: My Subscription (12345...)
   Tenant: 87654321...
✅ Azure CLI authentication successful
```

## 🎯 **Benefits**

- ✅ **Zero Configuration**: No app registration needed
- ✅ **Familiar Flow**: Uses existing Azure login
- ✅ **Secure**: Leverages Azure's security infrastructure  
- ✅ **Multi-tenant**: Works across different tenants
- ✅ **Auto-refresh**: Handles token lifecycle automatically
- ✅ **Debugging**: Clear error messages and troubleshooting

## 🆚 **vs Other Auth Methods**

| Feature | Azure CLI | Service Principal | Interactive | Device Code |
|---------|-----------|-------------------|-------------|-------------|
| Setup Complexity | ⭐ Minimal | ⭐⭐⭐ Complex | ⭐⭐ Medium | ⭐⭐ Medium |
| Local Testing | ✅ Perfect | ❌ Not ideal | ⚠️ OK | ⚠️ OK |
| CI/CD | ❌ Not suitable | ✅ Perfect | ❌ Not suitable | ❌ Not suitable |
| Security | ✅ User-based | ✅ App-based | ✅ User-based | ✅ User-based |
| Convenience | ✅ Excellent | ❌ Poor | ⚠️ OK | ⚠️ OK |

**Recommendation**: Use Azure CLI for local development and testing, Service Principal for production/CI-CD.
