## 🔧 **Configuration Instructions**

To complete the setup, you need to:

1. **Get your Fabric Workspace ID:**
   - Go to your Microsoft Fabric workspace
   - Copy the workspace ID from the URL or workspace settings

2. **Update the configuration:**
   - Edit: `%APPDATA%\Claude\claude_desktop_config.json`
   - Replace the empty `FABRIC_DEFAULT_WORKSPACE_ID` with your actual workspace ID

3. **Example configuration:**
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\Users\\saravi\\Fabric-Analytics-MCP\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "azure_cli",
        "FABRIC_DEFAULT_WORKSPACE_ID": "your-workspace-id-here"
      }
    }
  }
}
```

## ✅ **Ready to Test!**
Your MCP server is now configured with:
- ✅ Azure CLI authentication
- ✅ 17 comprehensive tools
- ✅ Notebook management capabilities
- ✅ Spark monitoring features
- ✅ Full API integration

**Next:** Restart Claude Desktop and start asking questions about your Microsoft Fabric workspace!
