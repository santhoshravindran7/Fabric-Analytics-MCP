#!/usr/bin/env python3
"""
Comprehensive Authentication Validation Script
Tests all authentication methods with the MCP server and Fabric APIs

This script validates:
1. Bearer Token authentication
2. Service Principal authentication  
3. Device Code authentication
4. Interactive authentication
5. MCP server integration
6. Fabric API access
"""

import sys
import os
import json
import subprocess
import time
from datetime import datetime
from typing import Dict, Any, Optional, List

# Add the current directory to path to import our auth client
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from auth_client import MicrosoftAuthClient, AuthMethod, AuthResult

class ComprehensiveAuthValidator:
    """Comprehensive authentication validator for all supported methods"""
    
    def __init__(self):
        self.results: Dict[str, Any] = {}
        self.auth_client = MicrosoftAuthClient()
    
    def validate_fabric_api_access(self, auth_result: AuthResult) -> Dict[str, Any]:
        """Validate access to Microsoft Fabric APIs"""
        try:
            import requests
            
            headers = {
                'Authorization': f'Bearer {auth_result.access_token}',
                'Content-Type': 'application/json'
            }
            
            # Test workspaces endpoint
            response = requests.get(
                "https://api.fabric.microsoft.com/v1/workspaces",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                workspaces = data.get('value', [])
                return {
                    "success": True,
                    "workspace_count": len(workspaces),
                    "message": f"Successfully accessed {len(workspaces)} workspaces"
                }
            else:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "message": f"API access failed: {response.text[:200]}"
                }
                
        except ImportError:
            return {
                "success": False,
                "message": "requests library not available - install with: pip install requests"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"API validation failed: {str(e)}"
            }
    
    def test_mcp_server_startup(self) -> Dict[str, Any]:
        """Test if the MCP server can start successfully"""
        try:
            # Check if build directory exists
            build_path = os.path.join(os.getcwd(), "build", "index.js")
            if not os.path.exists(build_path):
                return {
                    "success": False,
                    "message": "MCP server not built. Run 'npm run build' first."
                }
            
            # Test server startup (quick test)
            proc = subprocess.Popen(
                ["node", "build/index.js"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Send a simple initialize request
            init_request = json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test-client", "version": "1.0.0"}
                }
            }) + "\n"
            
            proc.stdin.write(init_request)
            proc.stdin.flush()
            
            # Wait for response or timeout
            try:
                stdout, stderr = proc.communicate(timeout=10)
                if stdout and "result" in stdout:
                    return {
                        "success": True,
                        "message": "MCP server started successfully"
                    }
                else:
                    return {
                        "success": False,
                        "message": f"MCP server startup failed: {stderr}"
                    }
            except subprocess.TimeoutExpired:
                proc.kill()
                return {
                    "success": False,
                    "message": "MCP server startup timeout"
                }
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    proc.wait()
                    
        except Exception as e:
            return {
                "success": False,
                "message": f"MCP server test failed: {str(e)}"
            }
    
    def test_authentication_method(self, method: AuthMethod, test_params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Test a specific authentication method"""
        print(f"\n🔒 Testing {method.value} authentication...")
        
        try:
            if method == AuthMethod.BEARER_TOKEN:
                if not test_params or "token" not in test_params:
                    token = input("Enter bearer token for testing: ").strip()
                else:
                    token = test_params["token"]
                
                auth_result = self.auth_client.authenticate_with_bearer_token(token)
                
            elif method == AuthMethod.SERVICE_PRINCIPAL:
                if not test_params:
                    client_id = input("Enter Client ID: ").strip()
                    client_secret = input("Enter Client Secret: ").strip()
                    tenant_id = input("Enter Tenant ID: ").strip()
                else:
                    client_id = test_params["client_id"]
                    client_secret = test_params["client_secret"]
                    tenant_id = test_params["tenant_id"]
                
                auth_result = self.auth_client.authenticate_with_service_principal(
                    client_id, client_secret, tenant_id
                )
                
            elif method == AuthMethod.DEVICE_CODE:
                if not test_params:
                    client_id = input("Enter Client ID: ").strip()
                    tenant_id = input("Enter Tenant ID (optional): ").strip() or None
                else:
                    client_id = test_params["client_id"]
                    tenant_id = test_params.get("tenant_id")
                
                auth_result = self.auth_client.authenticate_with_device_code(
                    client_id, tenant_id
                )
                
            elif method == AuthMethod.INTERACTIVE:
                if not test_params:
                    client_id = input("Enter Client ID: ").strip()
                    tenant_id = input("Enter Tenant ID (optional): ").strip() or None
                else:
                    client_id = test_params["client_id"]
                    tenant_id = test_params.get("tenant_id")
                
                auth_result = self.auth_client.authenticate_interactively(
                    client_id, tenant_id
                )
            else:
                return {
                    "success": False,
                    "message": f"Unsupported authentication method: {method}"
                }
            
            # Validate the authentication result
            if not auth_result.is_valid():
                return {
                    "success": False,
                    "message": "Authentication succeeded but token is invalid"
                }
            
            # Test Fabric API access
            api_result = self.validate_fabric_api_access(auth_result)
            
            return {
                "success": True,
                "message": f"Authentication successful using {method.value}",
                "token_expires": auth_result.expires_on.isoformat(),
                "expires_in_seconds": auth_result.expires_in_seconds(),
                "api_access": api_result,
                "account": auth_result.account.get("username") if auth_result.account else None
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Authentication failed: {str(e)}"
            }
    
    def run_interactive_validation(self):
        """Run interactive validation of all authentication methods"""
        print("🔐 Comprehensive Authentication Validation")
        print("=" * 60)
        print("This script will test all available authentication methods")
        print("and validate integration with Microsoft Fabric APIs.")
        print("=" * 60)
        
        # Test MCP server first
        print("\n🔧 Testing MCP Server...")
        mcp_result = self.test_mcp_server_startup()
        self.results["mcp_server"] = mcp_result
        
        if mcp_result["success"]:
            print("✅ MCP server startup test passed")
        else:
            print(f"❌ MCP server test failed: {mcp_result['message']}")
        
        # Test authentication methods
        methods_to_test = []
        
        print("\n🔒 Select authentication methods to test:")
        print("1. Bearer Token")
        print("2. Service Principal")
        print("3. Device Code")
        print("4. Interactive")
        print("5. All methods")
        
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == "1":
            methods_to_test = [AuthMethod.BEARER_TOKEN]
        elif choice == "2":
            methods_to_test = [AuthMethod.SERVICE_PRINCIPAL]
        elif choice == "3":
            methods_to_test = [AuthMethod.DEVICE_CODE]
        elif choice == "4":
            methods_to_test = [AuthMethod.INTERACTIVE]
        elif choice == "5":
            methods_to_test = [
                AuthMethod.BEARER_TOKEN,
                AuthMethod.SERVICE_PRINCIPAL,
                AuthMethod.DEVICE_CODE,
                AuthMethod.INTERACTIVE
            ]
        else:
            print("❌ Invalid choice")
            return
        
        # Test each selected method
        for method in methods_to_test:
            result = self.test_authentication_method(method)
            self.results[method.value] = result
            
            if result["success"]:
                print(f"✅ {method.value} authentication: SUCCESS")
                if result["api_access"]["success"]:
                    print(f"   📊 API Access: {result['api_access']['message']}")
                else:
                    print(f"   ❌ API Access: {result['api_access']['message']}")
                print(f"   ⏰ Token expires: {result['token_expires']}")
            else:
                print(f"❌ {method.value} authentication: FAILED")
                print(f"   Error: {result['message']}")
        
        # Generate summary report
        self.generate_summary_report()
    
    def generate_summary_report(self):
        """Generate and display summary report"""
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE AUTHENTICATION VALIDATION REPORT")
        print("=" * 80)
        
        # MCP Server Status
        mcp_status = "✅ PASS" if self.results.get("mcp_server", {}).get("success") else "❌ FAIL"
        print(f"🔧 MCP Server Startup: {mcp_status}")
        
        # Authentication Methods
        print(f"\n🔐 Authentication Methods:")
        auth_results = []
        
        for method in AuthMethod:
            if method.value in self.results:
                result = self.results[method.value]
                status = "✅ PASS" if result["success"] else "❌ FAIL"
                api_status = "✅" if result.get("api_access", {}).get("success") else "❌"
                
                print(f"   {status} {method.value.upper():<20} API: {api_status}")
                auth_results.append(result["success"])
        
        # Overall Statistics
        total_tests = len(auth_results) + 1  # +1 for MCP server
        passed_tests = sum(auth_results) + (1 if self.results.get("mcp_server", {}).get("success") else 0)
        
        print(f"\n📈 Overall Results:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests}")
        print(f"   Failed: {total_tests - passed_tests}")
        print(f"   Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Recommendations
        print(f"\n💡 Recommendations:")
        if passed_tests == total_tests:
            print("   🎉 All tests passed! Your authentication setup is ready for production.")
            print("   🚀 You can now use the MCP server with Claude Desktop.")
        else:
            print("   🔧 Some tests failed. Please check:")
            if not self.results.get("mcp_server", {}).get("success"):
                print("   - MCP server build and startup issues")
            for method in AuthMethod:
                if method.value in self.results and not self.results[method.value]["success"]:
                    print(f"   - {method.value} authentication configuration")
        
        # Save report to file
        report_file = f"auth_validation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print(f"\n💾 Detailed report saved to: {report_file}")
        print("=" * 80)

def main():
    """Main function"""
    try:
        validator = ComprehensiveAuthValidator()
        validator.run_interactive_validation()
        
    except KeyboardInterrupt:
        print("\n🚫 Validation cancelled by user.")
    except Exception as e:
        print(f"\n❌ Validation failed: {e}")

if __name__ == "__main__":
    main()
