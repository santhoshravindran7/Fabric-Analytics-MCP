#!/usr/bin/env python3
"""
MCP Server Demo for Spark Application Monitoring with Enhanced Authentication

This script demonstrates how to interact with the Microsoft Fabric Analytics
MCP Server to monitor Spark applications across different Fabric items.

Features:
- Multiple authentication methods (Bearer Token, Service Principal, Device Code)
- Simulation of Claude Desktop MCP interactions
- Comprehensive Spark monitoring scenarios
- Real-world usage examples

This is a simulation of what Claude Desktop would do when interacting
with the MCP server for Spark monitoring queries.
"""

import json
import sys
import os
from typing import Dict, Any

# Add the current directory to path to import our auth client
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from auth_client import MicrosoftAuthClient, AuthMethod, AuthResult

def simulate_mcp_tool_call(tool_name: str, parameters: Dict[str, Any], auth_result: AuthResult) -> Dict[str, Any]:
    """
    Simulate calling an MCP tool with authentication (this would be done by Claude Desktop automatically)
    
    In reality, Claude Desktop would:
    1. Parse the user's natural language query
    2. Determine which MCP tool to call
    3. Extract parameters from the query (including auth token)
    4. Call the MCP server tool
    5. Present the results to the user
    """
    
    print(f"🔧 Simulated MCP Tool Call: {tool_name}")
    print(f"🔐 Using authenticated token: {auth_result.access_token[:20]}...")
    print(f"📝 Parameters: {json.dumps(parameters, indent=2)}")
    print()
    
    # Add bearer token to all parameters (as MCP server would expect)
    parameters_with_auth = {
        **parameters,
        "bearerToken": f"Bearer {auth_result.access_token}"
    }
    
    # This is what the actual MCP server would return
    if tool_name == "get-workspace-spark-applications":
        return {
            "success": True,
            "message": f"Found Spark applications in workspace {parameters['workspaceId']}",
            "example_response": {
                "total_applications": 5,
                "states": {"Running": 2, "Completed": 2, "Cancelled": 1},
                "item_types": {"Notebook": 3, "Lakehouse": 1, "SparkJobDefinition": 1}
            },
            "auth_status": "✅ Authenticated successfully",
            "token_expires": auth_result.expires_on.isoformat()
        }
    elif tool_name == "get-notebook-spark-applications":
        return {
            "success": True,
            "message": f"Found Spark applications for notebook {parameters['notebookId']}",
            "example_response": {
                "total_applications": 2,
                "latest_state": "Running", 
                "recent_activity": "Application started 5 minutes ago"
            },            "auth_status": "✅ Authenticated successfully",
            "token_expires": auth_result.expires_on.isoformat()
        }
    elif tool_name == "get-spark-monitoring-dashboard":
        return {
            "success": True,
            "message": f"Generated comprehensive monitoring dashboard for workspace {parameters['workspaceId']}",
            "example_response": {
                "dashboard_url": "Generated monitoring dashboard with analytics",
                "summary": "12 total applications, 8 completed, 2 running, 2 failed",
                "recommendations": ["Check failed applications", "Monitor resource usage"]
            },            "auth_status": "✅ Authenticated successfully",
            "token_expires": auth_result.expires_on.isoformat()
        }
    else:
        return {
            "success": False,
            "message": f"Unknown tool: {tool_name}",
            "auth_status": "✅ Authenticated successfully",
            "token_expires": auth_result.expires_on.isoformat()
        }

def main():
    """Demonstrate MCP server interactions for Spark monitoring with enhanced authentication"""
    
    print("🤖 Microsoft Fabric Analytics MCP Server - Spark Monitoring Demo")
    print("=" * 70)
    print()
    print("This demo shows how Claude Desktop would interact with our MCP server")
    print("to provide Spark application monitoring capabilities with enhanced authentication.")
    print()
    
    # Authenticate first
    print("🔐 Authentication Setup:")
    auth_client = MicrosoftAuthClient()
    
    try:
        auth_result = auth_client.authenticate()
        print(f"\n✅ Authentication successful!")
        print(f"📅 Token expires: {auth_result.expires_on}")
        print(f"⏱️  Time remaining: {auth_result.expires_in_seconds()} seconds")
        
    except Exception as e:
        print(f"\n❌ Authentication failed: {e}")
        return
    
    # Configuration (these would come from the user's actual workspace)
    print("\n📋 Configuration Setup:")
    config = {
        "workspace_id": input("Enter your Workspace ID: ").strip(),
        "lakehouse_id": input("Enter your Lakehouse ID (optional): ").strip(),
        "notebook_id": input("Enter your Notebook ID (optional): ").strip(),
        "spark_job_definition_id": input("Enter your Spark Job Definition ID (optional): ").strip()
    }
    
    if not config["workspace_id"]:
        print("❌ Workspace ID is required")
        return
    
    print("\n📋 Example Claude Queries and MCP Tool Interactions:")
    print("=" * 50)
    
    # Example 1: Workspace-level monitoring
    print("\n1️⃣ User Query: 'Show me all Spark applications in my workspace'")
    print("   👤 Claude understands this and calls the MCP tool:")
    
    result1 = simulate_mcp_tool_call("get-workspace-spark-applications", {
        "workspaceId": config["workspace_id"]
    }, auth_result)
    
    print(f"   🤖 Claude Response: {result1['message']}")
    if result1["success"]:
        print(f"   📊 Summary: {result1['example_response']}")
        print(f"   🔐 Auth Status: {result1['auth_status']}")
    print()
    
    # Example 2: Notebook-specific monitoring
    if config["notebook_id"]:
        print("2️⃣ User Query: 'What's the status of Spark jobs in my notebook?'")
        print("   👤 Claude calls the notebook monitoring tool:")
        
        result2 = simulate_mcp_tool_call("get-notebook-spark-applications", {
            "workspaceId": config["workspace_id"],
            "notebookId": config["notebook_id"]
        }, auth_result)
        
        print(f"   🤖 Claude Response: {result2['message']}")
        if result2["success"]:
            print(f"   📊 Details: {result2['example_response']}")
            print(f"   🔐 Auth Status: {result2['auth_status']}")
        print()
    print("2️⃣ User Query: 'What's the status of Spark jobs for my notebook?'")
    print("   👤 Claude identifies the notebook and calls:")
    
    result2 = simulate_mcp_tool_call("get-notebook-spark-applications", {
        "bearerToken": config["bearer_token"],
        "workspaceId": config["workspace_id"],
        "notebookId": config["notebook_id"]
    })
    
    print(f"   🤖 Claude Response: {result2['message']}")
    if result2["success"]:
        print(f"   📊 Details: {result2['example_response']}")
    print()
    
    # Example 3: Comprehensive dashboard
    print("3️⃣ User Query: 'Generate a monitoring dashboard for all my Spark applications'")
    print("   👤 Claude creates a comprehensive view:")
    
    result3 = simulate_mcp_tool_call("get-spark-monitoring-dashboard", {
        "bearerToken": config["bearer_token"],
        "workspaceId": config["workspace_id"]
    })
    
    print(f"   🤖 Claude Response: {result3['message']}")
    if result3["success"]:
        print(f"   📊 Dashboard: {result3['example_response']}")
    print()
    
    print("💡 Available MCP Tools for Spark Monitoring:")
    print("=" * 50)
    
    tools = [
        "get-workspace-spark-applications - Monitor all applications in workspace",
        "get-notebook-spark-applications - Monitor notebook-specific applications", 
        "get-lakehouse-spark-applications - Monitor lakehouse-specific applications",
        "get-spark-job-definition-applications - Monitor Spark Job Definition applications",
        "get-spark-application-details - Get detailed application information",
        "cancel-spark-application - Cancel running applications", 
        "get-spark-monitoring-dashboard - Generate comprehensive dashboard"
    ]
    
    for i, tool in enumerate(tools, 1):
        print(f"   {i}. {tool}")
    
    print()
    print("🚀 To use with Claude Desktop:")
    print("=" * 50)
    print("1. Start the MCP server: npm start")
    print("2. Configure Claude Desktop with the server")
    print("3. Ask Claude questions like:")
    print("   • 'Show me all running Spark applications'")
    print("   • 'What's the status of my notebook jobs?'") 
    print("   • 'Generate a Spark monitoring report'")
    print("   • 'Cancel the failed Spark application xyz'")
    print("4. Claude will automatically call the appropriate MCP tools")
    print("5. You'll get comprehensive monitoring insights!")
    
    print()
    print("✅ MCP Server is ready for Spark application monitoring!")

if __name__ == "__main__":
    main()
