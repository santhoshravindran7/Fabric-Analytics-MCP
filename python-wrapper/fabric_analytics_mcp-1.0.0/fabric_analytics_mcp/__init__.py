"""
Microsoft Fabric Analytics MCP Server Python Package

This package provides a Python wrapper around the Node.js-based Microsoft Fabric Analytics
MCP Server, enabling easy installation and use with any MCP-compatible client like Claude,
GitHub Copilot, or other AI assistants.

Features:
- 41+ Microsoft Fabric analytics tools
- Workspace management and discovery
- Spark job monitoring and analysis
- Notebook execution and management
- Livy session management
- Comprehensive authentication support
- Easy PyPI installation: pip install fabric-analytics-mcp
"""

from .cli import main
from .server_manager import FabricMCPServer

__version__ = "1.0.0"
__author__ = "Microsoft Fabric Analytics Community"

__all__ = ["main", "FabricMCPServer"]
