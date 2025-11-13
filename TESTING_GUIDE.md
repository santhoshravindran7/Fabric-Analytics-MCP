# Microsoft Fabric Analytics MCP Server - Testing Guide

This guide provides comprehensive testing documentation for all APIs, tools, and authentication methods in the Microsoft Fabric Analytics MCP Server.

## 🧪 Test Suite Overview

The test suite includes multiple categories of tests to validate all functionality:

### 📋 Available Test Scripts

| Script | Command | Description | Type |
|--------|---------|-------------|------|
| **Azure CLI Auth** | `npm run test:azure-cli` | Tests Azure CLI authentication setup and token acquisition | Automated |
| **MCP Server Startup** | `npm run test:mcp-azure-cli` | Tests MCP server startup with Azure CLI auth | Automated |
| **All Functionality** | `npm run test:all` | Comprehensive test of all server functionality | Automated |
| **CRUD Operations** | `npm run test:crud` | Tests Fabric item CRUD operations | Interactive |
| **Notebook Management** | `npm run test:notebooks` | Tests notebook creation and management tools | Interactive |
| **Livy Integration** | `npm run test:livy` | Tests Livy API session and batch management | Interactive |
| **Spark Monitoring** | `npm run test:spark` | Tests Spark application monitoring tools | Interactive |
| **Complete Test Suite** | `npm run test:suite` | Runs all automated tests with comprehensive reporting | Automated |

## 🚀 Quick Start Testing

### 1. Run All Automated Tests
```bash
# Run the complete test suite (recommended first step)
npm run test:suite
```

### 2. Test Azure CLI Authentication
```bash
# Test Azure CLI setup and token acquisition
npm run test:azure-cli

# Test MCP server startup with Azure CLI
npm run test:mcp-azure-cli
```

### 3. Test Individual Tool Categories
```bash
# Test CRUD operations (interactive)
npm run test:crud

# Test notebook management (interactive)
npm run test:notebooks

# Test Livy API integration (interactive)
npm run test:livy

# Test Spark monitoring (interactive)
npm run test:spark
```

## 🔐 Authentication Testing

### Azure CLI Authentication (Recommended for Local Development)

**Prerequisites:**
1. Install Azure CLI: `winget install Microsoft.AzureCLI`
2. Login: `az login`
3. Verify: `az account show`

**Test Commands:**
```bash
# Test Azure CLI authentication
npm run test:azure-cli

# Expected output:
# ✅ Azure CLI is installed
# ✅ Successfully logged in to Azure
# ✅ Successfully obtained Microsoft Fabric access token
# ✅ Successfully obtained Power BI access token
```

**Test Results Validation:**
- Azure CLI installation check
- Login status verification
- Fabric token acquisition (`https://api.fabric.microsoft.com`)
- Power BI token acquisition (`https://api.powerbi.com`)

### Other Authentication Methods

**Bearer Token:**
- Test manually by providing a valid bearer token
- Use Power BI Embed Setup to generate tokens

**Service Principal:**
- Requires: Client ID, Client Secret, Tenant ID
- Test with environment variables or interactive input

**Device Code & Interactive:**
- Test with client credentials
- Suitable for headless environments and development

## 🛠️ Tool Testing Categories

### 1. CRUD Operations Testing

**Tools Tested:**
- `list-fabric-items` - List workspace items
- `create-fabric-item` - Create new items
- `get-fabric-item` - Get item details  
- `update-fabric-item` - Update existing items
- `delete-fabric-item` - Delete items

**Test Command:**
```bash
npm run test:crud
```

**What It Tests:**
- Request formatting for all CRUD operations
- Parameter validation
- Authentication method integration
- Workspace and item ID handling

### 2. Notebook Management Testing

**Tools Tested:**
- `create-fabric-notebook` - Create notebooks from templates
- `get-fabric-notebook-definition` - Retrieve notebook definitions
- `update-fabric-notebook-definition` - Update notebook content
- `run-fabric-notebook` - Execute notebooks with parameters

**Templates Tested:**
- `blank` - Basic notebook template
- `sales_analysis` - Sales data analysis template
- `nyc_taxi_analysis` - NYC taxi data template
- `data_exploration` - Data exploration template
- `machine_learning` - ML workflow template
- `custom` - Custom notebook definitions

**Test Command:**
```bash
npm run test:notebooks
```

**What It Tests:**
- Template generation and validation
- Custom notebook creation with Jupyter format
- Parameter passing and configuration
- Environment and lakehouse integration

### 3. Livy API Integration Testing

**Session Management Tools:**
- `create-livy-session` - Create Spark sessions
- `get-livy-session` - Get session details
- `list-livy-sessions` - List all sessions
- `delete-livy-session` - Delete sessions

**Statement Execution Tools:**
- `execute-livy-statement` - Execute SQL/Spark code
- `get-livy-statement` - Get statement results

**Batch Job Tools:**
- `create-livy-batch` - Create batch jobs
- `get-livy-batch` - Get batch status
- `list-livy-batches` - List all batches
- `delete-livy-batch` - Delete batches

**Test Command:**
```bash
npm run test:livy
```

**Sample SQL Statements Tested:**
```sql
SHOW TABLES
SELECT COUNT(*) FROM information_schema.tables
DESCRIBE SCHEMA default
```

**Sample Spark Code Tested:**
```python
spark.sql('SHOW TABLES').show()
df = spark.range(10)
df.show()
spark.sparkContext.parallelize([1,2,3,4,5]).collect()
```

### 4. Spark Application Monitoring Testing

**Monitoring Tools:**
- `get-workspace-spark-applications` - Workspace-level monitoring
- `get-notebook-spark-applications` - Notebook-specific monitoring
- `get-lakehouse-spark-applications` - Lakehouse-specific monitoring
- `get-spark-job-definition-applications` - Job definition monitoring
- `get-spark-application-details` - Detailed application info
- `cancel-spark-application` - Application cancellation
- `get-spark-monitoring-dashboard` - Comprehensive dashboard

**Test Command:**
```bash
npm run test:spark
```

**What It Tests:**
- Application status tracking
- Item-specific filtering
- Pagination support
- Application management capabilities

## 📊 Test Results Interpretation

### Automated Test Results

**✅ PASSED Tests:**
- All functionality is working correctly
- Authentication is properly configured
- Server starts successfully
- Tool validation completed

**❌ FAILED Tests:**
- Check error messages for specific issues
- Common issues:
  - Azure CLI not installed or not logged in
  - Build artifacts missing (run `npm run build`)
  - Port conflicts (port 3000 in use)
  - Authentication configuration errors

**🚫 ERROR Tests:**
- Unexpected errors during test execution
- Check logs for detailed error information

### Interactive Test Results

Interactive tests validate:
- Request formatting and parameter validation
- Tool argument structure
- Authentication method integration
- MCP protocol compliance

**Note:** Interactive tests simulate MCP tool calls but don't execute against live Fabric APIs. They validate that requests are properly formatted for the MCP server.

## 🔧 Troubleshooting Common Issues

### Azure CLI Issues

**"Azure CLI is not installed"**
```bash
# Install Azure CLI
winget install Microsoft.AzureCLI

# Or download from: https://aka.ms/installazurecliwindows
```

**"User is not logged in"**
```bash
# Login to Azure
az login

# Verify login status
az account show
```

**"No subscriptions found"**
```bash
# List available subscriptions
az account list

# Set active subscription
az account set --subscription "your-subscription-name"
```

### Server Startup Issues

**"Build not found"**
```bash
# Build the project
npm run build
```

**"Port 3000 in use"**
```bash
# Find processes using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /F /PID <process-id>
```

### Authentication Token Issues

**Token Expiration:**
- Bearer tokens expire after ~1 hour
- Azure CLI tokens are automatically refreshed
- Service principal tokens have longer validity

**Scope Issues:**
- Fabric API: `https://api.fabric.microsoft.com`
- Power BI API: `https://api.powerbi.com`

## 🎯 Best Practices for Testing

### 1. Start with Automated Tests
```bash
# Always run the complete test suite first
npm run test:suite
```

### 2. Use Azure CLI for Development
```bash
# Simplest authentication method for local testing
az login
npm run test:azure-cli
```

### 3. Test Authentication Methods
```bash
# Test different auth methods based on your use case
export FABRIC_AUTH_METHOD="azure_cli"      # Local development
export FABRIC_AUTH_METHOD="service_principal"  # Production
export FABRIC_AUTH_METHOD="bearer_token"   # Claude Desktop
```

### 4. Validate Tool Functionality
```bash
# Test each category of tools
npm run test:crud
npm run test:notebooks
npm run test:livy
npm run test:spark
```

### 5. Integration Testing
```bash
# Test with real MCP server
npm run build
npm run test:mcp-azure-cli
```

## 📈 Continuous Integration

### GitHub Actions / Azure DevOps

```yaml
# Sample CI pipeline steps
- name: Install dependencies
  run: npm install

- name: Build project
  run: npm run build

- name: Run automated tests
  run: npm run test:suite

- name: Test Azure CLI integration
  run: |
    az login --service-principal --username ${{ secrets.AZURE_CLIENT_ID }} --password ${{ secrets.AZURE_CLIENT_SECRET }} --tenant ${{ secrets.AZURE_TENANT_ID }}
    npm run test:azure-cli
```

## 🚀 Next Steps After Testing

1. **All Tests Passed:**
   - Configure Claude Desktop with your preferred authentication method
   - Start using the MCP server for Fabric analytics
   - Explore the available tools and capabilities

2. **Some Tests Failed:**
   - Review error messages and troubleshooting guide
   - Fix authentication or configuration issues
   - Re-run tests to validate fixes

3. **Ready for Production:**
   - Use Service Principal authentication
   - Deploy to Azure Kubernetes Service (AKS)
   - Set up monitoring and alerting

## 📚 Additional Resources

- **[Azure CLI Authentication Guide](docs/AZURE_CLI_AUTH.md)** - Detailed Azure CLI setup
- **[Authentication Setup Guide](AUTHENTICATION_SETUP.md)** - Complete authentication configuration
- **[Claude Desktop Configuration](CLAUDE_DESKTOP_CONFIG_EXAMPLES.md)** - Ready-to-use configs
- **[API Documentation](README.md#tools--capabilities)** - Complete tool reference

---

🎉 **Happy Testing!** Your Microsoft Fabric Analytics MCP Server is ready to provide powerful analytics capabilities to your AI workflows.
