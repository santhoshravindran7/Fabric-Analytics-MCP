"""
Server manager for Microsoft Fabric Analytics MCP Server

This module manages the Node.js MCP server process from Python.
"""

import subprocess
import os
import signal
import threading
import time
from pathlib import Path
from typing import Optional, Dict, Any


class FabricMCPServer:
    """Manages the Microsoft Fabric Analytics MCP Server process."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the server manager.
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.process: Optional[subprocess.Popen] = None
        self.is_running = False
        self._monitor_thread: Optional[threading.Thread] = None
        
    def start(self, stdio: bool = True, timeout: int = 30) -> bool:
        """Start the MCP server.
        
        Args:
            stdio: Whether to use stdio transport (default for MCP)
            timeout: Timeout in seconds to wait for server start
            
        Returns:
            True if server started successfully, False otherwise
        """
        if self.is_running:
            return True
            
        # Find Node.js executable
        node_cmd = self._find_node()
        if not node_cmd:
            raise RuntimeError("Node.js not found. Please install Node.js 18+")
            
        # Get server path
        server_path = self._get_server_path()
        if not server_path.exists():
            raise RuntimeError(f"MCP server not found at {server_path}")
            
        # Prepare environment
        env = os.environ.copy()
        for key, value in self.config.items():
            env[key.upper()] = str(value)
            
        try:
            # Start the server process
            if stdio:
                # Standard MCP stdio transport
                self.process = subprocess.Popen(
                    [node_cmd, str(server_path)],
                    env=env,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=0
                )
            else:
                # HTTP transport (for testing/debugging)
                env['MCP_TRANSPORT'] = 'http'
                env['MCP_PORT'] = str(self.config.get('port', 3000))
                self.process = subprocess.Popen(
                    [node_cmd, str(server_path)],
                    env=env
                )
                
            # Wait a moment for startup
            time.sleep(2)
            
            # Check if process is still running
            if self.process.poll() is None:
                self.is_running = True
                self._start_monitor()
                return True
            else:
                self.process = None
                return False
                
        except Exception as e:
            raise RuntimeError(f"Failed to start MCP server: {e}")
            
    def stop(self, timeout: int = 10) -> bool:
        """Stop the MCP server.
        
        Args:
            timeout: Timeout in seconds to wait for graceful shutdown
            
        Returns:
            True if server stopped successfully, False otherwise
        """
        if not self.is_running or not self.process:
            return True
            
        try:
            # Try graceful shutdown first
            self.process.terminate()
            
            # Wait for graceful shutdown
            try:
                self.process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                # Force kill if necessary
                self.process.kill()
                self.process.wait()
                
            self.process = None
            self.is_running = False
            
            # Stop monitor thread
            if self._monitor_thread and self._monitor_thread.is_alive():
                self._monitor_thread.join(timeout=5)
                
            return True
            
        except Exception:
            return False
            
    def send_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Send a JSON-RPC request to the server.
        
        Args:
            request: JSON-RPC request dictionary
            
        Returns:
            Response dictionary or None if failed
        """
        if not self.is_running or not self.process:
            return None
            
        try:
            import json
            
            # Send request
            request_json = json.dumps(request) + '\n'
            self.process.stdin.write(request_json)
            self.process.stdin.flush()
            
            # Read response
            response_line = self.process.stdout.readline()
            if response_line:
                return json.loads(response_line.strip())
                
        except Exception:
            pass
            
        return None
        
    def list_tools(self) -> Optional[Dict[str, Any]]:
        """Get list of available tools from the server.
        
        Returns:
            Tools list response or None if failed
        """
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }
        return self.send_request(request)
        
    def _find_node(self) -> Optional[str]:
        """Find Node.js executable."""
        import shutil
        for cmd in ["node", "nodejs"]:
            if shutil.which(cmd):
                return cmd
        return None
        
    def _get_server_path(self) -> Path:
        """Get path to the MCP server."""
        package_dir = Path(__file__).parent
        return package_dir / "server" / "build" / "index.js"
        
    def _start_monitor(self):
        """Start background thread to monitor server process."""
        if self._monitor_thread and self._monitor_thread.is_alive():
            return
            
        self._monitor_thread = threading.Thread(
            target=self._monitor_process,
            daemon=True
        )
        self._monitor_thread.start()
        
    def _monitor_process(self):
        """Monitor the server process in background."""
        while self.is_running and self.process:
            if self.process.poll() is not None:
                # Process has ended
                self.is_running = False
                break
            time.sleep(1)
            
    def __enter__(self):
        """Context manager entry."""
        self.start()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.stop()
        
    def __del__(self):
        """Cleanup on deletion."""
        if self.is_running:
            self.stop()
