#!/usr/bin/env python3
"""
Spark Application Monitoring Test Script with Enhanced Authentication

This script tests the Microsoft Fabric Spark application monitoring APIs
for tracking the status of Spark jobs across different Fabric items.

Features:
- Multiple authentication methods (Bearer Token, Service Principal, Device Code)
- Workspace-level Spark application monitoring
- Item-specific monitoring (Notebook, Lakehouse, Spark Job Definition)
- Application state analysis and filtering
- Real-time status checking

Author: Generated for Microsoft Fabric Analytics MCP Server
"""

import requests
import json
import time
import sys
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

# Add the current directory to path to import our auth client
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from auth_client import MicrosoftAuthClient, AuthMethod, AuthResult

# Configuration - Will be set interactively
CONFIG = {
    "workspace_id": "",
    "lakehouse_id": "",
    "notebook_id": "",
    "spark_job_definition_id": "",
    "fabric_base_url": "https://api.fabric.microsoft.com/v1",
    "timeout_seconds": 30
}

class SparkMonitoringClient:
    """Client for Microsoft Fabric Spark Application Monitoring APIs with Enhanced Authentication"""
    
    def __init__(self, auth_result: AuthResult):
        self.auth_result = auth_result
        self.headers = {
            'Authorization': f'Bearer {auth_result.access_token}',
            'Content-Type': 'application/json'
        }
    
    def check_token_validity(self) -> bool:
        """Check if the current token is still valid"""
        if not self.auth_result.is_valid():
            print(f"⚠️  Token has expired! Expired at: {self.auth_result.expires_on}")
            return False
        
        remaining_seconds = self.auth_result.expires_in_seconds()
        if remaining_seconds < 300:  # Less than 5 minutes
            print(f"⚠️  Token expires soon! {remaining_seconds} seconds remaining")
        
        return True
    
    def get_workspace_spark_applications(self, workspace_id: str, continuation_token: Optional[str] = None) -> Dict[str, Any]:
        """Get all Spark applications in a workspace"""
        url = f"{CONFIG['fabric_base_url']}/workspaces/{workspace_id}/spark/livySessions"
        
        params = {}
        if continuation_token:
            params['continuationToken'] = continuation_token
        
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=CONFIG['timeout_seconds'])
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'data': data,
                    'total_applications': len(data.get('value', [])),
                    'has_more': bool(data.get('continuationToken'))
                }
            else:
                return {
                    'success': False,
                    'error': f"API request failed with status {response.status_code}: {response.text}",
                    'status_code': response.status_code
                }
                
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f"Request failed: {str(e)}"
            }
    
    def get_notebook_spark_applications(self, workspace_id: str, notebook_id: str, continuation_token: Optional[str] = None) -> Dict[str, Any]:
        """Get Spark applications for a specific notebook"""
        url = f"{CONFIG['fabric_base_url']}/workspaces/{workspace_id}/notebooks/{notebook_id}/livySessions"
        
        params = {}
        if continuation_token:
            params['continuationToken'] = continuation_token
        
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=CONFIG['timeout_seconds'])
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'data': data,
                    'total_applications': len(data.get('value', [])),
                    'has_more': bool(data.get('continuationToken'))
                }
            else:
                return {
                    'success': False,
                    'error': f"API request failed with status {response.status_code}: {response.text}",
                    'status_code': response.status_code
                }
                
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f"Request failed: {str(e)}"
            }
    
    def get_lakehouse_spark_applications(self, workspace_id: str, lakehouse_id: str, continuation_token: Optional[str] = None) -> Dict[str, Any]:
        """Get Spark applications for a specific lakehouse"""  
        url = f"{CONFIG['fabric_base_url']}/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/livySessions"
        
        params = {}
        if continuation_token:
            params['continuationToken'] = continuation_token
        
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=CONFIG['timeout_seconds'])
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'data': data,
                    'total_applications': len(data.get('value', [])),
                    'has_more': bool(data.get('continuationToken'))
                }
            else:
                return {
                    'success': False,
                    'error': f"API request failed with status {response.status_code}: {response.text}",
                    'status_code': response.status_code
                }
                
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f"Request failed: {str(e)}"
            }
    
    def get_spark_job_definition_applications(self, workspace_id: str, spark_job_definition_id: str, continuation_token: Optional[str] = None) -> Dict[str, Any]:
        """Get Spark applications for a specific Spark Job Definition"""
        url = f"{CONFIG['fabric_base_url']}/workspaces/{workspace_id}/sparkJobDefinitions/{spark_job_definition_id}/livySessions"
        
        params = {}
        if continuation_token:
            params['continuationToken'] = continuation_token
        
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=CONFIG['timeout_seconds'])
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'data': data,
                    'total_applications': len(data.get('value', [])),
                    'has_more': bool(data.get('continuationToken'))
                }
            else:
                return {
                    'success': False,
                    'error': f"API request failed with status {response.status_code}: {response.text}",
                    'status_code': response.status_code
                }
                
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f"Request failed: {str(e)}"
            }

def analyze_applications(all_results: Dict[str, Dict[str, Any]]) -> None:
    """Analyze Spark applications across all sources"""
    
    print("\n" + "=" * 60)
    print("📊 SPARK APPLICATION ANALYSIS")
    print("=" * 60)
    
    all_applications = []
    
    # Collect all applications
    for source, result in all_results.items():
        if result.get('success') and result.get('data', {}).get('value'):
            for app in result['data']['value']:
                app['source'] = source
                all_applications.append(app)
    
    if not all_applications:
        print("❌ No applications found across all sources")
        return
    
    print(f"📈 Total applications found: {len(all_applications)}")
    
    # Analyze by state
    states = {}
    for app in all_applications:
        state = app.get('state', 'Unknown')
        states[state] = states.get(state, 0) + 1
    
    print(f"\n📊 Applications by State:")
    for state, count in sorted(states.items()):
        print(f"   {state}: {count}")
    
    # Analyze by item type
    item_types = {}
    for app in all_applications:
        item_type = app.get('itemType', 'Unknown')
        item_types[item_type] = item_types.get(item_type, 0) + 1
    
    print(f"\n📊 Applications by Item Type:")
    for item_type, count in sorted(item_types.items()):
        print(f"   {item_type}: {count}")
    
    # Show recent failed applications
    failed_apps = [app for app in all_applications if app.get('state') in ['Failed', 'Cancelled', 'Error']]
    if failed_apps:
        print(f"\n❌ Failed/Cancelled Applications ({len(failed_apps)}):")
        for i, app in enumerate(failed_apps[:3], 1):
            print(f"   {i}. {app.get('itemName', 'N/A')} ({app.get('state', 'N/A')})")
            if app.get('cancellationReason'):
                print(f"      Reason: {app.get('cancellationReason')}")

def main():
    """Main test function with enhanced authentication and interactive configuration"""
    
    print("🚀 Microsoft Fabric Spark Application Monitoring Test")
    print("=" * 60)
    print("This script tests Spark monitoring APIs with multiple authentication options")
    print("=" * 60)
    
    # Authenticate first
    print("\n🔐 Authentication Setup:")
    auth_client = MicrosoftAuthClient()
    
    try:
        auth_result = auth_client.authenticate()
        print(f"\n✅ Authentication successful!")
        print(f"📅 Token expires: {auth_result.expires_on}")
        print(f"⏱️  Time remaining: {auth_result.expires_in_seconds()} seconds")
        
    except Exception as e:
        print(f"\n❌ Authentication failed: {e}")
        return
    
    # Get configuration interactively
    print("\n📋 Configuration Setup:")
    CONFIG['workspace_id'] = input("Enter your Workspace ID: ").strip()
    CONFIG['lakehouse_id'] = input("Enter your Lakehouse ID (optional): ").strip()
    CONFIG['notebook_id'] = input("Enter your Notebook ID (optional): ").strip()
    CONFIG['spark_job_definition_id'] = input("Enter your Spark Job Definition ID (optional): ").strip()
    
    if not CONFIG['workspace_id']:
        print("❌ Workspace ID is required")
        return
    
    # Initialize monitoring client with authenticated token
    client = SparkMonitoringClient(auth_result)
    
    # Check token validity before proceeding
    if not client.check_token_validity():
        print("❌ Token is not valid. Please re-authenticate.")
        return
    
    print(f"\n🔧 Using Configuration:")
    print(f"   Workspace ID: {CONFIG['workspace_id']}")
    if CONFIG['lakehouse_id']:
        print(f"   Lakehouse ID: {CONFIG['lakehouse_id']}")
    if CONFIG['notebook_id']:
        print(f"   Notebook ID: {CONFIG['notebook_id']}")
    if CONFIG['spark_job_definition_id']:
        print(f"   Spark Job Definition ID: {CONFIG['spark_job_definition_id']}")
    
    results = {}
    
    # Test 1: Workspace applications
    print(f"\n📋 Test 1: Getting workspace Spark applications...")
    workspace_result = client.get_workspace_spark_applications(CONFIG['workspace_id'])
    results['workspace'] = workspace_result
    
    if workspace_result['success']:
        print(f"✅ Found {workspace_result['total_applications']} applications in workspace")
    else:
        print(f"❌ Failed: {workspace_result.get('error', 'Unknown error')}")
      # Test 2: Notebook applications (if notebook ID provided)
    if CONFIG['notebook_id']:
        print(f"\n📔 Test 2: Getting notebook Spark applications...")
        notebook_result = client.get_notebook_spark_applications(CONFIG['workspace_id'], CONFIG['notebook_id'])
        results['notebook'] = notebook_result
        
        if notebook_result['success']:
            print(f"✅ Found {notebook_result['total_applications']} applications for notebook")
        else:
            print(f"❌ Failed: {notebook_result.get('error', 'Unknown error')}")
    else:
        print(f"\n📔 Test 2: Skipping notebook test (no notebook ID provided)")
      # Test 3: Lakehouse applications (if lakehouse ID provided)
    if CONFIG['lakehouse_id']:
        print(f"\n🏠 Test 3: Getting lakehouse Spark applications...")
        lakehouse_result = client.get_lakehouse_spark_applications(CONFIG['workspace_id'], CONFIG['lakehouse_id'])
        results['lakehouse'] = lakehouse_result
        
        if lakehouse_result['success']:
            print(f"✅ Found {lakehouse_result['total_applications']} applications for lakehouse")
        else:
            print(f"❌ Failed: {lakehouse_result.get('error', 'Unknown error')}")
    else:
        print(f"\n🏠 Test 3: Skipping lakehouse test (no lakehouse ID provided)")
    
    # Test 4: Spark Job Definition applications
    print(f"\n⚙️ Test 4: Getting Spark Job Definition applications...")
    sjd_result = client.get_spark_job_definition_applications(CONFIG['workspace_id'], CONFIG['spark_job_definition_id'])
    results['spark_job_definition'] = sjd_result
    
    if sjd_result['success']:
        print(f"✅ Found {sjd_result['total_applications']} applications for Spark Job Definition")
    else:
        print(f"❌ Failed: {sjd_result.get('error', 'Unknown error')}")
    
    # Analyze results
    analyze_applications(results)
    
    # Summary
    print(f"\n" + "=" * 60)
    print("🎯 TEST SUMMARY")
    print("=" * 60)
    successful_tests = sum(1 for result in results.values() if result.get('success'))
    total_tests = len(results)
    print(f"✅ Successful tests: {successful_tests}/{total_tests}")
    
    for test_name, result in results.items():
        status = "✅" if result.get('success') else "❌"
        count = result.get('total_applications', 0) if result.get('success') else 0
        print(f"   {status} {test_name.title()}: {count} applications")
    
    if successful_tests == total_tests:
        print(f"\n🎉 All tests passed! Spark monitoring is working correctly.")
    else:
        print(f"\n⚠️ Some tests failed. Check your configuration and authentication.")
    
    print(f"\n💡 Next steps:")
    print(f"   1. Use these APIs in your MCP server")
    print(f"   2. Integrate with Claude Desktop for monitoring")
    print(f"   3. Set up automated monitoring dashboards")

if __name__ == "__main__":
    main()
