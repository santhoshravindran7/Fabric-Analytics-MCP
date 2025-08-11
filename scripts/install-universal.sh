#!/bin/bash

# Microsoft Fabric Analytics MCP Server - Universal Installation Script
# Supports multiple installation methods and environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_VERSION="1.0.0"
DEFAULT_INSTALL_METHOD="auto"
CLAUDE_CONFIG_DIR="$HOME/.config/claude-desktop"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

print_header() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}Microsoft Fabric Analytics MCP Server${NC}"
    echo -e "${BLUE}Universal Installation Script v$SCRIPT_VERSION${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -m, --method METHOD     Installation method: pip, npm, docker, source, auto (default: auto)"
    echo "  -c, --config            Configure Claude Desktop integration"
    echo "  -e, --env               Setup environment configuration"
    echo "  -t, --test              Run post-installation tests"
    echo "  -v, --verbose           Enable verbose output"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Installation Methods:"
    echo "  pip       - Install from PyPI (Python package)"
    echo "  npm       - Install from NPM (Node.js package)"
    echo "  docker    - Run via Docker container"
    echo "  source    - Build from source code"
    echo "  auto      - Automatically detect best method"
    echo ""
    echo "Examples:"
    echo "  $0                          # Auto-detect and install"
    echo "  $0 -m pip -c -e            # Install via pip with full setup"
    echo "  $0 -m docker -t            # Install via Docker and test"
    echo "  $0 -m npm --verbose        # Install via NPM with verbose output"
}

log() {
    local level=$1
    shift
    local message="$*"
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[DEBUG]${NC} $message"
            fi
            ;;
    esac
}

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        log "DEBUG" "Command '$1' is available"
        return 0
    else
        log "DEBUG" "Command '$1' is not available"
        return 1
    fi
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

detect_package_manager() {
    local os=$(detect_os)
    
    case $os in
        "linux")
            if check_command "apt"; then
                echo "apt"
            elif check_command "yum"; then
                echo "yum"
            elif check_command "dnf"; then
                echo "dnf"
            elif check_command "pacman"; then
                echo "pacman"
            elif check_command "zypper"; then
                echo "zypper"
            else
                echo "unknown"
            fi
            ;;
        "macos")
            if check_command "brew"; then
                echo "brew"
            else
                echo "unknown"
            fi
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

auto_detect_method() {
    log "INFO" "Auto-detecting best installation method..."
    
    # Priority order: pip > npm > docker > source
    if check_command "python3" && check_command "pip3"; then
        echo "pip"
    elif check_command "python" && check_command "pip"; then
        echo "pip"
    elif check_command "node" && check_command "npm"; then
        echo "npm"
    elif check_command "docker"; then
        echo "docker"
    elif check_command "git"; then
        echo "source"
    else
        log "ERROR" "No suitable installation method found"
        log "ERROR" "Please install Python (with pip), Node.js (with npm), Docker, or Git"
        exit 1
    fi
}

install_dependencies() {
    local os=$(detect_os)
    local pm=$(detect_package_manager)
    
    log "INFO" "Installing system dependencies for $os using $pm..."
    
    case $pm in
        "apt")
            sudo apt update
            sudo apt install -y curl wget git
            ;;
        "yum"|"dnf")
            sudo $pm install -y curl wget git
            ;;
        "pacman")
            sudo pacman -Sy --noconfirm curl wget git
            ;;
        "zypper")
            sudo zypper install -y curl wget git
            ;;
        "brew")
            brew install curl wget git
            ;;
        *)
            log "WARN" "Unknown package manager, skipping system dependencies"
            ;;
    esac
}

install_python_deps() {
    log "INFO" "Installing Python dependencies..."
    
    if check_command "python3"; then
        PYTHON_CMD="python3"
        PIP_CMD="pip3"
    elif check_command "python"; then
        PYTHON_CMD="python"
        PIP_CMD="pip"
    else
        log "ERROR" "Python not found, please install Python 3.8 or higher"
        exit 1
    fi
    
    # Upgrade pip
    $PIP_CMD install --upgrade pip
    
    log "DEBUG" "Python: $($PYTHON_CMD --version)"
    log "DEBUG" "Pip: $($PIP_CMD --version)"
}

install_nodejs_deps() {
    log "INFO" "Installing Node.js dependencies..."
    
    if ! check_command "node"; then
        log "ERROR" "Node.js not found, please install Node.js 16 or higher"
        exit 1
    fi
    
    if ! check_command "npm"; then
        log "ERROR" "NPM not found, please install npm"
        exit 1
    fi
    
    # Update npm
    npm install -g npm@latest
    
    log "DEBUG" "Node.js: $(node --version)"
    log "DEBUG" "NPM: $(npm --version)"
}

install_via_pip() {
    log "INFO" "Installing Microsoft Fabric Analytics MCP Server via PyPI..."
    
    install_python_deps
    
    # Install the package
    $PIP_CMD install fabric-analytics-mcp
    
    # Verify installation
    if fabric-analytics --version >/dev/null 2>&1; then
        log "INFO" "Successfully installed via PyPI"
        return 0
    else
        log "ERROR" "Installation verification failed"
        return 1
    fi
}

install_via_npm() {
    log "INFO" "Installing Microsoft Fabric Analytics MCP Server via NPM..."
    
    install_nodejs_deps
    
    # Install the package globally
    npm install -g mcp-for-microsoft-fabric-analytics
    
    # Verify installation
    if fabric-analytics --version >/dev/null 2>&1; then
        log "INFO" "Successfully installed via NPM"
        return 0
    else
        log "ERROR" "Installation verification failed"
        return 1
    fi
}

install_via_docker() {
    log "INFO" "Setting up Microsoft Fabric Analytics MCP Server via Docker..."
    
    if ! check_command "docker"; then
        log "ERROR" "Docker not found, please install Docker"
        exit 1
    fi
    
    # Pull the image (when available)
    log "INFO" "Building Docker image from source..."
    
    # Clone repository if not exists
    if [[ ! -d "Fabric-Analytics-MCP" ]]; then
        git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
    fi
    
    cd Fabric-Analytics-MCP
    
    # Build the image
    docker build -t fabric-analytics-mcp .
    
    # Create run script
    cat > run-fabric-mcp.sh << 'EOF'
#!/bin/bash
docker run -d \
  --name fabric-mcp \
  -p 3000:3000 \
  --env-file .env \
  fabric-analytics-mcp
EOF
    
    chmod +x run-fabric-mcp.sh
    
    log "INFO" "Docker setup complete. Use ./run-fabric-mcp.sh to start the server"
}

install_via_source() {
    log "INFO" "Installing Microsoft Fabric Analytics MCP Server from source..."
    
    if ! check_command "git"; then
        log "ERROR" "Git not found, please install Git"
        exit 1
    fi
    
    # Clone repository
    if [[ ! -d "Fabric-Analytics-MCP" ]]; then
        git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
    fi
    
    cd Fabric-Analytics-MCP
    
    # Install Node.js dependencies and build
    if check_command "npm"; then
        log "INFO" "Installing Node.js dependencies..."
        npm install
        npm run build
        npm link
    elif check_command "python3" || check_command "python"; then
        log "INFO" "Installing Python dependencies..."
        install_python_deps
        $PIP_CMD install -e .
    else
        log "ERROR" "Neither Node.js nor Python found for source installation"
        exit 1
    fi
    
    log "INFO" "Source installation complete"
}

setup_environment() {
    log "INFO" "Setting up environment configuration..."
    
    local config_file=".env"
    
    if [[ -f "$config_file" ]]; then
        log "WARN" "Environment file already exists at $config_file"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "Keeping existing environment file"
            return 0
        fi
    fi
    
    cat > "$config_file" << 'EOF'
# Microsoft Fabric Analytics MCP Server Configuration
# Copy this file and update with your actual values

# Authentication Method: bearer_token, service_principal, or azure_cli
FABRIC_AUTH_METHOD=bearer_token

# Azure AD Application Details (for service_principal auth)
FABRIC_CLIENT_ID=your-client-id-here
FABRIC_CLIENT_SECRET=your-client-secret-here
FABRIC_TENANT_ID=your-tenant-id-here

# Default Workspace (optional)
FABRIC_DEFAULT_WORKSPACE_ID=your-workspace-id-here

# Logging Level: debug, info, warn, error
LOG_LEVEL=info

# Server Configuration
PORT=3000
HOST=localhost
EOF
    
    log "INFO" "Environment template created at $config_file"
    log "WARN" "Please edit $config_file with your actual configuration values"
}

configure_claude_desktop() {
    log "INFO" "Configuring Claude Desktop integration..."
    
    # Create Claude config directory
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # Detect installation method for binary path
    local binary_path=""
    if check_command "fabric-analytics"; then
        binary_path=$(which fabric-analytics)
    elif check_command "fabric-analytics-mcp"; then
        binary_path=$(which fabric-analytics-mcp)
    else
        log "ERROR" "Fabric Analytics MCP binary not found in PATH"
        return 1
    fi
    
    # Create or update Claude Desktop config
    local temp_config=$(mktemp)
    
    if [[ -f "$CLAUDE_CONFIG_FILE" ]]; then
        # Backup existing config
        cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup"
        log "INFO" "Backed up existing Claude config to $CLAUDE_CONFIG_FILE.backup"
        
        # Merge with existing config
        jq '. + {
            "mcpServers": {
                "fabric-analytics": {
                    "command": "'"$binary_path"'",
                    "args": ["--stdio"],
                    "env": {
                        "FABRIC_AUTH_METHOD": "bearer_token"
                    }
                }
            }
        }' "$CLAUDE_CONFIG_FILE" > "$temp_config"
    else
        # Create new config
        cat > "$temp_config" << EOF
{
    "mcpServers": {
        "fabric-analytics": {
            "command": "$binary_path",
            "args": ["--stdio"],
            "env": {
                "FABRIC_AUTH_METHOD": "bearer_token"
            }
        }
    }
}
EOF
    fi
    
    mv "$temp_config" "$CLAUDE_CONFIG_FILE"
    log "INFO" "Claude Desktop configuration updated"
    log "INFO" "Please restart Claude Desktop to apply changes"
}

run_tests() {
    log "INFO" "Running post-installation tests..."
    
    # Test 1: Command availability
    if check_command "fabric-analytics"; then
        log "INFO" "✓ fabric-analytics command is available"
    else
        log "ERROR" "✗ fabric-analytics command not found"
        return 1
    fi
    
    # Test 2: Version check
    if fabric-analytics --version >/dev/null 2>&1; then
        local version=$(fabric-analytics --version 2>/dev/null || echo "unknown")
        log "INFO" "✓ Version check passed: $version"
    else
        log "ERROR" "✗ Version check failed"
        return 1
    fi
    
    # Test 3: Help command
    if fabric-analytics --help >/dev/null 2>&1; then
        log "INFO" "✓ Help command works"
    else
        log "ERROR" "✗ Help command failed"
        return 1
    fi
    
    # Test 4: Configuration file
    if [[ -f ".env" ]]; then
        log "INFO" "✓ Environment configuration file exists"
    else
        log "WARN" "⚠ Environment configuration file not found"
    fi
    
    # Test 5: Claude Desktop config
    if [[ -f "$CLAUDE_CONFIG_FILE" ]]; then
        log "INFO" "✓ Claude Desktop configuration exists"
    else
        log "WARN" "⚠ Claude Desktop configuration not found"
    fi
    
    log "INFO" "Post-installation tests completed"
}

cleanup() {
    log "INFO" "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

main() {
    local install_method="$DEFAULT_INSTALL_METHOD"
    local configure_claude=false
    local setup_env=false
    local run_post_tests=false
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -m|--method)
                install_method="$2"
                shift 2
                ;;
            -c|--config)
                configure_claude=true
                shift
                ;;
            -e|--env)
                setup_env=true
                shift
                ;;
            -t|--test)
                run_post_tests=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                export VERBOSE=true
                shift
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
    
    # Set verbose mode
    export VERBOSE=$verbose
    
    print_header
    
    # Auto-detect installation method if needed
    if [[ "$install_method" == "auto" ]]; then
        install_method=$(auto_detect_method)
        log "INFO" "Auto-detected installation method: $install_method"
    fi
    
    # Validate installation method
    case $install_method in
        "pip"|"npm"|"docker"|"source")
            log "INFO" "Using installation method: $install_method"
            ;;
        *)
            log "ERROR" "Invalid installation method: $install_method"
            log "ERROR" "Valid methods: pip, npm, docker, source, auto"
            exit 1
            ;;
    esac
    
    # Install system dependencies if needed
    install_dependencies
    
    # Perform installation
    case $install_method in
        "pip")
            install_via_pip
            ;;
        "npm")
            install_via_npm
            ;;
        "docker")
            install_via_docker
            ;;
        "source")
            install_via_source
            ;;
    esac
    
    # Setup environment if requested
    if [[ "$setup_env" == true ]]; then
        setup_environment
    fi
    
    # Configure Claude Desktop if requested
    if [[ "$configure_claude" == true ]]; then
        configure_claude_desktop
    fi
    
    # Run tests if requested
    if [[ "$run_post_tests" == true ]]; then
        run_tests
    fi
    
    # Cleanup
    cleanup
    
    # Success message
    echo ""
    log "INFO" "Installation completed successfully!"
    echo ""
    echo -e "${GREEN}Next Steps:${NC}"
    echo "1. Configure your environment in .env file"
    echo "2. Set up Claude Desktop integration (-c flag)"
    echo "3. Start using the MCP server with Claude Desktop"
    echo ""
    echo -e "${BLUE}For more information:${NC}"
    echo "- Documentation: https://github.com/santhoshravindran7/Fabric-Analytics-MCP"
    echo "- Issues: https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues"
    echo ""
}

# Set up signal handlers for cleanup
trap cleanup EXIT INT TERM

# Run main function
main "$@"
