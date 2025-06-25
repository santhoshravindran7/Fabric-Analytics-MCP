#!/usr/bin/env python3
"""
Project Cleanup Script for Microsoft Fabric Analytics MCP Server
Organizes files for public release and removes development artifacts
"""

import os
import shutil
from pathlib import Path

def cleanup_project():
    """Clean up the project for public release"""
    
    print("🧹 Cleaning up Microsoft Fabric Analytics MCP Server for public release...")
    
    # Files to keep (core project files)
    keep_files = {
        # Core server files
        'src', 'build', 'node_modules', 'package.json', 'package-lock.json', 'tsconfig.json',
        
        # Documentation
        'README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'FINAL_RELEASE_CHECKLIST.md',
        'EXAMPLES.md', 'CLAUDE_DESKTOP_SETUP.md',
        
        # Configuration
        '.gitignore', '.github', '.vscode',
        
        # Authentication and testing
        'auth_client.py', 'enhanced_auth_test.py', 'comprehensive_auth_validation.py',
        'spark_monitoring_test.py', 'mcp_spark_monitoring_demo.py',
        'validate_claude_setup.py', 'requirements.txt',
        
        # Templates and examples
        'config.template.json', 'claude_desktop_config.json',
        
        # Key notebooks
        'livy_api_test.ipynb',
        
        # Essential test scripts (main ones)
        'quick_workspace_commands.py',
    }
    
    # Files/directories to potentially archive or remove
    development_files = [
        # Multiple versions of similar scripts
        'get_workspace_details.py', 'get_workspace_details_debug.py', 
        'get_workspace_details_final.py', 'get_workspace_details_fixed.py',
        'quick_test.py', 'quick_test_fixed.py',
        'quick_workspace_commands_fixed.py',
        'simple_livy_test.py', 'simple_livy_test_fixed.py', 'simple_livy_fixed.py',
        
        # Debug and temporary files
        'debug_spark_test.py', 'working_spark_test.py', 'windows_test.py',
        'real_fabric_test.py',
        
        # Summary files (development artifacts)
        'API_SUMMARY.md', 'FIX_SUMMARY.md', 'REFACTORING_SUMMARY.md',
        'SPARK_MONITORING_SUMMARY.md', 'GIT_SETUP.md',
        
        # Multiple guide files (keep key ones)
        'SPARK_JOB_DEFINITION_GUIDE.md', 'SPARK_TESTING_GUIDE.md',
        'TESTING_GUIDE.md', 'WORKSPACE_DETAILS_GUIDE.md',
        
        # Multiple test scripts for same functionality
        'comprehensive_livy_test.py', 'quick_livy_test.py', 'quick_livy_session_test.py',
        'test_livy_api.py', 'livy_batch_test.py', 'livy_setup.py',
        
        # Multiple notebook files
        'local_testing_notebook.ipynb', 'practical_testing_notebook.ipynb',
        'real_world_testing_notebook.ipynb', 'test_fabric_mcp_server.ipynb',
        
        # Test scripts in root (keep main ones in tests/ folder)
        'test_mcp_api.py', 'test_mcp_spark_job_def.py', 'test_notebook_operations.py',
        'test_server.py', 'test_spark_jobs.py', 'test_spark_job_definition.py',
        
        # Other development artifacts
        'quick_spark_job_def_test.py', 'quick_spark_test.py',
        'setup_config.py', 'livy_requirements.txt', 'run_livy_test.bat',
        
        # Python cache
        '__pycache__',
        
        # Git folder (will be reinitialized for public repo)
        '.git'
    ]
    
    # Create a development-files archive directory
    archive_dir = Path("development-archive")
    if not archive_dir.exists():
        archive_dir.mkdir()
        print(f"📁 Created archive directory: {archive_dir}")
    
    archived_count = 0
    
    # Move development files to archive
    for file_path in development_files:
        path = Path(file_path)
        if path.exists():
            try:
                if path.is_file():
                    shutil.move(str(path), str(archive_dir / path.name))
                    print(f"📦 Archived: {file_path}")
                    archived_count += 1
                elif path.is_dir():
                    shutil.move(str(path), str(archive_dir / path.name))
                    print(f"📦 Archived directory: {file_path}")
                    archived_count += 1
            except Exception as e:
                print(f"⚠️  Could not archive {file_path}: {e}")
    
    print(f"\n✅ Cleanup completed!")
    print(f"📦 Archived {archived_count} development files/directories")
    print(f"📁 Archive location: {archive_dir}")
    
    # List remaining files
    remaining_files = []
    for item in Path(".").iterdir():
        if item.name != "development-archive":
            remaining_files.append(item.name)
    
    print(f"\n📋 Remaining files for public release ({len(remaining_files)} items):")
    for file in sorted(remaining_files):
        print(f"   ✅ {file}")
    
    print(f"\n🎉 Project is ready for public release!")
    print(f"💡 Next steps:")
    print(f"   1. Review the remaining files")
    print(f"   2. Initialize new git repository: git init")
    print(f"   3. Add files: git add .")
    print(f"   4. Create initial commit: git commit -m 'Initial release'")
    print(f"   5. Push to public GitHub repository")

if __name__ == "__main__":
    cleanup_project()
