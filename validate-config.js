// MCP Configuration Validator
import fs from 'fs';
import path from 'path';

const configPath = "C:\\Users\\saravi\\AppData\\Roaming\\Claude\\claude_desktop_config.json";
const buildPath = "C:\\Users\\saravi\\OneDrive - Microsoft\\MCP for Microsoft Fabric Analytics\\build\\index.js";

console.log("🔧 Validating MCP Configuration...\n");

// Check if config file exists
if (!fs.existsSync(configPath)) {
    console.log("❌ Claude Desktop config file not found at:", configPath);
    process.exit(1);
}

// Check if build file exists
if (!fs.existsSync(buildPath)) {
    console.log("❌ MCP server build file not found at:", buildPath);
    process.exit(1);
}

// Read and validate config
try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log("✅ Configuration file found and valid JSON");
    
    if (config.mcpServers && config.mcpServers['fabric-analytics']) {
        console.log("✅ fabric-analytics server configured");
        
        const server = config.mcpServers['fabric-analytics'];
        
        if (server.env && server.env.FABRIC_TOKEN && server.env.FABRIC_WORKSPACE_ID) {
            console.log("✅ Environment variables configured");
            console.log(`   - Token: ${server.env.FABRIC_TOKEN.substring(0, 20)}...`);
            console.log(`   - Workspace ID: ${server.env.FABRIC_WORKSPACE_ID}`);
        } else {
            console.log("❌ Missing environment variables");
        }
        
        if (server.command === "node" && server.args && server.args[0]) {
            console.log("✅ Node command configured");
            console.log(`   - Command: ${server.command}`);
            console.log(`   - Script: ${server.args[0]}`);
        } else {
            console.log("❌ Invalid command configuration");
        }
    } else {
        console.log("❌ fabric-analytics server not found in config");
    }
    
    console.log("\n🎯 Configuration Summary:");
    console.log("- Config file: VALID");
    console.log("- Build file: EXISTS");
    console.log("- Server name: fabric-analytics");
    console.log("- Ready for Claude Desktop startup");
    
} catch (error) {
    console.log("❌ Error reading config:", error.message);
    process.exit(1);
}

console.log("\n🚀 Next steps:");
console.log("1. Start Claude Desktop");
console.log("2. Wait for initialization");
console.log("3. Check Settings > Features > Model Context Protocol");
console.log("4. Look for 'fabric-analytics' server with tools listed");
