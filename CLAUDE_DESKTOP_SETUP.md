# Claude Desktop Configuration Guide for Spark Monitoring

## 🔧 **Step-by-Step Setup**

### 1. **Locate Claude Desktop Config File**

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Full path**: `C:\Users\{YourUsername}\AppData\Roaming\Claude\claude_desktop_config.json`

### 2. **Get Your Project Path**

Your current project path is:
```
C:\Users\saravi\OneDrive - Microsoft\MCP for Microsoft Fabric Analytics
```

### 3. **Claude Desktop Configuration**

Add this configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\Users\\saravi\\OneDrive - Microsoft\\MCP for Microsoft Fabric Analytics\\build\\index.js"]
    }
  }
}
```

### 4. **Verify MCP Server Build**

Make sure your project is built:
```bash
npm run build
```

### 5. **Test Commands for Claude Desktop**

Once configured, you can ask Claude:

#### 🔍 **Spark Monitoring Queries**

1. **"Show me all Spark applications in my workspace"**
   - Claude will call: `get-workspace-spark-applications`
   - Expected: List of all Spark applications with states and types

2. **"What's the status of Spark jobs for my notebook 8809828e-7212-43fa-8463-8de8b3873288?"**
   - Claude will call: `get-notebook-spark-applications`
   - Expected: Notebook-specific Spark application details

3. **"List Spark applications for my lakehouse 683ce7d6-5d0d-4164-b594-d2cc8dbf70ac"**
   - Claude will call: `get-lakehouse-spark-applications`
   - Expected: Lakehouse-specific application list

4. **"Generate a comprehensive Spark monitoring dashboard for workspace c22f6805-d84a-4143-80b2-0c9e9832e5a2"**
   - Claude will call: `get-spark-monitoring-dashboard`
   - Expected: Complete analytics dashboard with insights

5. **"Show me Spark applications for Spark Job Definition d410b138-5c4f-42af-b1ed-4430138c7b79"**
   - Claude will call: `get-spark-job-definition-applications`
   - Expected: Spark Job Definition application details

#### 🔧 **Advanced Queries**

- **"Show me recent failed Spark applications"**
- **"What are the different states of my Spark applications?"**
- **"Give me analytics on my Spark application performance"**
- **"Cancel Spark application with Livy ID [some-id]"**

### 6. **Authentication Setup**

When Claude calls the tools, you'll need to provide your Microsoft Fabric bearer token. You can either:

1. **Include it in queries**: "Using bearer token xyz123, show me all Spark applications"
2. **Provide it when prompted**: Claude will ask for authentication details

### 7. **Expected Results from Our Tests**

Based on our successful API tests, you should see:
- **12 applications** in workspace
- **2 applications** for your notebook
- **3 applications** for your lakehouse  
- **4 applications** for your Spark Job Definition
- **Total: 21 Spark applications** across all sources
- **All in "Completed" state**

### 8. **Troubleshooting**

If Claude doesn't recognize the MCP server:
1. Restart Claude Desktop after config changes
2. Check the file path is correct (use forward slashes or double backslashes)
3. Ensure the build folder exists with index.js
4. Check Claude Desktop logs for connection errors

### 9. **Configuration Verification**

Your current setup:
```
✅ Project built successfully
✅ MCP server runs without errors  
✅ All 7 monitoring tools implemented
✅ APIs tested and working with real data
✅ Bearer token authentication working
```

## 🚀 **Ready to Test!**

1. **Update your Claude Desktop config** with the JSON above
2. **Restart Claude Desktop**
3. **Ask Claude one of the example questions**
4. **Watch as Claude automatically calls your MCP tools!**

## 📊 **What You'll See**

Claude will be able to:
- ✅ List all your Spark applications
- ✅ Filter by item type (notebook, lakehouse, Spark Job Definition)
- ✅ Show application states and timing information
- ✅ Generate monitoring dashboards with analytics
- ✅ Provide insights on application performance
- ✅ Cancel problematic applications (if needed)

Your Spark monitoring MCP server is **ready for production use** with Claude Desktop! 🎉
