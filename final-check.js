#!/usr/bin/env node

/**
 * Final Status Check - Ready to Push Assessment
 * Quick status check to confirm everything is ready for Git push
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 Final Pre-Push Status Check');
console.log('==============================\n');

const checks = [
    {
        name: 'TypeScript Build',
        check: () => fs.existsSync('build/index.js'),
        fix: 'Run: npm run build'
    },
    {
        name: 'Core Source Files',
        check: () => fs.existsSync('src/index.ts') && fs.existsSync('src/fabric-client.ts'),
        fix: 'Ensure src files exist'
    },
    {
        name: 'Package Configuration',
        check: () => {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return pkg.dependencies && pkg.dependencies['@modelcontextprotocol/sdk'];
        },
        fix: 'Check package.json dependencies'
    },
    {
        name: 'Notebook Management Features',
        check: () => {
            const indexContent = fs.readFileSync('src/index.ts', 'utf8');
            return indexContent.includes('create-fabric-notebook') && 
                   indexContent.includes('get-fabric-notebook-definition') &&
                   indexContent.includes('update-fabric-notebook-definition') &&
                   indexContent.includes('run-fabric-notebook');
        },
        fix: 'Ensure all notebook management tools are implemented'
    },
    {
        name: 'API Client Methods',
        check: () => {
            const clientContent = fs.readFileSync('src/fabric-client.ts', 'utf8');
            return clientContent.includes('createNotebook') && 
                   clientContent.includes('getItemDefinition') &&
                   clientContent.includes('updateItemDefinition') &&
                   clientContent.includes('runNotebook');
        },
        fix: 'Ensure all API client methods are implemented'
    },
    {
        name: 'Documentation',
        check: () => fs.existsSync('README.md') && fs.existsSync('NOTEBOOK_MANAGEMENT_GUIDE.md'),
        fix: 'Ensure documentation files exist'
    }
];

let allPassed = true;

checks.forEach((check, index) => {
    try {
        if (check.check()) {
            console.log(`✅ ${check.name}`);
        } else {
            console.log(`❌ ${check.name} - ${check.fix}`);
            allPassed = false;
        }
    } catch (error) {
        console.log(`❌ ${check.name} - Error: ${error.message}`);
        allPassed = false;
    }
});

console.log('\n' + '='.repeat(40));

if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED!');
    console.log('\n✅ Ready to push to Git');
    console.log('\nCommands to run:');
    console.log('  git add .');
    console.log('  git commit -m "Add comprehensive notebook management features with templates and API integration"');
    console.log('  git push origin master');
    
    // Show what will be committed
    try {
        console.log('\n📝 Files to be committed:');
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
            console.log(gitStatus);
        } else {
            console.log('No changes detected');
        }
    } catch (error) {
        console.log('Git status check failed');
    }

} else {
    console.log('❌ Some checks failed - please fix before pushing');
}

console.log('\n🏁 Status check complete!');
