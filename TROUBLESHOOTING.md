# MCP Tools Troubleshooting Guide

## ✅ Current Status
- MCP Server: Built and Ready
- Configuration: Valid
- Credentials: Configured
- Tools Available: 15 total (11 existing + 4 new notebook management tools)

## 🎯 New Notebook Management Tools
1. **create-fabric-notebook** - Create notebooks from templates
2. **get-fabric-notebook-definition** - Get notebook definitions 
3. **update-fabric-notebook-definition** - Update notebook cells/metadata
4. **run-fabric-notebook** - Execute notebooks with parameters

## 🔧 Steps to See Tools in Claude Desktop

### Step 1: Start Claude Desktop
- Launch Claude Desktop from your desktop or start menu
- Wait for full initialization (30-60 seconds)

### Step 2: Check MCP Settings
1. Open Claude Desktop
2. Click the Settings gear icon (⚙️)
3. Go to **Features** tab
4. Look for **Model Context Protocol** section
5. You should see: `fabric-analytics` server listed
6. Expand it to see all 15 tools

### Step 3: Verify Tools Are Listed
You should see these tools in the MCP section:
- list-fabric-items
- create-fabric-item  
- update-fabric-item
- delete-fabric-item
- get-fabric-item
- execute-fabric-notebook
- submit-spark-job
- get-job-status
- create-spark-job-instance
- execute-spark-job-definition
- simulate-fabric-data
- **create-fabric-notebook** ⭐ NEW
- **get-fabric-notebook-definition** ⭐ NEW  
- **update-fabric-notebook-definition** ⭐ NEW
- **run-fabric-notebook** ⭐ NEW

### Step 4: Test a Tool
Try asking Claude: "Can you list the available Fabric tools?" or "Create a sales analysis notebook in my Fabric workspace"

## 🚨 If Tools Don't Appear

### Option A: Restart Everything
1. Close Claude Desktop completely
2. Wait 10 seconds
3. Restart Claude Desktop
4. Wait for full initialization

### Option B: Check Logs
1. Open Task Manager
2. Look for any claude.exe or node.exe processes
3. End them all
4. Restart Claude Desktop

### Option C: Alternative Config Location
Sometimes Claude Desktop uses a different config location:
- Try: `%USERPROFILE%\.claude\claude_desktop_config.json`
- Or: `%LOCALAPPDATA%\Claude\claude_desktop_config.json`

## 📞 Support Information
- Current working directory: `C:\Users\saravi\OneDrive - Microsoft\MCP for Microsoft Fabric Analytics`
- Config location: `C:\Users\saravi\AppData\Roaming\Claude\claude_desktop_config.json`
- Server script: `build\index.js`
- Health endpoint: `http://localhost:3000/health` (when running manually)

## 🎯 Expected Behavior
When working correctly, you'll be able to:
1. See all tools listed in Claude Desktop settings
2. Use natural language to request notebook operations
3. Create notebooks from 5 different templates
4. Execute notebooks with custom parameters
5. Manage notebook definitions and metadata
