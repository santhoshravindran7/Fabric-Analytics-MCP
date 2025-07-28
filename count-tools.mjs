#!/usr/bin/env node

// Count tools in the MCP server
import { readFileSync } from 'fs';

try {
  const indexContent = readFileSync('src/index.ts', 'utf-8');
  
  // Count server.tool( occurrences
  const toolMatches = indexContent.match(/server\.tool\(/g) || [];
  const toolCount = toolMatches.length;
  
  console.log('🔧 Tool Count Analysis');
  console.log('====================');
  console.log(`📊 Total tools found: ${toolCount}`);
  
  // Extract tool names
  const toolNameRegex = /server\.tool\(\s*["']([^"']+)["']/g;
  const toolNames = [];
  let match;
  
  while ((match = toolNameRegex.exec(indexContent)) !== null) {
    toolNames.push(match[1]);
  }
  
  console.log('\n📋 Tool categories:');
  const categories = {};
  toolNames.forEach(name => {
    const category = name.split('-')[0];
    categories[category] = (categories[category] || 0) + 1;
  });
  
  Object.entries(categories).sort().forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} tools`);
  });
  
  console.log('\n🎯 New Spark monitoring tools added:');
  const sparkTools = toolNames.filter(name => 
    name.includes('spark') || 
    name.includes('mcp_fabric-analyt2')
  );
  
  sparkTools.forEach(tool => {
    console.log(`   - ${tool}`);
  });
  
  console.log(`\n✅ Successfully added ${sparkTools.length} Spark monitoring tools!`);
  console.log(`🎉 Total comprehensive tools: ${toolCount}`);
  
} catch (error) {
  console.error('❌ Error analyzing tools:', error.message);
}
