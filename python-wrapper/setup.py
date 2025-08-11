#!/usr/bin/env python3
"""
Simplified setup script for Microsoft Fabric Analytics MCP Server Python Package

This creates a Python wrapper that installs and manages the npm package.
"""

from setuptools import setup, find_packages
import json
from pathlib import Path


def get_version():
    """Extract version from package.json"""
    package_json_path = Path(__file__).parent.parent / "package.json"
    if package_json_path.exists():
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
            return package_data.get("version", "1.0.0")
    return "1.0.0"


def get_long_description():
    """Get long description from README.md"""
    readme_path = Path(__file__).parent / "README.md"
    if readme_path.exists():
        with open(readme_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "Microsoft Fabric Analytics MCP Server"

setup(
    name="fabric-analytics-mcp",
    version=get_version(),
    author="Santhosh Ravindran",
    author_email="santhoshravindran7@gmail.com",
    description="Microsoft Fabric Analytics MCP Server - Enable AI assistants to access and analyze Microsoft Fabric data",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    url="https://github.com/santhoshravindran7/Fabric-Analytics-MCP",
    project_urls={
        "Bug Tracker": "https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues",
        "Documentation": "https://github.com/santhoshravindran7/Fabric-Analytics-MCP#readme",
        "Source Code": "https://github.com/santhoshravindran7/Fabric-Analytics-MCP",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Database :: Database Engines/Servers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Environment :: Console",
    ],
    keywords=[
        "mcp", "model-context-protocol", "microsoft-fabric", "analytics", 
        "data-analysis", "llm", "ai", "claude", "copilot", "spark", "livy",
        "authentication", "azure", "powerbi", "data-science"
    ],
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0.0",
        "requests>=2.25.0",
        "packaging>=20.0",
        "setuptools>=40.0",
    ],
    extras_require={
        "dev": [
            "pytest>=6.0",
            "pytest-cov>=2.0",
            "black>=21.0",
            "flake8>=3.8",
            "mypy>=0.800",
        ],
        "async": [
            "aiohttp>=3.8.0",
            "asyncio>=3.4.3",
        ]
    },
    entry_points={
        "console_scripts": [
            "fabric-analytics-mcp=fabric_analytics_mcp.cli:main",
            "fabric-mcp=fabric_analytics_mcp.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "fabric_analytics_mcp": [
            "server/*",
            "server/build/*",
            "server/node_modules/**/*",
            "*.md",
            "*.json",
        ],
    },
    zip_safe=False,
    # Post-install hook to ensure Node.js dependencies
    cmdclass={},
)
