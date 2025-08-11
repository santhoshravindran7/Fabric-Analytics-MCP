# Microsoft Fabric Analytics MCP Server Installation Script for Windows PowerShell

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("python", "npm", "source", "all")]
    [string]$Method = "python",
    
    [Parameter(Mandatory=$false)]
    [switch]$ConfigureEnvironment,
    
    [Parameter(Mandatory=$false)]
    [switch]$ConfigureClaude,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
}

function Write-Status {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Colors.Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $Colors.Blue
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Install-Python {
    if (-not (Test-CommandExists "python")) {
        Write-Warning "Python not found. Please install Python 3.8+ from https://python.org"
        Write-Info "Or install via Windows Store or chocolatey: choco install python"
        
        $install = Read-Host "Install Python via chocolatey? (y/N)"
        if ($install -match "^[Yy]$") {
            if (Test-CommandExists "choco") {
                choco install python -y
            } else {
                Write-Error "Chocolatey not found. Please install Python manually."
                exit 1
            }
        } else {
            Write-Error "Python is required. Please install and re-run this script."
            exit 1
        }
    } else {
        Write-Status "Python found"
    }
}

function Install-NodeJS {
    if (-not (Test-CommandExists "node")) {
        Write-Warning "Node.js not found. Please install Node.js 18+ from https://nodejs.org"
        Write-Info "Or install via chocolatey: choco install nodejs"
        
        $install = Read-Host "Install Node.js via chocolatey? (y/N)"
        if ($install -match "^[Yy]$") {
            if (Test-CommandExists "choco") {
                choco install nodejs -y
            } else {
                Write-Error "Chocolatey not found. Please install Node.js manually."
                exit 1
            }
        } else {
            Write-Error "Node.js is required. Please install and re-run this script."
            exit 1
        }
    } else {
        Write-Status "Node.js found"
    }
}

function Install-FabricMCP {
    param([string]$InstallMethod)
    
    Write-Info "Installing Microsoft Fabric Analytics MCP Server..."
    
    switch ($InstallMethod) {
        "python" {
            Write-Info "Installing via Python/pip..."
            Install-Python
            
            try {
                pip install fabric-analytics-mcp
                Write-Status "Python package installed successfully!"
                Write-Info "Test with: fabric-analytics-mcp validate"
            } catch {
                Write-Error "Failed to install Python package: $_"
                exit 1
            }
        }
        
        "npm" {
            Write-Info "Installing via NPM..."
            Install-NodeJS
            
            try {
                npm install -g mcp-for-microsoft-fabric-analytics
                Write-Status "NPM package installed successfully!"
                Write-Info "Test with: fabric-analytics"
            } catch {
                Write-Error "Failed to install NPM package: $_"
                exit 1
            }
        }
        
        "source" {
            Write-Info "Installing from source..."
            Install-NodeJS
            
            if (Test-Path "Fabric-Analytics-MCP") {
                Write-Warning "Directory already exists. Updating..."
                Set-Location "Fabric-Analytics-MCP"
                git pull
            } else {
                git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
                Set-Location "Fabric-Analytics-MCP"
            }
            
            npm install
            npm run build
            
            Write-Status "Source installation completed!"
            Write-Info "Start with: npm start"
        }
        
        "all" {
            Install-FabricMCP "python"
            Install-FabricMCP "npm"
        }
        
        default {
            Write-Error "Unknown installation method: $InstallMethod"
            exit 1
        }
    }
}

function Configure-Environment {
    Write-Info "Setting up environment configuration..."
    
    $envConfig = @"
# Microsoft Fabric Analytics MCP Server Environment Configuration
# Save this as fabric-mcp-env.ps1 and run: . .\fabric-mcp-env.ps1

# Required: Authentication method
`$env:FABRIC_AUTH_METHOD = "bearer_token"  # Options: bearer_token, service_principal, interactive

# Optional: Default workspace ID (can be discovered using tools)
# `$env:FABRIC_DEFAULT_WORKSPACE_ID = "your-workspace-id"

# For Service Principal authentication:
# `$env:FABRIC_CLIENT_ID = "your-client-id"
# `$env:FABRIC_CLIENT_SECRET = "your-client-secret"
# `$env:FABRIC_TENANT_ID = "your-tenant-id"

Write-Host "✅ Microsoft Fabric MCP environment configured" -ForegroundColor Green
Write-Host "💡 Edit this file to set your specific configuration" -ForegroundColor Blue
"@

    $envConfig | Out-File -FilePath "fabric-mcp-env.ps1" -Encoding UTF8
    Write-Status "Environment configuration created: fabric-mcp-env.ps1"
    Write-Info "Run '. .\fabric-mcp-env.ps1' to load configuration"
}

function Configure-Claude {
    Write-Info "Setting up Claude Desktop configuration..."
    
    $claudeConfigDir = "$env:APPDATA\Claude"
    $claudeConfigFile = "$claudeConfigDir\claude_desktop_config.json"
    
    if (-not (Test-Path $claudeConfigDir)) {
        New-Item -ItemType Directory -Path $claudeConfigDir -Force | Out-Null
    }
    
    if (Test-Path $claudeConfigFile) {
        Write-Warning "Claude config exists. Creating backup..."
        $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        Copy-Item $claudeConfigFile "$claudeConfigFile.backup.$timestamp"
    }
    
    $claudeConfig = @{
        mcpServers = @{
            "fabric-analytics" = @{
                command = "fabric-analytics-mcp"
                args = @("start")
                env = @{
                    FABRIC_AUTH_METHOD = "bearer_token"
                }
            }
        }
    }
    
    $claudeConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $claudeConfigFile -Encoding UTF8
    
    Write-Status "Claude Desktop configuration created"
    Write-Info "Restart Claude Desktop to apply changes"
}

function Show-Help {
    Write-Host @"
Microsoft Fabric Analytics MCP Server Installation Script

USAGE:
    .\install-windows.ps1 [OPTIONS]

OPTIONS:
    -Method <string>         Installation method: python, npm, source, all (default: python)
    -ConfigureEnvironment    Set up environment configuration file
    -ConfigureClaude        Set up Claude Desktop configuration
    -Help                   Show this help message

EXAMPLES:
    .\install-windows.ps1                                    # Install via Python (default)
    .\install-windows.ps1 -Method npm                        # Install via NPM
    .\install-windows.ps1 -Method all -ConfigureClaude      # Install both packages and configure Claude
    .\install-windows.ps1 -ConfigureEnvironment             # Just create environment config

INSTALLATION METHODS:
    python    Install via pip (recommended)
    npm       Install via NPM
    source    Clone and build from source
    all       Install both Python and NPM packages

NEXT STEPS:
    1. Set up authentication (edit environment configuration)
    2. Test installation: fabric-analytics-mcp validate
    3. Configure your MCP client (Claude Desktop, etc.)
    4. Start using the server

DOCUMENTATION:
    https://github.com/santhoshravindran7/Fabric-Analytics-MCP
"@ -ForegroundColor Cyan
}

# Main script execution
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    Write-Host "🚀 Microsoft Fabric Analytics MCP Server Installer" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""
    
    try {
        # Install the server
        Install-FabricMCP $Method
        
        # Configure environment if requested
        if ($ConfigureEnvironment) {
            Configure-Environment
        }
        
        # Configure Claude if requested
        if ($ConfigureClaude) {
            Configure-Claude
        }
        
        # Interactive configuration if no flags provided
        if (-not $ConfigureEnvironment -and -not $ConfigureClaude) {
            Write-Host ""
            $setupEnv = Read-Host "Setup environment configuration? (y/N)"
            if ($setupEnv -match "^[Yy]$") {
                Configure-Environment
            }
            
            $setupClaude = Read-Host "Setup Claude Desktop configuration? (y/N)"
            if ($setupClaude -match "^[Yy]$") {
                Configure-Claude
            }
        }
        
        Write-Host ""
        Write-Status "Installation completed successfully!"
        Write-Host ""
        Write-Info "Next steps:"
        Write-Host "1. Set up authentication (see environment configuration)"
        Write-Host "2. Test installation: fabric-analytics-mcp validate"
        Write-Host "3. Start using with Claude Desktop or other MCP clients"
        Write-Host ""
        Write-Info "Documentation: https://github.com/santhoshravindran7/Fabric-Analytics-MCP"
        
    } catch {
        Write-Error "Installation failed: $_"
        Write-Info "Please check the error message and try again."
        Write-Info "For help, run: .\install-windows.ps1 -Help"
        exit 1
    }
}

# Execute main function
Main
