#!/usr/bin/env python3
"""
Claude Desktop Configuration Validator

This script helps validate that your Claude Desktop configuration is set up correctly
for the Microsoft Fabric Analytics MCP Server with Spark monitoring capabilities.
"""

import os
import json
import subprocess
import sys
from pathlib import Path

def validate_claude_desktop_config():
    """Validate Claude Desktop configuration"""
    
    print("🔧 Claude Desktop Configuration Validator")
    print("=" * 50)
    
    # Check if Claude Desktop config exists
    config_path = Path.home() / "AppData" / "Roaming" / "Claude" / "claude_desktop_config.json"
    
    print(f"📍 Checking Claude Desktop config at:")
    print(f"   {config_path}")
    
    if not config_path.exists():
        print("❌ Claude Desktop config file not found!")
        print("💡 You need to create the file at:")
        print(f"   {config_path}")
        return False
    
    print("✅ Claude Desktop config file exists")
    
    # Read and validate config
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        print("✅ Config file is valid JSON")
        
        # Check for MCP servers
        if "mcpServers" not in config:
            print("❌ No mcpServers section found in config")
            return False
        
        print("✅ mcpServers section found")
        
        # Check for fabric-analytics server
        if "fabric-analytics" not in config["mcpServers"]:
            print("❌ fabric-analytics server not configured")
            return False
        
        print("✅ fabric-analytics server configured")
        
        # Check server configuration
        server_config = config["mcpServers"]["fabric-analytics"]
        
        if "command" not in server_config or server_config["command"] != "node":
            print("❌ Command should be 'node'")
            return False
        
        print("✅ Command is correctly set to 'node'")
        
        if "args" not in server_config or len(server_config["args"]) == 0:
            print("❌ Args not configured")
            return False
        
        # Check if the build file exists
        build_path = server_config["args"][0]
        if not os.path.exists(build_path):
            print(f"❌ Build file not found at: {build_path}")
            return False
        
        print(f"✅ Build file exists at: {build_path}")
        
        return True
        
    except json.JSONDecodeError:
        print("❌ Config file is not valid JSON")
        return False
    except Exception as e:
        print(f"❌ Error reading config: {e}")
        return False

def test_mcp_server():
    """Test that the MCP server can start"""
    
    print("\n🚀 Testing MCP Server")
    print("=" * 30)
    
    build_path = "build/index.js"
    
    if not os.path.exists(build_path):
        print("❌ Build file not found. Run 'npm run build' first.")
        return False
    
    print("✅ Build file exists")
    
    # Test that node can run the server (briefly)
    try:
        # This will start the server but we'll kill it quickly
        process = subprocess.Popen(
            ["node", build_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait a moment for startup
        import time
        time.sleep(1)
        
        # Check if process is still running (good sign)
        if process.poll() is None:
            print("✅ MCP server started successfully")
            process.terminate()
            process.wait()
            return True
        else:
            stdout, stderr = process.communicate()
            print("❌ MCP server failed to start")
            print(f"   Error: {stderr}")
            return False
            
    except FileNotFoundError:
        print("❌ Node.js not found. Please install Node.js")
        return False
    except Exception as e:
        print(f"❌ Error testing server: {e}")
        return False

def main():
    """Main validation function"""
    
    print("🎯 Microsoft Fabric Analytics MCP Server")
    print("   Claude Desktop Configuration Validator")
    print("=" * 60)
    
    # Validate current directory
    if not os.path.exists("package.json"):
        print("❌ Please run this script from the project root directory")
        return
    
    print("✅ Running from correct directory")
    
    # Check if project is built
    if not os.path.exists("build/index.js"):
        print("⚠️ Project not built. Building now...")
        try:
            subprocess.run(["npm", "run", "build"], check=True)
            print("✅ Project built successfully")
        except subprocess.CalledProcessError:
            print("❌ Failed to build project")
            return
    else:
        print("✅ Project is built")
    
    # Validate Claude Desktop config
    config_valid = validate_claude_desktop_config()
    
    # Test MCP server
    server_valid = test_mcp_server()
    
    print("\n" + "=" * 60)
    print("📋 VALIDATION SUMMARY")
    print("=" * 60)
    
    if config_valid and server_valid:
        print("🎉 ALL CHECKS PASSED! Claude Desktop is ready to use.")
        print("\n🚀 Next Steps:")
        print("1. Restart Claude Desktop")
        print("2. Ask Claude: 'Show me all Spark applications in my workspace'")
        print("3. Provide your bearer token when prompted")
        print("4. Watch the magic happen! ✨")
        
        print("\n💡 Example queries to try:")
        print("• 'Show me all Spark applications in workspace c22f6805-d84a-4143-80b2-0c9e9832e5a2'")
        print("• 'What's the status of my notebook Spark jobs?'")
        print("• 'Generate a Spark monitoring dashboard'")
        print("• 'List applications for my lakehouse'")
        
    else:
        print("❌ VALIDATION FAILED!")
        print("\n🔧 Required Actions:")
        
        if not config_valid:
            print("1. Fix Claude Desktop configuration")
            print("   - Copy the config from claude_desktop_config.json")
            print("   - Place it in your Claude Desktop config directory")
        
        if not server_valid:
            print("2. Fix MCP server issues")
            print("   - Ensure Node.js is installed")
            print("   - Run 'npm run build' to build the project")
    
    print("\n📖 For detailed setup instructions, see:")
    print("   CLAUDE_DESKTOP_SETUP.md")

if __name__ == "__main__":
    main()
