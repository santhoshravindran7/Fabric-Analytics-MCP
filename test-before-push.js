#!/usr/bin/env node

/**
 * Comprehensive Pre-Push Testing Script (Node.js version)
 * Cross-platform testing script to run before pushing to Git
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.results = [];
    }

    logError(message) {
        this.errors.push(message);
        console.log(`❌ ERROR: ${message}`);
    }

    logWarning(message) {
        this.warnings.push(message);
        console.log(`⚠️  WARNING: ${message}`);
    }

    logSuccess(message) {
        this.results.push(message);
        console.log(`✅ ${message}`);
    }

    logInfo(message) {
        console.log(`ℹ️  ${message}`);
    }

    runCommand(command, options = {}) {
        try {
            const result = execSync(command, { 
                encoding: 'utf8', 
                stdio: options.silent ? 'pipe' : 'inherit',
                ...options 
            });
            return { success: true, output: result };
        } catch (error) {
            return { success: false, error: error.message, code: error.status };
        }
    }

    async runTests() {
        console.log('🚀 Starting comprehensive pre-push testing...');
        console.log('===============================================');

        // Step 1: Environment Check
        console.log('\n📋 Step 1: Environment Check');
        try {
            const nodeResult = this.runCommand('node --version', { silent: true });
            const npmResult = this.runCommand('npm --version', { silent: true });
            
            if (nodeResult.success && npmResult.success) {
                this.logSuccess(`Node.js version: ${nodeResult.output.trim()}`);
                this.logSuccess(`npm version: ${npmResult.output.trim()}`);
            } else {
                this.logError('Node.js or npm not found');
            }
        } catch (error) {
            this.logError(`Environment check failed: ${error.message}`);
        }

        // Step 2: Install Dependencies
        console.log('\n📦 Step 2: Installing Dependencies');
        const installResult = this.runCommand('npm install');
        if (installResult.success) {
            this.logSuccess('Dependencies installed successfully');
        } else {
            this.logError('Failed to install dependencies');
        }

        // Step 3: TypeScript Compilation
        console.log('\n🔨 Step 3: TypeScript Compilation');
        const buildResult = this.runCommand('npm run build');
        if (buildResult.success) {
            this.logSuccess('TypeScript compilation successful');
        } else {
            this.logError('TypeScript compilation failed');
        }

        // Step 4: Code Linting
        console.log('\n🔍 Step 4: Code Linting');
        const lintResult = this.runCommand('npm run lint');
        if (lintResult.success) {
            this.logSuccess('Linting passed');
        } else {
            this.logWarning('Linting issues found - consider running "npm run lint:fix"');
        }

        // Step 5: Run Tests
        console.log('\n🧪 Step 5: Running Tests');
        const testResult = this.runCommand('npm test');
        if (testResult.success) {
            this.logSuccess('All tests passed');
        } else {
            this.logError('Some tests failed');
        }

        // Step 6: File Structure Check
        console.log('\n📄 Step 6: File Structure Check');
        const criticalFiles = [
            'src/index.ts',
            'src/fabric-client.ts',
            'package.json',
            'tsconfig.json',
            'README.md'
        ];

        criticalFiles.forEach(file => {
            if (fs.existsSync(file)) {
                this.logSuccess(`Found: ${file}`);
            } else {
                this.logError(`Missing critical file: ${file}`);
            }
        });

        // Check build output
        if (fs.existsSync('build/index.js')) {
            this.logSuccess('Build output exists');
        } else {
            this.logWarning('Build output not found - run "npm run build"');
        }

        // Step 7: Package.json Validation
        console.log('\n📋 Step 7: Package.json Validation');
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const requiredFields = ['name', 'version', 'description', 'main', 'scripts', 'dependencies'];
            
            requiredFields.forEach(field => {
                if (packageJson[field]) {
                    this.logSuccess(`package.json has required field: ${field}`);
                } else {
                    this.logError(`package.json missing required field: ${field}`);
                }
            });
        } catch (error) {
            this.logError(`Failed to validate package.json: ${error.message}`);
        }

        // Step 8: Docker Build Test (optional)
        console.log('\n🐳 Step 8: Docker Build Test');
        const dockerResult = this.runCommand('docker --version', { silent: true });
        if (dockerResult.success) {
            const dockerBuildResult = this.runCommand('docker build -t fabric-analytics-mcp-test .');
            if (dockerBuildResult.success) {
                this.logSuccess('Docker build successful');
                // Clean up
                this.runCommand('docker rmi fabric-analytics-mcp-test', { silent: true });
            } else {
                this.logWarning('Docker build failed');
            }
        } else {
            this.logWarning('Docker not found - skipping Docker build test');
        }

        // Step 9: Git Status Check
        console.log('\n📝 Step 9: Git Status Check');
        try {
            const gitStatusResult = this.runCommand('git status --porcelain', { silent: true });
            if (gitStatusResult.success) {
                if (gitStatusResult.output.trim()) {
                    this.logSuccess('Git changes detected:');
                    this.runCommand('git status --short');
                } else {
                    this.logWarning('No Git changes detected');
                }
            }
        } catch (error) {
            this.logWarning('Git status check failed');
        }

        // Step 10: Security Check
        console.log('\n🔐 Step 10: Security Scan');
        this.performSecurityScan();

        // Summary
        this.printSummary();
    }

    performSecurityScan() {
        const sensitivePatterns = [
            /password\s*=/i,
            /secret\s*=/i,
            /token\s*=/i,
            /key\s*=/i,
            /Bearer [A-Za-z0-9\-\._~\+\/]+=*/
        ];

        let securityIssues = [];
        
        const scanFiles = (dir) => {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory() && !['node_modules', 'build', '.git'].includes(file)) {
                    scanFiles(filePath);
                } else if (stat.isFile() && /\.(ts|js|json)$/.test(file)) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        sensitivePatterns.forEach(pattern => {
                            if (pattern.test(content)) {
                                securityIssues.push(`${file}: Found potential sensitive data pattern`);
                            }
                        });
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            });
        };

        try {
            scanFiles('.');
            if (securityIssues.length === 0) {
                this.logSuccess('No obvious sensitive data patterns found');
            } else {
                securityIssues.forEach(issue => this.logWarning(issue));
            }
        } catch (error) {
            this.logWarning(`Security scan failed: ${error.message}`);
        }
    }

    printSummary() {
        console.log('\n📊 TEST SUMMARY');
        console.log('===============');

        if (this.errors.length === 0) {
            console.log('🎉 ALL CHECKS PASSED! Ready to push to Git.');
            console.log('Run these commands to push:');
            console.log('  git add .');
            console.log('  git commit -m "Add comprehensive notebook management features"');
            console.log('  git push origin master');
        } else {
            console.log('❌ ERRORS FOUND - DO NOT PUSH YET');
            console.log('Errors to fix:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\nWarnings (consider addressing):');
            this.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        console.log('\n✅ Pre-push testing completed!');
    }
}

// Run the tests
const runner = new TestRunner();
runner.runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
