#!/usr/bin/env python3
"""
CLI interface for Microsoft Fabric Analytics MCP Server

This module provides command-line interface to install and start
the Microsoft Fabric Analytics MCP Server via npm.
"""

import click
import os
import sys
import json
import subprocess
import shutil
from pathlib import Path
from typing import Optional


def find_npm_executable() -> Optional[str]:
    """Find npm executable on the system."""
    npm_paths = ["npm", "npm.cmd"]
    for npm_cmd in npm_paths:
        if shutil.which(npm_cmd):
            return npm_cmd
    return None


def find_npx_executable() -> Optional[str]:
    """Find npx executable on the system."""
    npx_paths = ["npx", "npx.cmd"]
    for npx_cmd in npx_paths:
        if shutil.which(npx_cmd):
            return npx_cmd
    return None


def ensure_npm_package_installed() -> bool:
    """Ensure the npm package is installed globally."""
    npm_cmd = find_npm_executable()
    if not npm_cmd:
        return False
    
    try:
        # Check if package is already installed globally
        result = subprocess.run(
            [npm_cmd, "list", "-g", "mcp-for-microsoft-fabric-analytics"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return True
        
        # Install the package globally
        click.echo("📦 Installing Microsoft Fabric Analytics MCP Server via npm...")
        result = subprocess.run(
            [npm_cmd, "install", "-g", "mcp-for-microsoft-fabric-analytics"],
            check=True
        )
        return result.returncode == 0
        
    except subprocess.CalledProcessError:
        return False


@click.group()
@click.version_option()
def cli():
    """Microsoft Fabric Analytics MCP Server"""
    pass


@cli.command()
@click.option('--auth-method', 
              type=click.Choice(['bearer_token', 'service_principal', 'interactive']),
              default='bearer_token',
              help='Authentication method to use')
@click.option('--workspace-id', help='Default workspace ID')
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose logging')
def start(auth_method: str, workspace_id: Optional[str], verbose: bool):
    """Start the Microsoft Fabric Analytics MCP Server."""
    
    # Check npm installation
    npm_cmd = find_npm_executable()
    npx_cmd = find_npx_executable()
    
    if not npm_cmd or not npx_cmd:
        click.echo("❌ Error: npm/npx not found.", err=True)
        click.echo("📋 Please install Node.js from: https://nodejs.org/", err=True)
        sys.exit(1)
    
    # Ensure package is installed
    if not ensure_npm_package_installed():
        click.echo("❌ Error: Failed to install npm package.", err=True)
        click.echo("📋 Please run: npm install -g mcp-for-microsoft-fabric-analytics", err=True)
        sys.exit(1)
    
    # Set environment variables
    env = os.environ.copy()
    if auth_method:
        env['FABRIC_AUTH_METHOD'] = auth_method
    if workspace_id:
        env['FABRIC_DEFAULT_WORKSPACE_ID'] = workspace_id
    if verbose:
        env['DEBUG'] = 'true'
    
    click.echo("🚀 Starting Microsoft Fabric Analytics MCP Server...")
    click.echo(f"🔐 Auth: {auth_method}")
    if workspace_id:
        click.echo(f"🏢 Workspace: {workspace_id}")
    
    try:
        # Start the MCP server using npx
        subprocess.run([npx_cmd, "fabric-analytics"], env=env, check=True)
    except KeyboardInterrupt:
        click.echo("\n👋 Shutting down server...")
    except subprocess.CalledProcessError as e:
        click.echo(f"❌ Server error: {e}", err=True)
        sys.exit(1)


@cli.command()
def install():
    """Install the Microsoft Fabric Analytics MCP Server npm package."""
    npm_cmd = find_npm_executable()
    if not npm_cmd:
        click.echo("❌ Error: npm not found.", err=True)
        click.echo("📋 Please install Node.js from: https://nodejs.org/", err=True)
        sys.exit(1)
    
    click.echo("📦 Installing Microsoft Fabric Analytics MCP Server...")
    try:
        subprocess.run(
            [npm_cmd, "install", "-g", "mcp-for-microsoft-fabric-analytics"],
            check=True
        )
        click.echo("✅ Installation complete!")
    except subprocess.CalledProcessError as e:
        click.echo(f"❌ Installation failed: {e}", err=True)
        sys.exit(1)


@cli.command()
def validate():
    """Validate the installation and configuration."""
    click.echo("� Validating Microsoft Fabric Analytics MCP Server...")
    
    # Check npm/npx
    npm_cmd = find_npm_executable()
    npx_cmd = find_npx_executable()
    
    if npm_cmd and npx_cmd:
        click.echo("✅ npm/npx found")
    else:
        click.echo("❌ npm/npx not found")
        return False
    
    # Check if package is installed
    try:
        result = subprocess.run(
            [npm_cmd, "list", "-g", "mcp-for-microsoft-fabric-analytics"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            click.echo("✅ MCP Server package installed")
        else:
            click.echo("❌ MCP Server package not installed")
            click.echo("📋 Run: fabric-analytics-mcp install")
            return False
    except Exception:
        click.echo("❌ Package validation failed")
        return False
    
    click.echo("🎉 Installation validation complete!")
    return True


@cli.command()
def config():
    """Show configuration information and examples."""
    click.echo("📋 Microsoft Fabric Analytics MCP Server Configuration")
    click.echo("=" * 60)
    
    click.echo("\n🔐 Environment Variables:")
    click.echo("  FABRIC_AUTH_METHOD=bearer_token|service_principal|interactive")
    click.echo("  FABRIC_CLIENT_ID=<your-client-id>")
    click.echo("  FABRIC_CLIENT_SECRET=<your-client-secret>")
    click.echo("  FABRIC_TENANT_ID=<your-tenant-id>")
    click.echo("  FABRIC_DEFAULT_WORKSPACE_ID=<workspace-id>")
    
    click.echo("\n� Example Claude Desktop Configuration:")
    config_example = {
        "mcpServers": {
            "fabric-analytics": {
                "command": "fabric-analytics-mcp",
                "args": ["start"],
                "env": {
                    "FABRIC_AUTH_METHOD": "bearer_token"
                }
            }
        }
    }
    click.echo(json.dumps(config_example, indent=2))
    
    click.echo("\n🚀 Quick Start:")
    click.echo("  1. pip install fabric-analytics-mcp")
    click.echo("  2. fabric-analytics-mcp install")
    click.echo("  3. Set environment variables")
    click.echo("  4. fabric-analytics-mcp start")
    click.echo("  5. Configure your MCP client (Claude, Copilot, etc.)")


def main():
    """Main entry point for the CLI."""
    cli()


if __name__ == "__main__":
    main()


@cli.command()
def validate():
    """Validate the installation and configuration."""
    click.echo("🔍 Validating Microsoft Fabric Analytics MCP Server...")
    
    # Check Node.js
    node_cmd = find_node_executable()
    if node_cmd:
        click.echo("✅ Node.js found")
        if validate_node_version():
            click.echo("✅ Node.js version is compatible")
        else:
            click.echo("❌ Node.js version 18+ required")
            return False
    else:
        click.echo("❌ Node.js not found")
        return False
    
    # Check server files
    server_path = get_server_path()
    if server_path.exists():
        click.echo("✅ MCP server files found")
    else:
        click.echo(f"❌ MCP server not found at {server_path}")
        return False
    
    # Test server startup
    try:
        result = subprocess.run(
            [node_cmd, str(server_path), "--validate"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            click.echo("✅ Server validation passed")
        else:
            click.echo("❌ Server validation failed")
            return False
    except subprocess.TimeoutExpired:
        click.echo("⚠️  Server validation timeout (this might be normal)")
    except Exception as e:
        click.echo(f"❌ Server validation error: {e}")
        return False
    
    click.echo("🎉 Installation validation complete!")
    return True


@cli.command()
def config():
    """Show configuration information and examples."""
    click.echo("📋 Microsoft Fabric Analytics MCP Server Configuration")
    click.echo("=" * 60)
    
    click.echo("\n🔐 Environment Variables:")
    click.echo("  FABRIC_AUTH_METHOD=bearer_token|service_principal|interactive")
    click.echo("  FABRIC_CLIENT_ID=<your-client-id>")
    click.echo("  FABRIC_CLIENT_SECRET=<your-client-secret>")
    click.echo("  FABRIC_TENANT_ID=<your-tenant-id>")
    click.echo("  FABRIC_DEFAULT_WORKSPACE_ID=<workspace-id>")
    
    click.echo("\n📝 Example Claude Desktop Configuration:")
    config_example = {
        "mcpServers": {
            "fabric-analytics": {
                "command": "fabric-analytics-mcp",
                "args": ["start"],
                "env": {
                    "FABRIC_AUTH_METHOD": "bearer_token"
                }
            }
        }
    }
    click.echo(json.dumps(config_example, indent=2))
    
    click.echo("\n🚀 Quick Start:")
    click.echo("  1. pip install fabric-analytics-mcp")
    click.echo("  2. Set environment variables")
    click.echo("  3. fabric-analytics-mcp start")
    click.echo("  4. Configure your MCP client (Claude, Copilot, etc.)")


def main():
    """Main entry point for the CLI."""
    cli()


if __name__ == "__main__":
    main()
