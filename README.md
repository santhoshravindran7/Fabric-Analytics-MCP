# Microsoft Fabric Analytics MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![GitHub issues](https://img.shields.io/github/issues/santhoshravindran7/Fabric-Analytics-MCP.svg)](https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues)
[![GitHub stars](https://img.shields.io/github/stars/santhoshravindran7/Fabric-Analytics-MCP.svg)](https://github.com/santhoshravindran7/Fabric-Analytics-MCP/stargazers)

A comprehensive Model Context Protocol (MCP) server that provides analytics capabilities and tools for interacting with Microsoft Fabric data platform. This server enables AI assistants like Claude to seamlessly access, analyze, and monitor Microsoft Fabric resources through standardized MCP protocols, bringing the power of Microsoft Fabric directly to your AI conversations.

## 📋 **Table of Contents**

- [🌟 Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [🛠️ Tools & Capabilities](#️-tools--capabilities)
- [🧪 Development & Testing](#-development--testing)
- [💬 Example Queries](#-example-queries)
- [🔐 Authentication](#-authentication)
- [🏗️ Architecture](#️-architecture)
- [⚙️ Configuration](#️-configuration)
- [🤝 Contributing](#-contributing)
- [🔒 Security](#-security)
- [📝 License](#-license)
- [📞 Support](#-support)

## 🌟 **Key Features**

- **🏗️ Complete Workspace Management** - Create, delete, and manage Fabric workspaces with capacity assignment
- **🔄 Enhanced CRUD Operations** - Create, read, update, and delete all Fabric items (notebooks, lakehouses, datasets, reports)
- **📓 Advanced Notebook Management** - Create, execute, and manage Fabric notebooks with 5 predefined templates
- **⚡ Livy API Integration** - Full Spark session and batch job management with real-time monitoring
- **📊 Comprehensive Spark Monitoring** - Real-time monitoring across workspaces, items, and applications
- **🤖 Multi-AI Assistant Support** - Works with Claude Desktop, GitHub Copilot, and other MCP-compatible AI tools
- **🔐 Enhanced Azure CLI Authentication** - Zero-config setup with automatic token management
- **�️ Enterprise Authentication** - Multiple auth methods (Bearer, Service Principal, Device Code, Interactive, Azure CLI)
- **📈 Analytics & Insights** - Generate comprehensive monitoring dashboards with real-time metrics
- **🧪 End-to-End Testing** - Complete test suite with real workspace creation and job execution
- **🔄 Advanced Token Management** - Automatic token validation, refresh, and expiration handling
- **☸️ Enterprise Deployment** - Full Kubernetes and Azure deployment support with auto-scaling
- **🔄 Docker Support** - Containerized deployment with health checks and monitoring
- **📊 Monitoring & Observability** - Built-in Prometheus metrics and Grafana dashboards
- **🚀 Azure MCP Server** - Native Azure hosting option (preview)
- **🎯 48 Total Tools** - Comprehensive coverage of Fabric operations (up from 31 tools)

## 🏗️ **New Workspace Management Features**

### **🆕 Latest Updates - Comprehensive Workspace Operations**

The MCP server now includes **21 new workspace management tools** that enable complete workspace lifecycle management:

### **🌟 Core Workspace Operations**
- **fabric_list_workspaces** - List all accessible workspaces with detailed metadata
- **fabric_create_workspace** - Create new workspaces with custom configuration
- **fabric_delete_workspace** - Delete workspaces with confirmation and cleanup
- **fabric_update_workspace** - Update workspace properties and settings
- **fabric_get_workspace** - Get detailed workspace information and status

### **⚡ Capacity & Resource Management**
- **fabric_list_capacities** - List all available Fabric capacities
- **fabric_assign_workspace_to_capacity** - Attach workspaces to dedicated capacity
- **fabric_unassign_workspace_from_capacity** - Move workspaces to shared capacity
- **fabric_list_capacity_workspaces** - List all workspaces in a capacity

### **👥 Access Control & Security**
- **fabric_get_workspace_role_assignments** - View workspace permissions
- **fabric_add_workspace_role_assignment** - Grant workspace access to users/groups
- **fabric_update_workspace_role_assignment** - Modify user permissions
- **fabric_remove_workspace_role_assignment** - Remove workspace access

### **🔄 Advanced Operations**
- **fabric_get_workspace_git_status** - Check Git integration status
- **fabric_connect_workspace_to_git** - Enable Git integration for workspace
- **fabric_disconnect_workspace_from_git** - Disable Git integration
- **fabric_update_workspace_git_connection** - Modify Git repository settings

### **🛠️ Environment & Pipeline Management**
- **fabric_list_workspace_environments** - List all environments in workspace
- **fabric_create_workspace_environment** - Create new environments
- **fabric_delete_workspace_environment** - Remove environments
- **fabric_list_workspace_data_pipelines** - List data integration pipelines
- **fabric_create_workspace_data_pipeline** - Create new data pipelines

### **🎯 Real-World Scenarios Enabled**

**🚀 Automated Workspace Provisioning:**
```
"Create a new workspace called 'Analytics-Q1-2025' and assign it to our premium capacity"
```

**📊 Multi-Workspace Analytics:**
```
"List all workspaces in our tenant and show their capacity assignments"
```

**🔒 Access Management:**
```
"Add user john.doe@company.com as Admin to the Analytics workspace"
```

**🏗️ Environment Setup:**
```
"Create a development environment in the Analytics workspace with Python and R libraries"
```

**🔄 Git Integration:**
```
"Connect the Analytics workspace to our GitHub repository for version control"
```

### **🤖 GitHub Copilot Integration**

**Perfect for GitHub Copilot** - The enhanced workspace management works seamlessly with **GitHub Copilot's built-in terminal**, making it ideal for:

- **🔧 Azure CLI Authentication** - Uses your existing `az login` session
- **💻 Terminal-Based Operations** - Natural workflow within your coding environment  
- **⚡ Rapid Prototyping** - Quickly create test workspaces and environments
- **🏗️ Infrastructure as Code** - Manage Fabric resources alongside your codebase
- **🔄 CI/CD Integration** - Automate workspace provisioning in deployment pipelines

**GitHub Copilot Example Commands:**

```bash
# Using Azure CLI auth, create a new workspace for our ML project
# List all workspaces and their Git integration status
# Set up a complete analytics environment with lakehouse and notebooks
```

### **🎯 End-to-End Testing with Real Workspaces**

The MCP server now includes comprehensive end-to-end testing that creates real workspaces, assigns them to capacities, and executes actual jobs to validate the complete workflow:

```bash
# One-command end-to-end test
npm run test:e2e
```

**What it tests:**
- ✅ **Workspace Creation** - Creates real Fabric workspaces
- ✅ **Capacity Assignment** - Attaches workspaces to your Fabric capacity
- ✅ **Item Creation** - Creates notebooks, lakehouses, and other items
- ✅ **Job Execution** - Runs actual Spark jobs and monitors completion
- ✅ **Resource Cleanup** - Automatically removes all test resources

## 🚀 **Deployment Options**

### **🤖 Claude Desktop Integration**
**Recommended for AI Assistant Usage:**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\build\\index.js"],
      "cwd": "C:\\path\\to\\your\\project",
      "env": {
        "FABRIC_AUTH_METHOD": "bearer_token",
        "FABRIC_TOKEN": "your_bearer_token_here",
        "FABRIC_WORKSPACE_ID": "your_workspace_id",
        "ENABLE_HEALTH_SERVER": "false"
      }
    }
  }
}
```

> 💡 **Get Bearer Token:** Visit [Power BI Embed Setup](https://app.powerbi.com/embedsetup) to generate tokens
> 
> ⚠️ **Important:** Tokens expire after ~1 hour and need to be refreshed

#### **🔧 Claude Desktop Authentication Fix**
If you experience 60-second timeouts during startup, this is due to interactive authentication flows blocking Claude Desktop's sandboxed environment. **Solution:**

1. **Use Bearer Token Method** (Recommended):
   - Set `FABRIC_AUTH_METHOD: "bearer_token"` in your config
   - Provide `FABRIC_TOKEN` with a valid bearer token
   - This bypasses interactive authentication entirely

2. **Alternative - Per-Tool Authentication**:
   - Provide token directly in tool calls: `bearerToken: "your_token_here"`
   - Or use simulation mode: `bearerToken: "simulation"`

3. **Troubleshooting**:
   - Server now has 10-second timeout protection to prevent hanging
   - Falls back to simulation mode if authentication fails
   - Enhanced error messages provide clear guidance

> 🎯 **Quick Fix**: The server automatically prioritizes `FABRIC_TOKEN` environment variable over interactive authentication flows, preventing Claude Desktop timeouts.

### **📱 Local Development**
```bash
# Clone and run locally
git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
cd Fabric-Analytics-MCP
npm install && npm run build && npm start
```

### **🐳 Docker Deployment**
```bash
# Using Docker Compose
docker-compose up -d

# Or standalone Docker
docker build -t fabric-analytics-mcp .
docker run -p 3000:3000 -e FABRIC_CLIENT_ID=xxx fabric-analytics-mcp
```

### **☸️ Azure Kubernetes Service (AKS)**
```bash
# One-command enterprise deployment
export ACR_NAME="your-registry" FABRIC_CLIENT_ID="xxx" FABRIC_CLIENT_SECRET="yyy" FABRIC_TENANT_ID="zzz"
./scripts/setup-azure-resources.sh && ./scripts/build-and-push.sh && ./scripts/deploy-to-aks.sh
```

### **🌐 Azure MCP Server (Preview)**
```bash
# Serverless deployment on Azure
az mcp server create --name "fabric-analytics-mcp" --repository "santhoshravindran7/Fabric-Analytics-MCP"
```

**📚 Detailed Guides**:
- [🐳 Docker & Compose Setup](./docker-compose.yml)
- [☸️ AKS Deployment Guide](./AKS_DEPLOYMENT.md)
- [🌐 Azure MCP Server Guide](./AZURE_MCP_SERVER.md)
- [🔧 Configuration Examples](./.env.example)
- [✅ Deployment Validation](./scripts/validate-deployment.sh)

## 🛠️ **Tools & Capabilities**

### 🔍 **CRUD Operations for Fabric Items**
- **Tool**: `list-fabric-items`
- **Description**: List items in a Microsoft Fabric workspace (Lakehouses, Notebooks, etc.)
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemType`: Filter by item type (optional)

- **Tool**: `create-fabric-item`
- **Description**: Create new items in Microsoft Fabric workspace
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemType`: Type of item (Lakehouse, Notebook, Dataset, Report, Dashboard)
  - `displayName`: Display name for the new item
  - `description`: Optional description

- **Tool**: `get-fabric-item`
- **Description**: Get detailed information about a specific Microsoft Fabric item
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemId`: ID of the item to retrieve

- **Tool**: `update-fabric-item`
- **Description**: Update existing items in Microsoft Fabric workspace
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemId`: ID of the item to update
  - `displayName`: New display name (optional)
  - `description`: New description (optional)

- **Tool**: `delete-fabric-item`
- **Description**: Delete items from Microsoft Fabric workspace
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemId`: ID of the item to delete

### 🔍 Query Fabric Dataset (Enhanced)
- **Tool**: `query-fabric-dataset`
- **Description**: Execute SQL or KQL queries against Microsoft Fabric datasets
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token (optional - uses simulation if not provided)
  - `workspaceId`: Microsoft Fabric workspace ID
  - `datasetName`: Name of the dataset to query
  - `query`: SQL or KQL query to execute

### 🚀 Execute Fabric Notebook
- **Tool**: `execute-fabric-notebook`
- **Description**: Execute a notebook in Microsoft Fabric workspace
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `notebookId`: ID of the notebook to execute
  - `parameters`: Optional parameters to pass to the notebook

### 📊 Get Analytics Metrics
- **Tool**: `get-fabric-metrics`
- **Description**: Retrieve performance and usage metrics for Microsoft Fabric items
- **Parameters**:
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemId`: Item ID (dataset, report, etc.)
  - `timeRange`: Time range for metrics (1h, 24h, 7d, 30d)
  - `metrics`: List of metrics to analyze

### 🔧 Analyze Data Model
- **Tool**: `analyze-fabric-model`
- **Description**: Analyze a Microsoft Fabric data model and get optimization recommendations
- **Parameters**:
  - `workspaceId`: Microsoft Fabric workspace ID
  - `itemId`: Item ID to analyze

### 📋 Generate Analytics Report
- **Tool**: `generate-fabric-report`
- **Description**: Generate comprehensive analytics reports for Microsoft Fabric workspaces
- **Parameters**:
  - `workspaceId`: Microsoft Fabric workspace ID
  - `reportType`: Type of report (performance, usage, health, summary)

### 🚀 Livy API Integration (Sessions & Batch Jobs)

#### Session Management
- **Tool**: `create-livy-session`
- **Description**: Create a new Livy session for interactive Spark/SQL execution
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `sessionConfig`: Optional session configuration

- **Tool**: `get-livy-session`
- **Description**: Get details of a Livy session
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `sessionId`: Livy session ID

- **Tool**: `list-livy-sessions`
- **Description**: List all Livy sessions in a lakehouse
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID

- **Tool**: `delete-livy-session`
- **Description**: Delete a Livy session
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `sessionId`: Livy session ID

#### Statement Execution
- **Tool**: `execute-livy-statement`
- **Description**: Execute SQL or Spark statements in a Livy session
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `sessionId`: Livy session ID
  - `code`: SQL or Spark code to execute
  - `kind`: Statement type (sql, spark, etc.)

- **Tool**: `get-livy-statement`
- **Description**: Get status and results of a Livy statement
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `sessionId`: Livy session ID
  - `statementId`: Statement ID

#### Batch Job Management
- **Tool**: `create-livy-batch`
- **Description**: Create a new Livy batch job for long-running operations
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `batchConfig`: Batch job configuration

- **Tool**: `get-livy-batch`
- **Description**: Get details of a Livy batch job
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `batchId`: Batch job ID

- **Tool**: `list-livy-batches`
- **Description**: List all Livy batch jobs in a lakehouse
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID

- **Tool**: `delete-livy-batch`
- **Description**: Delete a Livy batch job
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Microsoft Fabric lakehouse ID
  - `batchId`: Batch job ID

### 📊 Spark Application Monitoring

#### Workspace-Level Monitoring
- **Tool**: `get-workspace-spark-applications`
- **Description**: Get all Spark applications in a Microsoft Fabric workspace
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `continuationToken`: Optional token for pagination

#### Item-Specific Monitoring
- **Tool**: `get-notebook-spark-applications`
- **Description**: Get all Spark applications for a specific notebook
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `notebookId`: Notebook ID
  - `continuationToken`: Optional token for pagination

- **Tool**: `get-lakehouse-spark-applications`
- **Description**: Get all Spark applications for a specific lakehouse
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `lakehouseId`: Lakehouse ID
  - `continuationToken`: Optional token for pagination

- **Tool**: `get-spark-job-definition-applications`
- **Description**: Get all Spark applications for a specific Spark Job Definition
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `sparkJobDefinitionId`: Spark Job Definition ID
  - `continuationToken`: Optional token for pagination

#### Application Management
- **Tool**: `get-spark-application-details`
- **Description**: Get detailed information about a specific Spark application
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `livyId`: Livy session ID

- **Tool**: `cancel-spark-application`
- **Description**: Cancel a running Spark application
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `livyId`: Livy session ID

#### Monitoring Dashboard
- **Tool**: `get-spark-monitoring-dashboard`
- **Description**: Generate a comprehensive monitoring dashboard with analytics
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID

### 📓 **Notebook Management**

The MCP server provides comprehensive notebook management capabilities with predefined templates and custom notebook support.

#### Create Notebook from Template
- **Tool**: `create-fabric-notebook`
- **Description**: Create new Fabric notebooks from predefined templates or custom definitions
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `displayName`: Display name for the new notebook
  - `template`: Template type (blank, sales_analysis, nyc_taxi_analysis, data_exploration, machine_learning, custom)
  - `customNotebook`: Custom notebook definition (required if template is 'custom')
  - `environmentId`: Optional environment ID to attach
  - `lakehouseId`: Optional default lakehouse ID
  - `lakehouseName`: Optional default lakehouse name

**Available Templates:**
- **blank**: Basic notebook with minimal setup
- **sales_analysis**: Comprehensive sales data analysis with sample dataset
- **nyc_taxi_analysis**: NYC taxi trip data analysis with sample dataset
- **data_exploration**: Structured data exploration template
- **machine_learning**: Complete ML workflow template
- **custom**: Use your own notebook definition

#### Get Notebook Definition
- **Tool**: `get-fabric-notebook-definition`
- **Description**: Retrieve the notebook definition (cells, metadata) from an existing Fabric notebook
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `notebookId`: ID of the notebook to retrieve
  - `format`: Format to return (ipynb or fabricGitSource)

#### Update Notebook Definition
- **Tool**: `update-fabric-notebook-definition`
- **Description**: Update the notebook definition (cells, metadata) of an existing Fabric notebook
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `notebookId`: ID of the notebook to update
  - `notebookDefinition`: Updated notebook definition object

#### Execute Notebook
- **Tool**: `run-fabric-notebook`
- **Description**: Execute a Fabric notebook on-demand with optional parameters and configuration
- **Parameters**:
  - `bearerToken`: Microsoft Fabric bearer token
  - `workspaceId`: Microsoft Fabric workspace ID
  - `notebookId`: ID of the notebook to run
  - `parameters`: Optional notebook parameters (key-value pairs with types)
  - `configuration`: Optional execution configuration (environment, lakehouse, pools, etc.)

**Features:**
- 📓 Base64 encoded notebook payload support
- 🔧 Comprehensive metadata management
- 🌐 Environment and lakehouse integration
- 🎛️ Parameterized notebook execution
- ⚡ Spark configuration support
- 🔤 Support for multiple programming languages (Python, Scala, SQL, R)

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ and npm
- Microsoft Fabric workspace access
- Claude Desktop (for AI integration)

### **Installation & Setup**

1. **Clone and Install**
   ```bash
   git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
   cd Fabric-Analytics-MCP
   npm install
   npm run build    # ✅ All configuration files included!
   ```

   > **📝 Note**: All essential configuration files (`tsconfig.json`, `jest.config.json`, etc.) are now properly included in the repository. Previous build issues have been resolved.

2. **Configure Claude Desktop**
   
   Add to your Claude Desktop config:
   
   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   
   ```json
   {
     "mcpServers": {
       "fabric-analytics": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/PROJECT/build/index.js"]
       }
     }
   }
   ```

3. **Start Using**
   
   Restart Claude Desktop and try these queries:   - *"List all items in my Fabric workspace [your-workspace-id]"*
   - *"Create a new lakehouse called 'Analytics Hub'"*
   - *"Show me all running Spark applications"*
   - *"Execute this SQL query: SELECT * FROM my_table LIMIT 10"*

## 🧪 **Development & Testing**

### **Running the Server**
```bash
npm start        # Production mode
npm run dev      # Development mode with auto-reload
```

### **Testing Livy API Integration**

For comprehensive testing of Spark functionality, install Python dependencies:

```bash
pip install -r livy_requirements.txt
```

**Available Test Scripts:**
- `livy_api_test.ipynb` - Interactive notebook for step-by-step testing
- `comprehensive_livy_test.py` - Full-featured test with error handling  
- `spark_monitoring_test.py` - Spark application monitoring tests
- `mcp_spark_monitoring_demo.py` - MCP server integration demo

### **Claude Desktop Integration**

Add this configuration to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/PROJECT/build/index.js"]
    }
  }
}
```

**🎉 You're ready!** Restart Claude Desktop and start asking questions about your Microsoft Fabric data!

### Livy API Testing Setup

For testing the Livy API functionality, additional Python dependencies are required:

```bash
# Install Python dependencies for Livy API testing
pip install -r livy_requirements.txt
```

#### Available Test Scripts:
- `livy_api_test.ipynb` - Interactive Jupyter notebook for step-by-step testing
- `comprehensive_livy_test.py` - Full-featured test with error handling
- `simple_livy_test.py` - Simple test following example patterns
- `livy_batch_test.py` - Batch job testing capabilities
- `spark_monitoring_test.py` - Spark application monitoring tests

## Usage

### Running the Server
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### Testing with Claude Desktop

Add the following configuration to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/PROJECT/build/index.js"]
    }
  }
}
```

## 💬 **Example Queries**

Once connected to Claude Desktop, you can ask natural language questions like:

### **CRUD Operations:**
- "List all Lakehouses in my workspace"
- "Create a new Notebook called 'Data Analysis'"
- "Update the description of my lakehouse"
- "Delete the test notebook from my workspace"

### **Notebook Management:**
- "Create a sales analysis notebook with sample data"
- "Generate a new NYC taxi analysis notebook"
- "Create a machine learning notebook template"
- "Get the definition of my existing notebook"
- "Run my notebook with specific parameters"
- "Update my notebook with new cells"

### **Data Operations:**
- "Query the sales dataset to get total revenue by region"
- "Execute my analytics notebook with today's date"

### **Analytics:**
- "Get performance metrics for the last 24 hours"
- "Analyze my data model and provide optimization recommendations"
- "Generate a usage report for my workspace"

### **Livy API Operations:**
- "Create a Livy session for interactive Spark analysis"
- "Execute SQL query 'SELECT * FROM my_table LIMIT 10'"
- "Run Spark code to show all tables"
- "Monitor my batch job progress"

### **Spark Application Monitoring:**
- "Show me all Spark applications in my workspace"
- "What's the status of my notebook Spark jobs?"
- "Generate a comprehensive Spark monitoring dashboard"
- "Show me recent failed applications"
- "Cancel the problematic Spark application"

### **🔐 Authentication**

This MCP server supports **multiple authentication methods** powered by Microsoft Authentication Library (MSAL):

> **🤖 For Claude Desktop:** Use Bearer Token Authentication (Method #1) for the best experience and compatibility.
>
> **🔧 Claude Desktop Fix:** Recent updates prevent authentication timeouts by prioritizing bearer tokens and adding timeout protection for interactive authentication flows.

#### **🎫 1. Bearer Token Authentication** (Recommended for Claude Desktop)
Perfect for AI assistants and interactive usage:

**For Claude Desktop:**
- Visit [Power BI Embed Setup](https://app.powerbi.com/embedsetup)
- Generate a bearer token for your workspace
- Add to your `claude_desktop_config.json`
- **No timeout issues** - bypasses interactive authentication entirely

**For Testing:**
```bash
# All test scripts will prompt for authentication method
python enhanced_auth_test.py
```

#### **🤖 2. Service Principal Authentication** (Recommended for Production)
Use Azure AD application credentials:
- **Client ID** (Application ID)
- **Client Secret** 
- **Tenant ID** (Directory ID)

**Environment Variables Setup**:
```bash
export FABRIC_AUTH_METHOD="service_principal"
export FABRIC_CLIENT_ID="your-app-client-id"
export FABRIC_CLIENT_SECRET="your-app-client-secret"
export FABRIC_TENANT_ID="your-tenant-id"
export FABRIC_DEFAULT_WORKSPACE_ID="your-workspace-id"
```

**Claude Desktop Configuration**:
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/path/to/build/index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "your-client-id",
        "FABRIC_CLIENT_SECRET": "your-client-secret",
        "FABRIC_TENANT_ID": "your-tenant-id"
      }
    }
  }
}
```

#### **📱 3. Device Code Authentication**
Sign in with browser on another device (great for headless environments):
```bash
export FABRIC_AUTH_METHOD="device_code"
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_TENANT_ID="your-tenant-id"
```

#### **🌐 4. Interactive Authentication**
Automatic browser-based authentication:
```bash
export FABRIC_AUTH_METHOD="interactive"
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_TENANT_ID="your-tenant-id"
```

#### **🔧 5. Azure CLI Authentication** ⭐ **(Recommended for Local Development)**
Use your existing Azure CLI login for seamless local testing:
```bash
export FABRIC_AUTH_METHOD="azure_cli"
```

**Prerequisites**:
1. Install Azure CLI: `winget install Microsoft.AzureCLI` (Windows) or [Download](https://aka.ms/installazurecliwindows)
2. Login to Azure: `az login`
3. Set active subscription: `az account set --subscription "your-subscription-name"`

**Benefits**:
- ✅ **Zero Configuration** - Uses your existing Azure login
- ✅ **Instant Setup** - No app registration or client secrets needed
- ✅ **Multi-Account Support** - Switch Azure accounts easily
- ✅ **Perfect for Development** - Seamless local testing experience

**Quick Test**:
```powershell
# Verify Azure CLI setup
npm run test:azure-cli

# Start MCP server with Azure CLI auth
$env:FABRIC_AUTH_METHOD="azure_cli"; npm start
```

> 💡 **Pro Tip**: Azure CLI authentication is perfect for developers who want to quickly test the MCP server without complex Azure AD app setup. Just `az login` and you're ready to go!

#### **🔧 Complete Authentication Setup**

📚 **Detailed Guides**:
- **[Authentication Setup Guide](AUTHENTICATION_SETUP.md)** - Complete Azure AD setup
- **[Claude Desktop Config Examples](CLAUDE_DESKTOP_CONFIG_EXAMPLES.md)** - Ready-to-use configurations

#### **🔍 Authentication Testing**

Check your authentication status:
```
"Check my Fabric authentication status"
"What authentication method am I using?"
"Test my Microsoft Fabric authentication setup"
```

#### **🔒 Security Best Practices**

- **Never commit authentication tokens** to version control
- Use **Service Principal** authentication for production deployments
- **Device Code** flow is perfect for CI/CD and headless environments
- **Interactive** authentication is ideal for development and testing
- All tokens are automatically validated and include expiration checking

**Note**: The MCP server seamlessly handles token validation and provides clear error messages for authentication issues.

## ☸️ **Azure Kubernetes Service (AKS) Deployment**

Deploy the MCP server as a scalable service on Azure Kubernetes Service for enterprise production use.

### **🚀 Quick AKS Deployment**

#### **Prerequisites**
- Azure CLI installed and configured
- Docker installed
- kubectl installed
- Azure subscription with AKS permissions

#### **1. Build and Push Docker Image**
```bash
# Build the Docker image
npm run docker:build

# Tag and push to Azure Container Registry
npm run docker:push
```

#### **2. Deploy to AKS**
```bash
# Create Azure resources and deploy
./scripts/deploy-to-aks.sh
```

#### **3. Access the MCP Server**
Once deployed, your MCP server will be available at:
```
https://your-aks-cluster.region.cloudapp.azure.com/mcp
```

### **🏗️ Architecture Overview**

The AKS deployment includes:
- **Horizontal Pod Autoscaler** (3-10 pods based on CPU/memory)
- **Azure Load Balancer** for high availability
- **SSL/TLS termination** with Azure Application Gateway
- **ConfigMaps** for environment configuration
- **Secrets** for secure credential storage
- **Health checks** and readiness probes
- **Resource limits** and quality of service guarantees

### **📁 Deployment Files**

All Kubernetes manifests are located in the `/k8s` directory:
- `namespace.yaml` - Dedicated namespace
- `deployment.yaml` - Application deployment with scaling
- `service.yaml` - Load balancer service
- `ingress.yaml` - External access and SSL
- `configmap.yaml` - Configuration management
- `secret.yaml` - Secure credential storage
- `hpa.yaml` - Horizontal Pod Autoscaler

### **🔧 Configuration**

Configure the deployment by setting these environment variables:
```bash
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export AZURE_RESOURCE_GROUP="fabric-mcp-rg"
export AKS_CLUSTER_NAME="fabric-mcp-cluster"
export ACR_NAME="fabricmcpregistry"
export DOMAIN_NAME="your-domain.com"
```

### **🔐 Production Security**

The AKS deployment includes enterprise-grade security:
- **Non-root container** execution
- **Read-only root filesystem**
- **Secret management** via Azure Key Vault integration
- **Network policies** for traffic isolation
- **RBAC** with minimal required permissions
- **Pod security standards** enforcement

### **📊 Monitoring & Scaling**

- **Azure Monitor** integration for logs and metrics
- **Application Insights** for performance monitoring
- **Prometheus** metrics endpoint for custom monitoring
- **Auto-scaling** based on CPU (70%) and memory (80%) thresholds
- **Health checks** for automatic pod restart

### **🔄 CI/CD Integration**

The deployment scripts support:
- **Azure DevOps** pipelines
- **GitHub Actions** workflows
- **Automated testing** before deployment
- **Blue-green deployments** for zero downtime
- **Rollback capabilities** for quick recovery

**📚 Detailed Guide**: See [AKS_DEPLOYMENT.md](AKS_DEPLOYMENT.md) for complete setup instructions.

## 🌐 **Azure Model Context Protocol Server (Preview)**

Microsoft Azure now offers a preview service for hosting MCP servers natively. This eliminates the need for custom infrastructure management.

### **🚀 Azure MCP Server Deployment**

#### **Prerequisites**
- Azure subscription with MCP preview access
- Azure CLI with MCP extensions

#### **Deploy to Azure MCP Service**
```bash
# Login to Azure
az login

# Enable MCP preview features
az extension add --name mcp-preview

# Deploy the MCP server
az mcp server create \
  --name "fabric-analytics-mcp" \
  --resource-group "your-rg" \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP" \
  --branch "main" \
  --auth-method "service-principal"
```

#### **Configure Authentication**
```bash
# Set up service principal authentication
az mcp server config set \
  --name "fabric-analytics-mcp" \
  --setting "FABRIC_CLIENT_ID=your-client-id" \
  --setting "FABRIC_CLIENT_SECRET=your-secret" \
  --setting "FABRIC_TENANT_ID=your-tenant-id"
```

#### **Access Your MCP Server**
```bash
# Get the server endpoint
az mcp server show --name "fabric-analytics-mcp" --query "endpoint"
```

### **🔧 Azure MCP Server Features**

- **Automatic scaling** based on usage
- **Built-in monitoring** and logging
- **Integrated security** with Azure AD
- **Zero infrastructure management**
- **Global CDN** for low latency
- **Automatic SSL/TLS** certificates

### **💰 Cost Optimization**

Azure MCP Server offers:
- **Pay-per-request** pricing model
- **Automatic hibernation** during idle periods
- **Resource sharing** across multiple clients
- **No minimum infrastructure costs**

**📚 Learn More**: [Azure MCP Server Documentation](https://docs.microsoft.com/azure/mcp-server/)

**Note**: Azure MCP Server is currently in preview. Check [Azure Preview Terms](https://azure.microsoft.com/support/legal/preview-supplemental-terms/) for service availability and limitations.

## 🏗️ **Architecture**

This MCP server is built with:
- **TypeScript** for type-safe development
- **MCP SDK** for Model Context Protocol implementation
- **Zod** for schema validation and input sanitization
- **Node.js** runtime environment

## ⚙️ **Configuration**

The server uses the following configuration files:
- `tsconfig.json` - TypeScript compiler configuration
- `package.json` - Node.js package configuration
- `.vscode/mcp.json` - MCP server configuration for VS Code

## 🔧 **Development**

### **Project Structure**
```
├── src/
│   ├── index.ts              # Main MCP server implementation
│   └── fabric-client.ts      # Microsoft Fabric API client
├── build/                    # Compiled JavaScript output
├── tests/                    # Test scripts and notebooks
├── .vscode/                  # VS Code configuration
├── package.json
├── tsconfig.json
└── README.md
```

### **Adding New Tools**

To add new tools to the server:

1. Define the input schema using Zod
2. Implement the tool using `server.tool()`
3. Add error handling and validation
4. Update documentation

### **API Integration**

This server includes:

**✅ Production Ready:**
- Full Microsoft Fabric Livy API integration
- Spark session lifecycle management
- Statement execution with SQL and Spark support
- Batch job management for long-running operations
- Comprehensive error handling and retry logic
- Real-time polling and result retrieval

**🧪 Demonstration Features:**
- CRUD operations (configurable for real APIs)
- Analytics and metrics (extensible framework)
- Data model analysis (template implementation)

## 🧪 **Testing**

### **🚀 End-to-End Testing**

The MCP server includes comprehensive end-to-end testing that creates real workspaces, items, and jobs to validate complete functionality using Azure CLI authentication.

#### **Quick Setup for E2E Testing**
```bash
# 1. Set up end-to-end testing environment
npm run setup:e2e

# 2. Run the comprehensive end-to-end test
npm run test:e2e
```

#### **What the E2E Test Does**
The end-to-end test creates a complete workflow in your Microsoft Fabric tenant:

1. **🔐 Validates Azure CLI Authentication** - Uses your existing `az login` session
2. **🏗️ Creates a Test Workspace** - New workspace with unique naming
3. **⚡ Attaches to Capacity** - Links workspace to your Fabric capacity (optional)
4. **📓 Creates Notebooks & Lakehouses** - Test items for validation
5. **🏃 Runs Real Jobs** - Executes notebook with actual Spark code
6. **📊 Monitors Execution** - Tracks job status and completion
7. **🧹 Cleans Up Resources** - Removes all created test resources

#### **E2E Test Configuration**

The setup script creates a `.env.e2e` configuration file:

```bash
# Example configuration
FABRIC_CAPACITY_ID=your-capacity-id-here    # Optional: for capacity testing
E2E_TEST_TIMEOUT=300000                      # 5 minutes per operation
E2E_CLEANUP_ON_FAILURE=true                 # Clean up on test failure
E2E_RETRY_COUNT=3                           # Retry failed operations
```

#### **E2E Test Features**

- ✅ **Real Resource Creation** - Creates actual Fabric workspaces and items
- ✅ **Azure CLI Integration** - Uses your existing Azure authentication
- ✅ **Capacity Assignment** - Tests workspace-to-capacity attachment
- ✅ **Job Execution** - Runs real Spark jobs and monitors completion
- ✅ **Automatic Cleanup** - Removes all test resources automatically
- ✅ **Comprehensive Logging** - Detailed logging of all operations
- ✅ **Error Handling** - Robust error handling and recovery

#### **Prerequisites for E2E Testing**

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   ```

2. **Microsoft Fabric Access** with permissions to:
   - Create workspaces
   - Create notebooks and lakehouses
   - Run Spark jobs
   - (Optional) Assign workspaces to capacity

3. **Fabric Capacity** (optional but recommended):
   - Set `FABRIC_CAPACITY_ID` in `.env.e2e` for capacity testing
   - Without capacity, workspace will use shared capacity

#### **Running E2E Tests**

```bash
# Complete setup and run
npm run setup:e2e && npm run test:e2e

# Or run individual steps
npm run setup:e2e          # Set up environment
npm run test:e2e           # Run end-to-end test

# Direct execution
node setup-e2e.cjs         # Setup script
node test-end-to-end.cjs   # Test script
```

#### **E2E Test Output**

The test provides comprehensive output including:

```
🚀 Starting End-to-End Test for Microsoft Fabric Analytics MCP Server
✅ MCP Server Startup (1234ms)
✅ Azure CLI Authentication
✅ Workspace Creation
✅ Capacity Attachment
✅ Notebook Creation
✅ Lakehouse Creation
✅ Item Validation
✅ Job Execution

📊 TEST SUMMARY
================
✅ MCP Server Startup (2341ms)
✅ Azure CLI Authentication
✅ Workspace Creation
✅ Capacity Attachment
✅ Notebook Creation
✅ Lakehouse Creation
✅ Item Validation  
✅ Job Execution

Total: 8 | Passed: 8 | Failed: 0
```

#### **⚠️ Important Notes for E2E Testing**

- **Creates Real Resources**: The test creates actual workspaces and items in your Fabric tenant
- **Requires Permissions**: Ensure you have necessary Fabric permissions
- **Uses Capacity**: Jobs may consume capacity units if using dedicated capacity
- **Automatic Cleanup**: All resources are automatically deleted after testing
- **Network Dependent**: Requires stable internet connection for API calls

### **🧪 Unit & Integration Testing**

### **Prerequisites**
```bash
# Install Python dependencies for API testing
pip install -r livy_requirements.txt
```

### **Available Test Scripts**
- `livy_api_test.ipynb` - Interactive Jupyter notebook for step-by-step testing
- `comprehensive_livy_test.py` - Full-featured test with error handling
- `simple_livy_test.py` - Simple test following example patterns
- `livy_batch_test.py` - Batch job testing capabilities
- `spark_monitoring_test.py` - Spark application monitoring tests

### **Quick Testing**

1. **Interactive Testing**:
   ```bash
   jupyter notebook livy_api_test.ipynb
   ```

2. **Command Line Testing**:
   ```bash
   python simple_livy_test.py
   python spark_monitoring_test.py
   ```

3. **Comprehensive Testing**:
   ```bash   python comprehensive_livy_test.py --auth bearer
   ```

## 🤝 **Contributing**

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** and add tests if applicable
4. **Commit your changes** (`git commit -m 'Add amazing feature'`)
5. **Push to the branch** (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

### **Development Guidelines**
- Follow TypeScript best practices
- Add JSDoc comments for new functions
- Update tests for any new functionality
- Update documentation as needed
- See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines

## 🔒 **Security**

- **Never commit authentication tokens** to version control
- Use environment variables for sensitive configuration
- Follow Microsoft Fabric security best practices
- Report security issues privately via [GitHub security advisories](https://github.com/santhoshravindran7/Fabric-Analytics-MCP/security/advisories)
- See [SECURITY.md](SECURITY.md) for our full security policy

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  **Support**

For issues and questions:
- 📖 Check the [MCP documentation](https://modelcontextprotocol.io/)
- 📚 Review [Microsoft Fabric API documentation](https://docs.microsoft.com/en-us/fabric/)
- 🐛 [Open an issue](https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues) in this repository
- 💬 Join the community discussions

##  **Acknowledgments**

- **Microsoft Fabric Analytics team** for the comprehensive data platform and analytics capabilities
- **Microsoft Fabric Platform teams** for the robust API platform and infrastructure
- **Bogdan Crivat** and **Chris Finlan** for the inspiring brainstorming conversation that gave me the idea to open-source this project
- **Anthropic** for the Model Context Protocol specification

*This project began as my weekend hack project exploring AI integration with Microsoft Fabric. During a casual conversation with Chris and Bogdan about making AI tooling more accessible. What started as a personal experiment over a weekend is now available for everyone to build upon.*
