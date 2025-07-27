// Quick test to count available tools in the MCP server
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing MCP server tool count...');

// This will test the MCP server by sending a list_tools request
const testCommand = `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node build/index.js`;

exec(testCommand, { cwd: __dirname, env: { ...process.env, ENABLE_HEALTH_SERVER: 'false' } }, (error, stdout, stderr) => {
  if (error) {
    console.error('Error testing MCP server:', error);
    return;
  }

  try {
    // Parse the MCP response
    const lines = stdout.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.result && response.result.tools) {
          console.log(`\n✅ MCP Server successfully upgraded!`);
          console.log(`📊 Total tools available: ${response.result.tools.length}`);
          console.log(`\n📋 Tool categories:`);
          
          const categories = {};
          response.result.tools.forEach(tool => {
            const category = tool.name.split('-')[0];
            categories[category] = (categories[category] || 0) + 1;
          });
          
          Object.entries(categories).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} tools`);
          });
          
          console.log(`\n🎯 Sample tools:`);
          response.result.tools.slice(0, 10).forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description.substring(0, 60)}...`);
          });
          return;
        }
      } catch (parseError) {
        // Skip non-JSON lines
      }
    }
    console.log('No valid MCP response found in output');
  } catch (finalError) {
    console.error('Error parsing MCP response:', finalError);
    console.log('Raw output:', stdout);
  }
});
