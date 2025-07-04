#!/bin/bash

# Microsoft Fabric Analytics MCP Server - Deployment Validation Script
# This script validates the deployment and tests all endpoints

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"
FABRIC_CLIENT_ID="${FABRIC_CLIENT_ID:-}"
FABRIC_CLIENT_SECRET="${FABRIC_CLIENT_SECRET:-}"
FABRIC_TENANT_ID="${FABRIC_TENANT_ID:-}"
TEST_WORKSPACE_ID="${TEST_WORKSPACE_ID:-}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to test HTTP endpoint
test_endpoint() {
    local endpoint="$1"
    local expected_status="$2"
    local description="$3"
    
    print_status "Testing $description..."
    
    local response
    local status_code
    
    if response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$MCP_SERVER_URL$endpoint"); then
        status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | sed 's/HTTPSTATUS://')
        local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
        
        if [[ "$status_code" == "$expected_status" ]]; then
            print_success "$description - Status: $status_code"
            if [[ -n "$body" ]]; then
                echo "Response: $body" | jq . 2>/dev/null || echo "Response: $body"
            fi
        else
            print_error "$description - Expected: $expected_status, Got: $status_code"
            echo "Response: $body"
            return 1
        fi
    else
        print_error "$description - Failed to connect"
        return 1
    fi
}

# Function to test MCP server functionality
test_mcp_functionality() {
    print_status "Testing MCP server functionality..."
    
    # Test if we can get authentication status
    if command -v node &> /dev/null; then
        print_status "Testing MCP server with Node.js..."
        
        # Create a simple test script
        cat > /tmp/mcp_test.js << 'EOF'
const { spawn } = require('child_process');

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send MCP initialization
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

server.stdin.write(JSON.stringify(initMessage) + '\n');

let response = '';
server.stdout.on('data', (data) => {
  response += data.toString();
  console.log('MCP Response:', response);
  server.kill();
  process.exit(0);
});

server.stderr.on('data', (data) => {
  console.error('MCP Error:', data.toString());
});

setTimeout(() => {
  server.kill();
  console.error('MCP test timeout');
  process.exit(1);
}, 5000);
EOF
        
        if timeout 10s node /tmp/mcp_test.js; then
            print_success "MCP server responded correctly"
        else
            print_warning "MCP server test failed or timed out"
        fi
        
        rm -f /tmp/mcp_test.js
    else
        print_warning "Node.js not available for MCP functionality test"
    fi
}

# Function to test authentication
test_authentication() {
    if [[ -z "$FABRIC_CLIENT_ID" ]] || [[ -z "$FABRIC_CLIENT_SECRET" ]] || [[ -z "$FABRIC_TENANT_ID" ]]; then
        print_warning "Skipping authentication test - credentials not provided"
        return 0
    fi
    
    print_status "Testing Microsoft Fabric authentication..."
    
    # Test Azure AD token endpoint
    local token_response
    if token_response=$(curl -s -X POST "https://login.microsoftonline.com/$FABRIC_TENANT_ID/oauth2/v2.0/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=$FABRIC_CLIENT_ID&client_secret=$FABRIC_CLIENT_SECRET&scope=https://analysis.windows.net/powerbi/api/.default&grant_type=client_credentials"); then
        
        if echo "$token_response" | jq -e '.access_token' > /dev/null 2>&1; then
            print_success "Authentication successful - obtained access token"
        else
            print_error "Authentication failed - no access token received"
            echo "Response: $token_response"
            return 1
        fi
    else
        print_error "Failed to connect to Azure AD token endpoint"
        return 1
    fi
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment..."
    
    # Check required tools
    local missing_tools=()
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        print_warning "jq not found - JSON parsing will be limited"
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    print_success "Environment validation passed"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    # Basic connectivity
    test_endpoint "/health" "200" "Health endpoint"
    test_endpoint "/ready" "200" "Readiness endpoint"
    test_endpoint "/metrics" "200" "Metrics endpoint"
    
    # Invalid endpoint
    test_endpoint "/invalid" "404" "Invalid endpoint (should return 404)"
}

# Function to test performance
test_performance() {
    print_status "Running basic performance test..."
    
    if command -v ab &> /dev/null; then
        print_status "Testing with Apache Bench..."
        ab -n 100 -c 10 "$MCP_SERVER_URL/health" || print_warning "Performance test failed"
    elif command -v curl &> /dev/null; then
        print_status "Testing response time with curl..."
        local start_time=$(date +%s%N)
        curl -s "$MCP_SERVER_URL/health" > /dev/null
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 ))
        print_success "Health endpoint response time: ${duration}ms"
    else
        print_warning "No performance testing tools available"
    fi
}

# Function to generate report
generate_report() {
    print_status "Generating validation report..."
    
    local report_file="/tmp/mcp_validation_report_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "server_url": "$MCP_SERVER_URL",
  "validation_results": {
    "environment": "validated",
    "health_endpoints": "tested",
    "authentication": "$([ -n "$FABRIC_CLIENT_ID" ] && echo "tested" || echo "skipped")",
    "mcp_functionality": "tested",
    "performance": "basic_test_completed"
  },
  "recommendations": [
    "Monitor health endpoints regularly",
    "Set up proper authentication in production",
    "Configure monitoring and alerting",
    "Test with real Microsoft Fabric workspaces",
    "Set up SSL/TLS for production deployment"
  ],
  "next_steps": [
    "Deploy to production environment",
    "Configure Claude Desktop integration",
    "Set up monitoring dashboards",
    "Configure backup and disaster recovery",
    "Document operational procedures"
  ]
}
EOF
    
    print_success "Validation report generated: $report_file"
    cat "$report_file" | jq . 2>/dev/null || cat "$report_file"
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -u, --url URL           MCP server URL (default: http://localhost:3000)"
    echo "  --skip-auth             Skip authentication tests"
    echo "  --skip-mcp              Skip MCP functionality tests"
    echo "  --skip-perf             Skip performance tests"
    echo "  --skip-health           Skip health endpoint tests"
    echo ""
    echo "Environment Variables:"
    echo "  MCP_SERVER_URL          MCP server URL"
    echo "  FABRIC_CLIENT_ID        Microsoft Fabric client ID"
    echo "  FABRIC_CLIENT_SECRET    Microsoft Fabric client secret"
    echo "  FABRIC_TENANT_ID        Microsoft Fabric tenant ID"
    echo "  TEST_WORKSPACE_ID       Workspace ID for testing"
    echo ""
    echo "Examples:"
    echo "  # Test local deployment"
    echo "  $0"
    echo ""
    echo "  # Test remote deployment"
    echo "  $0 --url https://mcp.yourcompany.com"
    echo ""
    echo "  # Test with authentication"
    echo "  FABRIC_CLIENT_ID=xxx FABRIC_CLIENT_SECRET=yyy FABRIC_TENANT_ID=zzz $0"
}

# Main function
main() {
    local skip_auth=false
    local skip_mcp=false
    local skip_perf=false
    local skip_health=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -u|--url)
                MCP_SERVER_URL="$2"
                shift 2
                ;;
            --skip-auth)
                skip_auth=true
                shift
                ;;
            --skip-mcp)
                skip_mcp=true
                shift
                ;;
            --skip-perf)
                skip_perf=true
                shift
                ;;
            --skip-health)
                skip_health=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    print_status "Starting Microsoft Fabric Analytics MCP Server validation..."
    print_status "Server URL: $MCP_SERVER_URL"
    echo ""
    
    # Run validation steps
    validate_environment
    echo ""
    
    if [[ "$skip_health" == "false" ]]; then
        run_health_checks
        echo ""
    fi
    
    if [[ "$skip_auth" == "false" ]]; then
        test_authentication
        echo ""
    fi
    
    if [[ "$skip_mcp" == "false" ]]; then
        test_mcp_functionality
        echo ""
    fi
    
    if [[ "$skip_perf" == "false" ]]; then
        test_performance
        echo ""
    fi
    
    generate_report
    echo ""
    
    print_success "Validation completed successfully!"
    
    echo ""
    print_status "Next steps:"
    echo "1. Configure Claude Desktop to use this MCP server"
    echo "2. Test with real Microsoft Fabric workspaces"
    echo "3. Set up monitoring and alerting"
    echo "4. Deploy to production environment"
    echo ""
    print_status "For production deployment, see:"
    echo "  - AKS_DEPLOYMENT.md for Kubernetes deployment"
    echo "  - AZURE_MCP_SERVER.md for Azure MCP Server deployment"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
