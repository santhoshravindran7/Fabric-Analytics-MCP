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

- **🔄 Complete CRUD Operations** - Create, read, update, and delete Fabric items
- **⚡ Livy API Integration** - Full Spark session and batch job management
- **📊 Spark Application Monitoring** - Real-time monitoring across workspaces and items
- **🤖 Claude Desktop Ready** - Plug-and-play integration with Claude Desktop
- **🔐 Enterprise Authentication** - Multiple auth methods (Bearer, Service Principal, Device Code, Interactive)
- **🛡️ MSAL Integration** - Microsoft Authentication Library for secure enterprise access
- **📈 Analytics & Insights** - Generate comprehensive monitoring dashboards
- **🧪 Comprehensive Testing** - Extensive test suite with real API validation
- **🔄 Token Management** - Automatic token validation and expiration handling

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
   npm run build
   ```

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
- `livy_setup.py` - Quick setup and configuration helper

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

#### **🎫 1. Bearer Token Authentication**
Provide your own Microsoft Fabric bearer token:
```bash
# All test scripts will prompt for authentication method
python enhanced_auth_test.py
```

#### **🤖 2. Service Principal Authentication** (Recommended for Production)
Use Azure AD application credentials:
- **Client ID** (Application ID)
- **Client Secret** 
- **Tenant ID** (Directory ID)

```bash
# Service principal setup in Azure Portal:
# 1. Register new application
# 2. Generate client secret
# 3. Grant Fabric permissions
python comprehensive_auth_validation.py
```

#### **📱 3. Device Code Authentication**
Sign in with browser on another device (great for headless environments):
```bash
# Device code flow - displays code for browser login
python spark_monitoring_test.py
```

#### **🌐 4. Interactive Authentication**
Automatic browser-based authentication:
```bash
# Opens browser automatically for sign-in
python mcp_spark_monitoring_demo.py
```

#### **🔧 Authentication Setup**

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Choose your authentication method:**
All test scripts now include interactive authentication prompts that support all four methods.

3. **Validate your setup:**
```bash
# Comprehensive validation of all authentication methods
python comprehensive_auth_validation.py
```

#### **🔒 Security Best Practices**

- **Never commit authentication tokens** to version control
- Use **Service Principal** authentication for production deployments
- **Device Code** flow is perfect for CI/CD and headless environments
- **Interactive** authentication is ideal for development and testing
- All tokens are automatically validated and include expiration checking

**Note**: The MCP server seamlessly handles token validation and provides clear error messages for authentication issues.

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
