#!/bin/bash
# Microsoft Fabric Analytics MCP Server Installation Script for Linux/macOS

set -e

echo "🚀 Microsoft Fabric Analytics MCP Server Installer"
echo "=" * 60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Install Python if not present
install_python() {
    if ! command_exists python3; then
        print_warning "Python 3 not found. Installing..."
        
        OS=$(detect_os)
        if [[ "$OS" == "linux" ]]; then
            if command_exists apt-get; then
                sudo apt-get update
                sudo apt-get install -y python3 python3-pip
            elif command_exists yum; then
                sudo yum install -y python3 python3-pip
            elif command_exists dnf; then
                sudo dnf install -y python3 python3-pip
            else
                print_error "Unable to install Python. Please install manually."
                exit 1
            fi
        elif [[ "$OS" == "macos" ]]; then
            if command_exists brew; then
                brew install python3
            else
                print_error "Homebrew not found. Please install Python 3 manually."
                exit 1
            fi
        fi
    else
        print_status "Python 3 found"
    fi
}

# Install Node.js if not present
install_nodejs() {
    if ! command_exists node; then
        print_warning "Node.js not found. Installing..."
        
        OS=$(detect_os)
        if [[ "$OS" == "linux" ]]; then
            # Install Node.js via NodeSource repository
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            if command_exists apt-get; then
                sudo apt-get install -y nodejs
            elif command_exists yum; then
                sudo yum install -y nodejs npm
            elif command_exists dnf; then
                sudo dnf install -y nodejs npm
            fi
        elif [[ "$OS" == "macos" ]]; then
            if command_exists brew; then
                brew install node
            else
                print_error "Homebrew not found. Please install Node.js manually."
                exit 1
            fi
        fi
    else
        print_status "Node.js found"
    fi
}

# Main installation function
install_fabric_mcp() {
    local method="$1"
    
    print_info "Installing Microsoft Fabric Analytics MCP Server..."
    
    case "$method" in
        "python"|"pip")
            print_info "Installing via Python/pip..."
            install_python
            
            if command_exists pip3; then
                pip3 install fabric-analytics-mcp
            elif command_exists pip; then
                pip install fabric-analytics-mcp
            else
                python3 -m pip install fabric-analytics-mcp
            fi
            
            print_status "Python package installed successfully!"
            print_info "Test with: fabric-analytics-mcp validate"
            ;;
            
        "npm")
            print_info "Installing via NPM..."
            install_nodejs
            
            npm install -g mcp-for-microsoft-fabric-analytics
            
            print_status "NPM package installed successfully!"
            print_info "Test with: fabric-analytics"
            ;;
            
        "source"|"git")
            print_info "Installing from source..."
            install_nodejs
            
            if [[ -d "Fabric-Analytics-MCP" ]]; then
                print_warning "Directory already exists. Updating..."
                cd Fabric-Analytics-MCP
                git pull
            else
                git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
                cd Fabric-Analytics-MCP
            fi
            
            npm install
            npm run build
            
            print_status "Source installation completed!"
            print_info "Start with: npm start"
            ;;
            
        *)
            print_error "Unknown installation method: $method"
            echo "Available methods: python, npm, source"
            exit 1
            ;;
    esac
}

# Configuration helper
configure_environment() {
    print_info "Setting up environment configuration..."
    
    cat << 'EOF' > fabric-mcp-env.sh
#!/bin/bash
# Microsoft Fabric Analytics MCP Server Environment Configuration

# Required: Authentication method
export FABRIC_AUTH_METHOD=bearer_token  # Options: bearer_token, service_principal, interactive

# Optional: Default workspace ID (can be discovered using tools)
# export FABRIC_DEFAULT_WORKSPACE_ID=your-workspace-id

# For Service Principal authentication:
# export FABRIC_CLIENT_ID=your-client-id
# export FABRIC_CLIENT_SECRET=your-client-secret
# export FABRIC_TENANT_ID=your-tenant-id

echo "✅ Microsoft Fabric MCP environment configured"
echo "💡 Edit this file to set your specific configuration"
EOF
    
    chmod +x fabric-mcp-env.sh
    print_status "Environment configuration created: fabric-mcp-env.sh"
    print_info "Run 'source fabric-mcp-env.sh' to load configuration"
}

# Claude Desktop configuration helper
configure_claude() {
    print_info "Setting up Claude Desktop configuration..."
    
    # Detect Claude config path
    if [[ "$(detect_os)" == "macos" ]]; then
        CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
    else
        CLAUDE_CONFIG_DIR="$HOME/.config/claude"
    fi
    
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    if [[ -f "$CLAUDE_CONFIG_FILE" ]]; then
        print_warning "Claude config exists. Creating backup..."
        cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup.$(date +%s)"
    fi
    
    cat << 'EOF' > "$CLAUDE_CONFIG_FILE"
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "fabric-analytics-mcp",
      "args": ["start"],
      "env": {
        "FABRIC_AUTH_METHOD": "bearer_token"
      }
    }
  }
}
EOF
    
    print_status "Claude Desktop configuration created"
    print_info "Restart Claude Desktop to apply changes"
}

# Main script logic
main() {
    echo "🎯 Choose installation method:"
    echo "1) Python/pip (Recommended)"
    echo "2) NPM"
    echo "3) From source"
    echo "4) All methods"
    echo ""
    read -p "Enter choice (1-4): " choice
    
    case "$choice" in
        1)
            install_fabric_mcp "python"
            ;;
        2)
            install_fabric_mcp "npm"
            ;;
        3)
            install_fabric_mcp "source"
            ;;
        4)
            install_fabric_mcp "python"
            install_fabric_mcp "npm"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Offer additional configuration
    echo ""
    read -p "Setup environment configuration? (y/N): " setup_env
    if [[ "$setup_env" =~ ^[Yy]$ ]]; then
        configure_environment
    fi
    
    read -p "Setup Claude Desktop configuration? (y/N): " setup_claude
    if [[ "$setup_claude" =~ ^[Yy]$ ]]; then
        configure_claude
    fi
    
    print_status "Installation completed successfully!"
    echo ""
    print_info "Next steps:"
    echo "1. Set up authentication (see environment configuration)"
    echo "2. Test installation: fabric-analytics-mcp validate"
    echo "3. Start using with Claude Desktop or other MCP clients"
    echo ""
    print_info "Documentation: https://github.com/santhoshravindran7/Fabric-Analytics-MCP"
}

# Run main function
main "$@"
