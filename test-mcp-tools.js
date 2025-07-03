// Simple test script to verify MCP tools are available
import { spawn } from 'child_process';

console.log('Testing MCP Server Tool List...\n');

// Set environment variables
process.env.FABRIC_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Il9qTndqZVNudlRUSzhYRWRyNVFVUGtCUkxMbyIsImtpZCI6Il9qTndqZVNudlRUSzhYRWRyNVFVUGtCUkxMbyJ9.eyJhdWQiOiJodHRwczovL2FuYWx5c2lzLndpbmRvd3MubmV0L3Bvd2VyYmkvYXBpIiwiaXNzIjoiaHR0cHM6Ly9zdHMud2luZG93cy5uZXQvNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3LyIsImlhdCI6MTc1MTQ5MjUwNywibmJmIjoxNzUxNDkyNTA3LCJleHAiOjE3NTE0OTY4NTgsImFjY3QiOjAsImFjciI6IjEiLCJhaW8iOiJBZVFBRy84WkFBQUFKd1VteG5uYkNsZXJiSVFqOUxJR0ZWem1QajJuSmRMc1RnZGVOSTRrazBKMUFiZklTRllwTnRtQ0RqTlB2WlBvMlE0Zm9ZRTBuZkk2Q3F4blFNdFl0MHorWmRLeCsxUWdHanlOcFdsMnQzSHhEM0FuMjR0ZjNuSHlpcnJmclNhUEduUDF2SGNGbUgrb3YweStIa2VPd3JKT0VsNk5veDZFakFwa2c0bldpdDFGSFZVUjJsRmw2c0hORDJQaUVreS9vMnBNMGpDUzNVZFJCNHIzVE1mbjEzeVk0NC9JVjJOeG9JTGZ2WDZZYzhTNFBtSVpQZEZKT1hKUFRTMmczaUxuVUN1MzFxTFNzSXM5UEVZYWhvTk5yd1BCWkI5WlhIMTJXdHZpWjBoMkRXOD0iLCJhbXIiOlsicnNhIiwibWZhIl0sImFwcGlkIjoiODcxYzAxMGYtNWU2MS00ZmIxLTgzYWMtOTg2MTBhN2U5MTEwIiwiYXBwaWRhY3IiOiIwIiwiY29udHJvbHMiOlsiYXBwX3JlcyJdLCJjb250cm9sc19hdWRzIjpbIjAwMDAwMDA5LTAwMDAtMDAwMC1jMDAwLTAwMDAwMDAwMDAwMCIsIjAwMDAwMDAzLTAwMDAtMGZmMS1jZTAwLTAwMDAwMDAwMDAwMCJdLCJkZXZpY2VpZCI6IjNlMTU4N2I5LTFkMzgtNGVlZi1hMzY1LWQ4ZTEwMDBjZjNhYiIsImZhbWlseV9uYW1lIjoiUmF2aW5kcmFuIiwiZ2l2ZW5fbmFtZSI6IlNhbnRob3NoIEt1bWFyIiwiaWR0eXAiOiJ1c2VyIiwiaXBhZGRyIjoiMTMxLjEwNy44Ljk2IiwibmFtZSI6IlNhbnRob3NoIEt1bWFyIFJhdmluZHJhbiIsIm9pZCI6IjY2NGQ0OTQ3LTgxZTYtNDgzZS04YWY0LWNkZjVlNzcyMmNlZiIsIm9ucHJlbV9zaWQiOiJTLTEtNS0yMS0yMTI3NTIxMTg0LTE2MDQwMTI5MjAtMTg4NzkyNzUyNy0zMjI4Mzc0MSIsInB1aWQiOiIxMDAzMDAwMEFCQjgwRjg2IiwicmgiOiIxLkFSb0F2NGo1Y3ZHR3IwR1JxeTE4MEJIYlJ3a0FBQUFBQUFBQXdBQUFBQUFBQUFBYUFKWWFBQS4iLCJzY3AiOiJ1c2VyX2ltcGVyc29uYXRpb24iLCJzaWQiOiIxZWNiM2M2ZC02NTZiLTQyNDAtYmI5My01YWY4ODM0ZDZhYTIiLCJzaWduaW5fc3RhdGUiOlsiZHZjX21uZ2QiLCJkdmNfY21wIiwia21zaSJdLCJzdWIiOiJ0T254V0lnUy1jRm9MLXotNFZOTnVoYjFHbkYtWXBDUWFSU0tHWG9lQU5FIiwidGlkIjoiNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3IiwidW5pcXVlX25hbWUiOiJzYXJhdmlAbWljcm9zb2Z0LmNvbSIsInVwbiI6InNhcmF2aUBtaWNyb3NvZnQuY29tIiwidXRpIjoicGN4ZWhQWXotVXVWbFF0Ymx1YlFBQSIsInZlciI6IjEuMCIsIndpZHMiOlsiYjc5ZmJmNGQtM2VmOS00Njg5LTgxNDMtNzZiMTk0ZTg1NTA5Il0sInhtc19jYyI6WyJDUDEiXSwieG1zX2Z0ZCI6ImZsc3phU1JHN3RCWHdZSTVRSWVJdV9PTWVSeEs5MUVTbkEzX3doRnNYdU1CZFhOemIzVjBhQzFrYzIxeiIsInhtc19pZHJlbCI6IjE4IDEifQ.kUycDFD_ef6yiNzdIgnUeKeIq2aJ41RPnzaxsMMMsRT97UtCT5ddld0oDXS_GN9xcrT6-wfaqyAYhXH_tP2FL9O7Zwwv0tBnXURMqDfIcPIUXzRFLh_Ne3YUjxIZTc2DST_cz6vr1R1JyJsNiaisdANstmLV-Kdo8BYbYqKwiarg_CXJyoBs0C5_NNWarSuuLbDSrI26awm2P4W5gt4J0LzUJPq_IAcpXtW6GSkduOF7UjtBJWYLuv0hNZ3IsIkNJybYfYETtzFYLdaYlZdPwLkVvws4pTGQq7D8IUiXJvTnO3IUVEZKn-f_MPTYG1g_uNztai_8LXcIQj8CPyczLA";
process.env.FABRIC_WORKSPACE_ID = "c22f6805-d84a-4143-80b2-0c9e9832e5a2";
process.env.ENABLE_HEALTH_SERVER = "false";

// Spawn the MCP server
const mcpServer = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env
});

let serverReady = false;

// Send a tools/list request
function sendToolsListRequest() {
  if (!serverReady) return;
  
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list"
  };
  
  console.log('Sending tools/list request...\n');
  mcpServer.stdin.write(JSON.stringify(request) + '\n');
}

// Handle server output
mcpServer.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const message = JSON.parse(line);
      
      if (message.method === 'notifications/initialized') {
        console.log('✅ Server initialized!');
        serverReady = true;
        setTimeout(sendToolsListRequest, 100);
      } else if (message.id === 1 && message.result && message.result.tools) {
        console.log(`✅ Found ${message.result.tools.length} tools:\n`);
        
        // List all tools
        message.result.tools.forEach((tool, index) => {
          console.log(`${index + 1}. ${tool.name}`);
          console.log(`   Description: ${tool.description}`);
          console.log('');
        });
        
        // Check for notebook management tools
        const notebookTools = message.result.tools.filter(tool => 
          tool.name.includes('notebook') && 
          ['create-fabric-notebook', 'get-fabric-notebook-definition', 'update-fabric-notebook-definition', 'run-fabric-notebook'].includes(tool.name)
        );
        
        console.log(`\n🎯 Notebook Management Tools Found: ${notebookTools.length}/4`);
        notebookTools.forEach(tool => {
          console.log(`   ✅ ${tool.name}`);
        });
        
        process.exit(0);
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  }
});

// Start the test
console.log('Starting MCP server test...\n');

// Send initialize request first
setTimeout(() => {
  const initRequest = {
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };
  
  mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  process.exit(1);
}, 10000);
