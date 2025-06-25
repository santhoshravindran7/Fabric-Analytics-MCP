#!/usr/bin/env python3
"""
Quick JSON-RPC Commands for Workspace Details

This script provides quick command-line access to common workspace operations
using direct JSON-RPC calls to your MCP server.

Usage:
    python quick_workspace_commands.py [command]
    
Commands:
    list-items    - List all workspace items
    get-item ID   - Get details for specific item
    list-tools    - List all available MCP tools
"""

import json
import subprocess
import time
import os
import sys


def send_json_rpc_request(bearer_token, workspace_id, method, params=None):
    """Send a single JSON-RPC request to the MCP server."""
    
    # Start server
    env = os.environ.copy()
    env.update({
        'FABRIC_BEARER_TOKEN': bearer_token,
        'FABRIC_WORKSPACE_ID': workspace_id,
        'SIMULATION_MODE': 'false'
    })
    
    try:
        server_process = subprocess.Popen(
            ['node', 'build/index.js'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            bufsize=1
        )
        
        # Wait for server to start
        time.sleep(3)
        
        if server_process.poll() is not None:
            print("❌ Server failed to start")
            return None
        
        # Initialize server first
        init_request = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
                'protocolVersion': '2024-11-05',
                'capabilities': {},
                'clientInfo': {'name': 'quick-commands', 'version': '1.0.0'}
            }
        }
        
        server_process.stdin.write(json.dumps(init_request) + '\n')
        server_process.stdin.flush()
        
        # Read init response
        time.sleep(1)
        init_response = server_process.stdout.readline()
        
        # Send actual request
        request = {
            'jsonrpc': '2.0',
            'id': 2,
            'method': method,
            'params': params or {}
        }
        
        server_process.stdin.write(json.dumps(request) + '\n')
        server_process.stdin.flush()
        
        # Read response
        time.sleep(2)
        response_line = server_process.stdout.readline()
        
        # Cleanup
        server_process.terminate()
        
        if response_line:
            return json.loads(response_line.strip())
        
        return None
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def list_workspace_items(bearer_token, workspace_id):
    """List all items in the workspace."""
    print("📊 Listing workspace items...")
      response = send_json_rpc_request(
        bearer_token, workspace_id,
        'tools/call',
        {'name': 'list-fabric-items', 'arguments': {}}
    )
    
    if response and 'result' in response:
        try:
            content = response['result']['content'][0]['text']
            data = json.loads(content)
            
            if data.get('status') == 'success':
                items = data['data'].get('value', [])
                
                print(f"✅ Found {len(items)} items:")
                print("\n" + "="*80)
                
                for i, item in enumerate(items, 1):
                    print(f"{i:2}. {item.get('displayName', 'Unnamed')}")
                    print(f"    Type: {item.get('type', 'Unknown')}")
                    print(f"    ID:   {item.get('id', 'No ID')}")
                    if item.get('createdDate'):
                        print(f"    Created: {item['createdDate']}")
                    print()
                
                return items
            else:
                print(f"❌ Error: {data.get('message', 'Unknown error')}")
        except Exception as e:
            print(f"❌ Error parsing response: {e}")
    else:
        print("❌ No response or error in response")
    
    return []


def get_item_details(bearer_token, workspace_id, item_id):
    """Get details for a specific item."""
    print(f"🔍 Getting details for item: {item_id}")
      response = send_json_rpc_request(
        bearer_token, workspace_id,
        'tools/call',
        {'name': 'get-fabric-item', 'arguments': {'itemId': item_id}}
    )
    
    if response and 'result' in response:
        try:
            content = response['result']['content'][0]['text']
            data = json.loads(content)
            
            if data.get('status') == 'success':
                item = data['data']
                
                print("✅ Item details:")
                print("="*50)
                print(f"Name:        {item.get('displayName', 'Unnamed')}")
                print(f"Type:        {item.get('type', 'Unknown')}")
                print(f"ID:          {item.get('id', 'No ID')}")
                print(f"Description: {item.get('description', 'No description')}")
                print(f"Created:     {item.get('createdDate', 'Unknown')}")
                print(f"Modified:    {item.get('modifiedDate', 'Unknown')}")
                
                return item
            else:
                print(f"❌ Error: {data.get('message', 'Unknown error')}")
        except Exception as e:
            print(f"❌ Error parsing response: {e}")
    else:
        print("❌ No response or error in response")
    
    return None


def list_available_tools(bearer_token, workspace_id):
    """List all available MCP tools."""
    print("🔧 Listing available MCP tools...")
    
    response = send_json_rpc_request(
        bearer_token, workspace_id,
        'tools/list',
        {}
    )
    
    if response and 'result' in response:
        tools = response['result'].get('tools', [])
        
        print(f"✅ Found {len(tools)} tools:")
        print("\n" + "="*80)
        
        for i, tool in enumerate(tools, 1):
            print(f"{i:2}. {tool.get('name', 'Unnamed')}")
            print(f"    Description: {tool.get('description', 'No description')}")
            
            # Show parameters if available
            if 'inputSchema' in tool and 'properties' in tool['inputSchema']:
                params = tool['inputSchema']['properties']
                if params:
                    print(f"    Parameters:")
                    for param_name, param_info in params.items():
                        param_desc = param_info.get('description', 'No description')
                        print(f"      - {param_name}: {param_desc}")
            print()
        
        return tools
    else:
        print("❌ No response or error in response")
    
    return []


def main():
    """Main function."""
    print("⚡ Quick Workspace Commands")
    print("="*40)
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
    else:
        command = None
    
    # Get credentials
    bearer_token = input("🔑 Enter Bearer Token: ").strip()
    workspace_id = input("🏢 Enter Workspace ID: ").strip()
    
    if not bearer_token or not workspace_id:
        print("❌ Bearer token and workspace ID are required")
        return 1
    
    print(f"\n🎯 Workspace: {workspace_id}")
    
    try:
        if command == 'list-items' or not command:
            # List all workspace items
            items = list_workspace_items(bearer_token, workspace_id)
            
            if items:
                print(f"\n💡 Tip: Use 'python {sys.argv[0]} get-item <ID>' to get details for a specific item")
        
        elif command == 'get-item':
            if len(sys.argv) > 2:
                item_id = sys.argv[2]
                get_item_details(bearer_token, workspace_id, item_id)
            else:
                # List items first, then ask for ID
                items = list_workspace_items(bearer_token, workspace_id)
                if items:
                    item_id = input(f"\n🔍 Enter item ID to get details: ").strip()
                    if item_id:
                        get_item_details(bearer_token, workspace_id, item_id)
        
        elif command == 'list-tools':
            list_available_tools(bearer_token, workspace_id)
        
        else:
            print(f"❌ Unknown command: {command}")
            print("\nAvailable commands:")
            print("  list-items  - List all workspace items")
            print("  get-item    - Get details for specific item")
            print("  list-tools  - List all available MCP tools")
            return 1
    
    except KeyboardInterrupt:
        print("\n⚠️ Operation interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    return 0


if __name__ == "__main__":
    exit(main())
