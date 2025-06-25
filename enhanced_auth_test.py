"""
Enhanced authentication test script for Microsoft Fabric Analytics MCP server
Demonstrates all authentication methods: Bearer Token, Service Principal, and Device Code
"""

import sys
import os
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Add the current directory to path to import our auth client
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from auth_client import MicrosoftAuthClient, AuthMethod, AuthResult

def test_workspace_list(auth_result: AuthResult, workspace_id: str) -> Dict[str, Any]:
    """Test workspace listing with authenticated token"""
    import requests
    
    headers = {
        'Authorization': f'Bearer {auth_result.access_token}',
        'Content-Type': 'application/json'
    }
    
    # Test basic workspace info
    url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return {
                "status": "success",
                "data": response.json(),
                "message": "Successfully retrieved workspace information"
            }
        else:
            return {
                "status": "error",
                "error": f"HTTP {response.status_code}: {response.text}",
                "message": "Failed to retrieve workspace information"
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Network error or invalid request"
        }

def test_fabric_api_access(auth_result: AuthResult) -> Dict[str, Any]:
    """Test general Fabric API access"""
    import requests
    
    headers = {
        'Authorization': f'Bearer {auth_result.access_token}',
        'Content-Type': 'application/json'
    }
    
    # Test workspaces list endpoint
    url = "https://api.fabric.microsoft.com/v1/workspaces"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            workspaces = data.get('value', [])
            return {
                "status": "success",
                "data": {
                    "workspace_count": len(workspaces),
                    "workspaces": workspaces[:3]  # Show first 3 workspaces
                },
                "message": f"Successfully retrieved {len(workspaces)} workspaces"
            }
        else:
            return {
                "status": "error",
                "error": f"HTTP {response.status_code}: {response.text}",
                "message": "Failed to retrieve workspaces"
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Network error or invalid request"
        }

def run_enhanced_auth_test():
    """Run the enhanced authentication test"""
    print("🔐 Microsoft Fabric Analytics - Enhanced Authentication Test")
    print("=" * 80)
    print("This script tests all available authentication methods:")
    print("• Bearer Token (manual token input)")
    print("• Service Principal (client credentials flow)")
    print("• Device Code (browser authentication on another device)")  
    print("• Interactive (opens browser automatically)")
    print("=" * 80 + "\n")
    
    # Initialize authentication client
    client = MicrosoftAuthClient()
    
    try:
        # Authenticate using selected method
        print("🔄 Starting authentication process...")
        auth_result = client.authenticate()
        
        print(f"\n✅ Authentication successful!")
        print(f"📅 Token expires: {auth_result.expires_on}")
        print(f"⏱️  Time remaining: {auth_result.expires_in_seconds()} seconds")
        
        if auth_result.account:
            username = auth_result.account.get('username', 'Unknown')
            print(f"👤 Authenticated as: {username}")
        
        # Test Fabric API access
        print(f"\n🔍 Testing Fabric API access...")
        api_test = test_fabric_api_access(auth_result)
        
        if api_test["status"] == "success":
            print(f"✅ {api_test['message']}")
            workspace_count = api_test["data"]["workspace_count"]
            print(f"📊 Found {workspace_count} accessible workspaces")
            
            if workspace_count > 0:
                print("\n📋 Available workspaces:")
                for i, workspace in enumerate(api_test["data"]["workspaces"], 1):
                    print(f"  {i}. {workspace.get('displayName', 'Unknown')} (ID: {workspace.get('id', 'Unknown')})")
                
                # Test specific workspace if available
                if workspace_count > 0:
                    workspace_id = api_test["data"]["workspaces"][0]["id"]
                    print(f"\n🔍 Testing specific workspace access...")
                    workspace_test = test_workspace_list(auth_result, workspace_id)
                    
                    if workspace_test["status"] == "success":
                        print(f"✅ {workspace_test['message']}")
                        workspace_name = workspace_test["data"].get("displayName", "Unknown")
                        print(f"📁 Workspace: {workspace_name}")
                    else:
                        print(f"❌ {workspace_test['message']}: {workspace_test['error']}")
            
        else:
            print(f"❌ {api_test['message']}: {api_test['error']}")
            print("\n💡 Troubleshooting tips:")
            print("• Verify your token has proper permissions")
            print("• Check if you have access to Microsoft Fabric")
            print("• Ensure your tenant has Fabric enabled")
        
        # Token validation test
        print(f"\n🔒 Token validation test...")
        if auth_result.is_valid():
            print("✅ Token is still valid")
        else:
            print("❌ Token has expired")
        
        # Save authentication details for MCP server usage
        save_for_mcp_server(auth_result)
        
        print(f"\n🎉 Enhanced authentication test completed successfully!")
        print(f"💡 You can now use this token with the MCP server or other test scripts.")
        
        return auth_result
        
    except KeyboardInterrupt:
        print("\n🚫 Test cancelled by user.")
        return None
    except Exception as e:
        print(f"\n❌ Authentication test failed: {e}")
        print(f"🔧 Error type: {type(e).__name__}")
        return None

def save_for_mcp_server(auth_result: AuthResult):
    """Save authentication details for MCP server usage"""
    try:
        # Create a temporary config file (not committed to git)
        config = {
            "auth": {
                "access_token": auth_result.access_token,
                "expires_on": auth_result.expires_on.isoformat(),
                "token_type": "Bearer",
                "created_at": datetime.now().isoformat()
            }
        }
        
        config_file = "temp_auth_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"\n💾 Authentication details saved to {config_file}")
        print(f"⚠️  This file contains sensitive information and is not committed to git.")
        
    except Exception as e:
        print(f"\n⚠️  Could not save authentication details: {e}")

def main():
    """Main function"""
    try:
        # Check if requests is available
        import requests
    except ImportError:
        print("❌ The 'requests' library is required for API testing.")
        print("Please install it with: pip install requests")
        return
    
    # Run the enhanced authentication test
    auth_result = run_enhanced_auth_test()
    
    if auth_result:
        print(f"\n" + "=" * 80)
        print("🔑 AUTHENTICATION SUMMARY")
        print("=" * 80)
        print(f"✅ Status: Successfully authenticated")
        print(f"🔐 Token: {auth_result.access_token[:20]}...")
        print(f"⏰ Expires: {auth_result.expires_on}")
        print(f"🕒 Valid for: {auth_result.expires_in_seconds()} seconds")
        
        if auth_result.account:
            print(f"👤 Account: {auth_result.account.get('username', 'Unknown')}")
        
        print(f"🚀 Ready to use with MCP server and other tools!")
        print("=" * 80)
    else:
        print(f"\n" + "=" * 80)
        print("❌ AUTHENTICATION FAILED")
        print("=" * 80)
        print("Please check your credentials and try again.")
        print("=" * 80)

if __name__ == "__main__":
    main()
