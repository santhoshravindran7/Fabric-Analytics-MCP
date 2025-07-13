import { spawn } from 'child_process';

console.log('🧪 Testing MCP Server startup...');

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

// Send MCP initialization message
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
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

console.log('📤 Sending initialization message...');
server.stdin.write(JSON.stringify(initMessage) + '\n');

let response = '';
server.stdout.on('data', (data) => {
  response += data.toString();
  console.log('📥 Server response:', response);
  
  try {
    const parsed = JSON.parse(response);
    if (parsed.id === 1) {
      console.log('✅ MCP Server initialized successfully!');
      console.log('🎯 Server capabilities:', JSON.stringify(parsed.result, null, 2));
      server.kill();
      process.exit(0);
    }
  } catch (e) {
    // Response might be incomplete, wait for more data
  }
});

server.stderr.on('data', (data) => {
  console.log('⚠️  Server stderr:', data.toString());
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - server might be waiting for input');
  server.kill();
  process.exit(1);
}, 10000);

console.log('⏳ Waiting for server response...');
