# Example Usage and Local API Testing

This file contains example usage scenarios for the Microsoft Fabric Analytics MCP Server, including how to test API methods locally with your real workspace data.

## 🔍 Quick Workspace Details Getter

**Get workspace details in 30 seconds:**
```bash
# Debug version with detailed logging
python get_workspace_details_debug.py
```

This focused script will:
- ✅ Connect to your workspace
- ✅ List all items with full details  
- ✅ Show summary by item type
- ✅ Display IDs for further operations
- ✅ Export details to JSON (optional)

**Sample Output:**
```
🏢 MICROSOFT FABRIC WORKSPACE OVERVIEW
============================================================
📍 Workspace ID: c22f6805-d84a-4143-80b2-0c9e9832e5a2

📊 Fetching workspace items...
✅ Found 15 items in workspace

📋 WORKSPACE CONTENTS SUMMARY:
----------------------------------------
  Lakehouse      :   3 items
  Notebook       :   8 items  
  Dataset        :   2 items
  Report         :   2 items
----------------------------------------
  TOTAL          :  15 items

📝 DETAILED ITEM LIST:
================================================================================

🔹 Lakehouse (3 items):
--------------------------------------------------
   1. Sales Analytics Lakehouse
      ID: 683ce7d6-5d0d-4164-b594-d2cc8dbf70ac
      Created: 2024-12-15T10:30:00Z
      Modified: 2024-12-18T15:45:00Z

   2. Customer Data Lakehouse  
      ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
      Created: 2024-12-10T14:20:00Z
```

## 🚀 Testing MCP Server API Methods Locally

### Comprehensive API Testing Script
```bash
# Run the direct API testing script
python test_mcp_api.py
```

This script will:
- ✅ Start your MCP server with real credentials
- ✅ List all tools available
- ✅ Get real workspace items and details
- ✅ Test lakehouse operations with actual data
- ✅ Create/update/delete items in your workspace
- ✅ Submit and monitor real Spark jobs

### Manual MCP Tool Testing

You can also test individual MCP tools manually:

#### 1. List Workspace Items
```bash
# Start your MCP server first
$env:FABRIC_BEARER_TOKEN = "YOUR_TOKEN"
$env:FABRIC_WORKSPACE_ID = "YOUR_WORKSPACE_ID"
$env:SIMULATION_MODE = "false"
node build/index.js

# Then send JSON-RPC requests (in another terminal)
```

#### 2. JSON-RPC Request Examples

**Initialize Server:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "test-client", "version": "1.0.0"}
  }
}
```

**List Available Tools:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Get Real Workspace Items:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list-fabric-items",
    "arguments": {
      "bearerToken": "YOUR_BEARER_TOKEN",
      "workspaceId": "c22f6805-d84a-4143-80b2-0c9e9832e5a2"
    }
  }
}
```

**Response Example (Your Real Data):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"data\":{\"value\":[{\"id\":\"683ce7d6-5d0d-4164-b594-d2cc8dbf70ac\",\"displayName\":\"Sales Analytics Lakehouse\",\"type\":\"Lakehouse\",\"createdDate\":\"2024-12-15T10:30:00Z\",\"modifiedDate\":\"2024-12-18T15:45:00Z\"},{\"id\":\"notebook-id-123\",\"displayName\":\"Data Analysis Notebook\",\"type\":\"Notebook\",\"createdDate\":\"2024-12-16T09:15:00Z\"}]}}"
      }
    ]
  }
}
```

**Get Specific Item Details:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call", 
  "params": {
    "name": "get-fabric-item",
    "arguments": {
      "bearerToken": "YOUR_BEARER_TOKEN",
      "workspaceId": "c22f6805-d84a-4143-80b2-0c9e9832e5a2",
      "itemId": "683ce7d6-5d0d-4164-b594-d2cc8dbf70ac"
    }
  }
}
```

**Create a Test Lakehouse:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "create-fabric-item",
    "arguments": {
      "bearerToken": "YOUR_BEARER_TOKEN",
      "workspaceId": "c22f6805-d84a-4143-80b2-0c9e9832e5a2",
      "itemType": "Lakehouse",
      "displayName": "API_Test_Lakehouse",
      "description": "Test lakehouse created via MCP API"
    }
  }
}
```

**Submit Real Spark Job:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "submit-spark-job",
    "arguments": {
      "bearerToken": "YOUR_BEARER_TOKEN",
      "workspaceId": "c22f6805-d84a-4143-80b2-0c9e9832e5a2",
      "lakehouseId": "YOUR_LAKEHOUSE_ID",
      "code": "print('Hello from Spark!'); spark.sql('SELECT 1 as test_column').show()",
      "language": "python",
      "clusterConfig": {
        "driverCores": 2,
        "driverMemory": "4g",
        "executorCores": 1,
        "executorMemory": "2g",
        "numExecutors": 2
      }
    }
  }
}
```

**Monitor Job Status:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "get-job-status",
    "arguments": {
      "bearerToken": "YOUR_BEARER_TOKEN", 
      "workspaceId": "c22f6805-d84a-4143-80b2-0c9e9832e5a2",
      "jobId": "YOUR_JOB_ID_FROM_SPARK_RESPONSE"
    }
  }
}
```

## 📊 Real Workspace Data Examples

Based on your workspace `c22f6805-d84a-4143-80b2-0c9e9832e5a2` and lakehouse `683ce7d6-5d0d-4164-b594-d2cc8dbf70ac`:

### Get Your Actual Workspace Details
```bash
# This will show your real workspace items
python test_mcp_api.py
```

### Example Response for List Items
```json
{
  "status": "success",
  "data": {
    "value": [
      {
        "id": "683ce7d6-5d0d-4164-b594-d2cc8dbf70ac",
        "displayName": "Your Lakehouse Name",
        "type": "Lakehouse",
        "createdDate": "2024-12-18T10:30:00Z",
        "modifiedDate": "2024-12-18T15:45:00Z"
      },
      {
        "id": "another-item-id",
        "displayName": "Your Notebook Name", 
        "type": "Notebook",
        "createdDate": "2024-12-18T11:00:00Z"
      }
    ]
  }
}
```

### Real Spark Job Example
```python
# This code will run on your actual Fabric lakehouse
spark_code = """
# Real data analysis on your lakehouse
from pyspark.sql import SparkSession

# Read data from your lakehouse
try:
    # Try to read from Files folder
    df_files = spark.sql("SHOW TABLES")
    print("📊 Available tables in your lakehouse:")
    df_files.show()
    
    # Example: Create and query sample data
    data = [('Product A', 100), ('Product B', 200), ('Product C', 150)]
    df = spark.createDataFrame(data, ['product', 'sales'])
    
    print("📈 Sample analysis:")
    df.groupBy().sum('sales').show()
    
except Exception as e:
    print(f"Note: {e}")
    print("This is normal for a new lakehouse")

print("✅ Job completed successfully!")
"""
```

## 🧪 Advanced Testing Scenarios

### Test Multiple Operations in Sequence
```bash
# 1. Start server
python test_mcp_api.py

# The script will automatically:
# - List all your workspace items
# - Show item types and counts
# - Create a test notebook
# - Update the notebook description  
# - Submit a Spark job to your lakehouse
# - Monitor the job status
# - Optionally clean up test items
```

### Real Data Analysis Example
```python
# Example Spark job for real data analysis
real_analysis_code = """
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, sum, avg, max, min
from datetime import datetime

print(f"🚀 Starting real data analysis at {datetime.now()}")

# Check what's available in the lakehouse
print("📊 Checking lakehouse contents...")
spark.sql("SHOW DATABASES").show()

# Create sample business data for analysis
business_data = [
    ('2024-01-01', 'North', 'Electronics', 1000),
    ('2024-01-01', 'South', 'Clothing', 800),
    ('2024-01-02', 'East', 'Electronics', 1200),
    ('2024-01-02', 'West', 'Home', 600),
    ('2024-01-03', 'North', 'Clothing', 900),
]

columns = ['date', 'region', 'category', 'revenue']
df = spark.createDataFrame(business_data, columns)

print("📈 Business Analysis Results:")
print("Revenue by Region:")
df.groupBy('region').agg(sum('revenue').alias('total_revenue')).orderBy('total_revenue', ascending=False).show()

print("Revenue by Category:")
df.groupBy('category').agg(sum('revenue').alias('total_revenue')).orderBy('total_revenue', ascending=False).show()

print("Daily Revenue Trend:")
df.groupBy('date').agg(sum('revenue').alias('daily_revenue')).orderBy('date').show()

print("✅ Analysis completed successfully!")
"""
```

## 🔧 Testing with MCP Inspector

You can also test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

This will open a web interface where you can test the tools interactively with your real workspace.

## 📋 Expected Responses

### Successful Tool Call Response
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"data\":{\"value\":[{\"id\":\"...\",\"displayName\":\"...\",\"type\":\"Lakehouse\"}]}}"
      }
    ]
  }
}
```

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "Authentication failed"
  }
}
```

## 🎯 Quick Start for API Testing

1. **Build the server:**
   ```bash
   npm run build
   ```

2. **Run the API test script:**
   ```bash
   python test_mcp_api.py
   ```

3. **Enter your credentials when prompted**

4. **Watch as it tests all MCP methods with your real workspace data!**

The script will show you:
- ✅ All items in your workspace  
- ✅ Real Spark job execution
- ✅ Item creation/modification
- ✅ Job status monitoring
- ✅ Actual API responses from Microsoft Fabric

## ⚡ Quick Command-Line Tools

### 1. Get Complete Workspace Overview
```bash
# Comprehensive workspace details with export option
python get_workspace_details.py
```

### 2. Quick Individual Commands
```bash
# List all items
python quick_workspace_commands.py list-items

# Get details for specific item
python quick_workspace_commands.py get-item 683ce7d6-5d0d-4164-b594-d2cc8dbf70ac

# List all available MCP tools
python quick_workspace_commands.py list-tools
```

### 3. Interactive Mode
```bash
# Run without parameters for interactive prompts
python quick_workspace_commands.py
```

**Sample Quick Command Output:**
```
⚡ Quick Workspace Commands
========================================
🔑 Enter Bearer Token: [REDACTED]
🏢 Enter Workspace ID: your-workspace-id-here

🎯 Workspace: your-workspace-id-here
📊 Listing workspace items...
✅ Found 3 items:

================================================================================
 1. Sales Analytics Lakehouse
    Type: Lakehouse
    ID:   your-lakehouse-id-here
    Created: 2024-12-15T10:30:00Z

 2. Customer Analysis Notebook
    Type: Notebook
    ID:   notebook-123-abc
    Created: 2024-12-16T14:20:00Z

 3. Revenue Report
    Type: Report
    ID:   report-456-def
    Created: 2024-12-17T11:45:00Z

💡 Tip: Use 'python quick_workspace_commands.py get-item <ID>' to get details for a specific item
```
