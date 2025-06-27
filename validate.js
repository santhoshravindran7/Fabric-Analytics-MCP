#!/usr/bin/env node

/**
 * Comprehensive Pre-Push Validation Script
 * Validates all critical components before Git push
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ValidationRunner {
    constructor() {
        this.passed = [];
        this.failed = [];
        this.warnings = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            'info': '\x1b[36m',      // Cyan
            'success': '\x1b[32m',   // Green
            'warning': '\x1b[33m',   // Yellow
            'error': '\x1b[31m',     // Red
            'reset': '\x1b[0m'       // Reset
        };

        const icon = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };

        console.log(`${colors[type]}${icon[type]} ${message}${colors.reset}`);
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

    test(name, testFn) {
        try {
            testFn();
            this.passed.push(name);
            this.log(`${name} - PASSED`, 'success');
        } catch (error) {
            this.failed.push({ name, error: error.message });
            this.log(`${name} - FAILED: ${error.message}`, 'error');
        }
    }

    warn(name, message) {
        this.warnings.push({ name, message });
        this.log(`${name} - ${message}`, 'warning');
    }

    async runValidation() {
        console.log('\n🚀 Starting Comprehensive Pre-Push Validation');
        console.log('='.repeat(50));

        // Test 1: Environment Check
        this.log('\n📋 Environment Validation', 'info');
        this.test('Node.js Version', () => {
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
            if (majorVersion < 18) {
                throw new Error(`Node.js ${nodeVersion} found, but requires 18+`);
            }
        });

        this.test('npm Available', () => {
            const result = this.runCommand('npm --version', { silent: true });
            if (!result.success) {
                throw new Error('npm not found');
            }
        });

        // Test 2: File Structure
        this.log('\n📁 File Structure Validation', 'info');
        const criticalFiles = [
            'package.json',
            'tsconfig.json',
            'src/index.ts',
            'src/fabric-client.ts',
            'src/auth-client.ts',
            'README.md'
        ];

        criticalFiles.forEach(file => {
            this.test(`File exists: ${file}`, () => {
                if (!fs.existsSync(file)) {
                    throw new Error(`Critical file missing: ${file}`);
                }
            });
        });

        // Test 3: Package.json Validation
        this.log('\n📦 Package Configuration', 'info');
        this.test('Package.json Structure', () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const required = ['name', 'version', 'description', 'main', 'scripts', 'dependencies'];
            
            required.forEach(field => {
                if (!packageJson[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            });

            // Check critical dependencies
            const criticalDeps = [
                '@modelcontextprotocol/sdk',
                'zod',
                '@azure/msal-node'
            ];

            criticalDeps.forEach(dep => {
                if (!packageJson.dependencies[dep]) {
                    throw new Error(`Missing critical dependency: ${dep}`);
                }
            });
        });

        // Test 4: TypeScript Compilation
        this.log('\n🔨 TypeScript Compilation', 'info');
        this.test('TypeScript Build', () => {
            const result = this.runCommand('npm run build', { silent: true });
            if (!result.success) {
                throw new Error('TypeScript compilation failed');
            }
        });

        this.test('Build Output Exists', () => {
            if (!fs.existsSync('build/index.js')) {
                throw new Error('Build output not found');
            }
        });

        // Test 5: Source Code Validation
        this.log('\n📝 Source Code Validation', 'info');
        this.test('Main Index File', () => {
            const indexContent = fs.readFileSync('src/index.ts', 'utf8');
            
            // Check for key imports and exports
            const requiredPatterns = [
                /@modelcontextprotocol\/sdk/,
                /zod/,
                /create-fabric-notebook/,
                /get-fabric-notebook-definition/,
                /update-fabric-notebook-definition/,
                /run-fabric-notebook/
            ];

            requiredPatterns.forEach((pattern, i) => {
                if (!pattern.test(indexContent)) {
                    throw new Error(`Missing required pattern ${i + 1} in index.ts`);
                }
            });
        });

        this.test('Fabric Client', () => {
            const clientContent = fs.readFileSync('src/fabric-client.ts', 'utf8');
            
            const requiredMethods = [
                'createNotebook',
                'getItemDefinition', 
                'updateItemDefinition',
                'runNotebook'
            ];

            requiredMethods.forEach(method => {
                if (!clientContent.includes(method)) {
                    throw new Error(`Missing method: ${method} in fabric-client.ts`);
                }
            });
        });

        // Test 6: Docker Validation (optional)
        this.log('\n🐳 Docker Validation', 'info');
        const dockerResult = this.runCommand('docker --version', { silent: true });
        if (dockerResult.success) {
            this.test('Docker Build', () => {
                const result = this.runCommand('docker build -t mcp-test . --quiet', { silent: true });
                if (!result.success) {
                    throw new Error('Docker build failed');
                }
                // Clean up
                this.runCommand('docker rmi mcp-test --force', { silent: true });
            });
        } else {
            this.warn('Docker Build', 'Docker not available - skipping Docker tests');
        }

        // Test 7: Git Status
        this.log('\n📝 Git Status', 'info');
        try {
            const gitStatus = this.runCommand('git status --porcelain', { silent: true });
            if (gitStatus.success && gitStatus.output.trim()) {
                this.log('Git changes detected - ready to commit', 'info');
            } else {
                this.warn('Git Status', 'No changes detected');
            }
        } catch (error) {
            this.warn('Git Status', 'Git not available or not a git repository');
        }

        // Test 8: Security Scan
        this.log('\n🔐 Security Scan', 'info');
        this.test('Sensitive Data Check', () => {
            const sensitivePatterns = [
                /password\s*[:=]\s*['"]\w+['"]/i,
                /secret\s*[:=]\s*['"]\w+['"]/i,
                /key\s*[:=]\s*['"]\w+['"]/i,
                /Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/
            ];

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
                                    throw new Error(`Potential sensitive data found in ${filePath}`);
                                }
                            });
                        } catch (error) {
                            if (error.message.includes('sensitive data')) {
                                throw error;
                            }
                            // Skip files that can't be read
                        }
                    }
                });
            };

            scanFiles('.');
        });

        // Summary
        this.printSummary();
    }

    printSummary() {
        console.log('\n📊 VALIDATION SUMMARY');
        console.log('='.repeat(30));

        this.log(`✅ Passed: ${this.passed.length}`, 'success');
        this.log(`❌ Failed: ${this.failed.length}`, this.failed.length > 0 ? 'error' : 'success');
        this.log(`⚠️  Warnings: ${this.warnings.length}`, this.warnings.length > 0 ? 'warning' : 'success');

        if (this.failed.length > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.failed.forEach(failure => {
                this.log(`  - ${failure.name}: ${failure.error}`, 'error');
            });
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(warning => {
                this.log(`  - ${warning.name}: ${warning.message}`, 'warning');
            });
        }

        if (this.failed.length === 0) {
            console.log('\n🎉 ALL CRITICAL TESTS PASSED!');
            console.log('✅ Ready to push to Git');
            console.log('\nRun these commands:');
            console.log('  git add .');
            console.log('  git commit -m "Add comprehensive notebook management features"');
            console.log('  git push origin master');
        } else {
            console.log('\n🚫 DO NOT PUSH - Fix failed tests first');
        }
    }
}

// Run validation
const validator = new ValidationRunner();
validator.runValidation().catch(error => {
    console.error('Validation runner failed:', error);
    process.exit(1);
});
