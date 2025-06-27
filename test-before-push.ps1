# Comprehensive Pre-Push Testing Script
# This script runs all necessary tests before pushing to Git

Write-Host "🚀 Starting comprehensive pre-push testing..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

$errors = @()
$warnings = @()

# Function to log errors
function Log-Error($message) {
    $script:errors += $message
    Write-Host "❌ ERROR: $message" -ForegroundColor Red
}

# Function to log warnings
function Log-Warning($message) {
    $script:warnings += $message
    Write-Host "⚠️  WARNING: $message" -ForegroundColor Yellow
}

# Function to log success
function Log-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

# 1. Check Node.js and npm versions
Write-Host "`n📋 Step 1: Environment Check" -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Log-Success "Node.js version: $nodeVersion"
    Log-Success "npm version: $npmVersion"
} catch {
    Log-Error "Node.js or npm not found. Please install Node.js 18+ and npm."
}

# 2. Install dependencies
Write-Host "`n📦 Step 2: Installing Dependencies" -ForegroundColor Cyan
try {
    npm install --silent
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Dependencies installed successfully"
    } else {
        Log-Error "Failed to install dependencies"
    }
} catch {
    Log-Error "Failed to install dependencies: $_"
}

# 3. TypeScript compilation
Write-Host "`n🔨 Step 3: TypeScript Compilation" -ForegroundColor Cyan
try {
    npm run build --silent
    if ($LASTEXITCODE -eq 0) {
        Log-Success "TypeScript compilation successful"
    } else {
        Log-Error "TypeScript compilation failed"
    }
} catch {
    Log-Error "TypeScript compilation failed: $_"
}

# 4. ESLint check
Write-Host "`n🔍 Step 4: Code Linting" -ForegroundColor Cyan
try {
    npm run lint --silent
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Linting passed"
    } else {
        Log-Warning "Linting issues found - consider running 'npm run lint:fix'"
    }
} catch {
    Log-Warning "ESLint check failed: $_"
}

# 5. Run Jest tests
Write-Host "`n🧪 Step 5: Running Tests" -ForegroundColor Cyan
try {
    npm test --silent
    if ($LASTEXITCODE -eq 0) {
        Log-Success "All tests passed"
    } else {
        Log-Error "Some tests failed"
    }
} catch {
    Log-Error "Test execution failed: $_"
}

# 6. Check critical files exist
Write-Host "`n📄 Step 6: File Structure Check" -ForegroundColor Cyan
$criticalFiles = @(
    "src/index.ts",
    "src/fabric-client.ts",
    "package.json",
    "tsconfig.json",
    "README.md",
    "build/index.js"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Log-Success "Found: $file"
    } else {
        Log-Error "Missing critical file: $file"
    }
}

# 7. Check package.json for required fields
Write-Host "`n📋 Step 7: Package.json Validation" -ForegroundColor Cyan
try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    $requiredFields = @("name", "version", "description", "main", "scripts", "dependencies")
    foreach ($field in $requiredFields) {
        if ($packageJson.$field) {
            Log-Success "package.json has required field: $field"
        } else {
            Log-Error "package.json missing required field: $field"
        }
    }
} catch {
    Log-Error "Failed to validate package.json: $_"
}

# 8. Docker build test (optional)
Write-Host "`n🐳 Step 8: Docker Build Test" -ForegroundColor Cyan
try {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker build -t fabric-analytics-mcp-test . --quiet
        if ($LASTEXITCODE -eq 0) {
            Log-Success "Docker build successful"
            # Clean up test image
            docker rmi fabric-analytics-mcp-test --force | Out-Null
        } else {
            Log-Warning "Docker build failed"
        }
    } else {
        Log-Warning "Docker not found - skipping Docker build test"
    }
} catch {
    Log-Warning "Docker build test failed: $_"
}

# 9. Git status check
Write-Host "`n📝 Step 9: Git Status Check" -ForegroundColor Cyan
try {
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Log-Success "Git changes detected:"
        git status --short
    } else {
        Log-Warning "No Git changes detected"
    }
} catch {
    Log-Warning "Git status check failed: $_"
}

# 10. Security check - scan for sensitive data
Write-Host "`n🔐 Step 10: Security Scan" -ForegroundColor Cyan
$sensitivePatterns = @(
    "password\s*=",
    "secret\s*=",
    "token\s*=",
    "key\s*=",
    "Bearer [A-Za-z0-9\-\._~\+\/]+=*"
)

$securityIssues = @()
Get-ChildItem -Recurse -Include "*.ts", "*.js", "*.json" -Exclude "node_modules", "build" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    foreach ($pattern in $sensitivePatterns) {
        if ($content -match $pattern) {
            $securityIssues += "$($_.Name): Found potential sensitive data pattern"
        }
    }
}

if ($securityIssues.Count -eq 0) {
    Log-Success "No obvious sensitive data patterns found"
} else {
    foreach ($issue in $securityIssues) {
        Log-Warning $issue
    }
}

# Summary
Write-Host "`n📊 TEST SUMMARY" -ForegroundColor Magenta
Write-Host "===============" -ForegroundColor Magenta

if ($errors.Count -eq 0) {
    Write-Host "🎉 ALL CHECKS PASSED! Ready to push to Git." -ForegroundColor Green
    Write-Host "Run these commands to push:" -ForegroundColor Green
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m `"Add comprehensive notebook management features`"" -ForegroundColor White
    Write-Host "  git push origin master" -ForegroundColor White
} else {
    Write-Host "❌ ERRORS FOUND - DO NOT PUSH YET" -ForegroundColor Red
    Write-Host "Errors to fix:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "`nWarnings (consider addressing):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Pre-push testing completed!" -ForegroundColor Green
