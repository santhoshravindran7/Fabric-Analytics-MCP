#!/usr/bin/env python3
"""
Build script for creating the PyPI package with embedded Node.js server.

This script:
1. Builds the TypeScript/Node.js MCP server
2. Copies the built server into the Python package
3. Creates the distributable Python package
"""

import os
import sys
import shutil
import subprocess
import json
from pathlib import Path


def run_command(cmd, cwd=None, check=True):
    """Run a shell command and return the result."""
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            shell=isinstance(cmd, str),
            check=check,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        if e.stderr:
            print(f"Error output: {e.stderr}")
        if check:
            sys.exit(1)
        return e


def build_nodejs_server():
    """Build the Node.js MCP server."""
    print("🔨 Building Node.js MCP server...")
    
    # Get paths
    project_root = Path(__file__).parent.parent
    wrapper_root = Path(__file__).parent
    
    # Run npm install in the main project
    print("📦 Installing Node.js dependencies...")
    run_command(["npm", "install"], cwd=project_root)
    
    # Build the TypeScript project
    print("🏗️ Building TypeScript...")
    run_command(["npm", "run", "build"], cwd=project_root)
    
    # Verify build directory exists
    build_dir = project_root / "build"
    if not build_dir.exists():
        print("❌ Build directory not found!")
        sys.exit(1)
    
    # Copy built server to Python package
    server_dest = wrapper_root / "fabric_analytics_mcp" / "server"
    if server_dest.exists():
        shutil.rmtree(server_dest)
    
    print("📋 Copying server files to Python package...")
    server_dest.mkdir(parents=True)
    
    # Copy build directory
    shutil.copytree(build_dir, server_dest / "build")
    
    # Copy package.json (needed for metadata)
    shutil.copy(project_root / "package.json", server_dest / "package.json")
    
    # Copy node_modules (essential dependencies only)
    node_modules_src = project_root / "node_modules"
    if node_modules_src.exists():
        node_modules_dest = server_dest / "node_modules"
        print("📦 Copying essential Node.js modules...")
        
        # Copy only production dependencies
        with open(project_root / "package.json", 'r') as f:
            package_json = json.load(f)
        
        dependencies = package_json.get("dependencies", {})
        for dep_name in dependencies:
            dep_src = node_modules_src / dep_name
            if dep_src.exists():
                dep_dest = node_modules_dest / dep_name
                dep_dest.parent.mkdir(parents=True, exist_ok=True)
                if dep_src.is_dir():
                    shutil.copytree(dep_src, dep_dest, 
                                  ignore=shutil.ignore_patterns('*.md', '*.txt', 'test*', 'example*'))
                else:
                    shutil.copy2(dep_src, dep_dest)
    
    print("✅ Node.js server build complete!")


def build_python_package():
    """Build the Python package."""
    print("🐍 Building Python package...")
    
    wrapper_root = Path(__file__).parent
    
    # Clean previous builds
    for dir_name in ["build", "dist", "*.egg-info"]:
        for path in wrapper_root.glob(dir_name):
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    
    # Build source distribution
    print("📦 Creating source distribution...")
    run_command([sys.executable, "setup.py", "sdist"], cwd=wrapper_root)
    
    # Build wheel distribution
    print("🎡 Creating wheel distribution...")
    run_command([sys.executable, "setup.py", "bdist_wheel"], cwd=wrapper_root)
    
    print("✅ Python package build complete!")
    
    # Show built files
    dist_dir = wrapper_root / "dist"
    if dist_dir.exists():
        print("\n📦 Built packages:")
        for file in dist_dir.iterdir():
            print(f"  - {file.name}")


def validate_package():
    """Validate the built package."""
    print("🔍 Validating package...")
    
    wrapper_root = Path(__file__).parent
    
    # Check if server files exist
    server_dir = wrapper_root / "fabric_analytics_mcp" / "server"
    if not server_dir.exists():
        print("❌ Server directory not found!")
        return False
    
    index_js = server_dir / "build" / "index.js"
    if not index_js.exists():
        print("❌ Server index.js not found!")
        return False
    
    package_json = server_dir / "package.json"
    if not package_json.exists():
        print("❌ package.json not found!")
        return False
    
    print("✅ Package validation passed!")
    return True


def main():
    """Main build script."""
    print("🚀 Building Microsoft Fabric Analytics MCP Server PyPI Package")
    print("=" * 70)
    
    try:
        # Build Node.js server
        build_nodejs_server()
        
        # Validate
        if not validate_package():
            sys.exit(1)
        
        # Build Python package
        build_python_package()
        
        print("\n🎉 Build complete!")
        print("\n📋 Next steps:")
        print("  1. Test the package: pip install dist/*.whl")
        print("  2. Upload to PyPI: twine upload dist/*")
        
    except KeyboardInterrupt:
        print("\n❌ Build cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Build failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
