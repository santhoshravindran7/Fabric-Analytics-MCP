#!/bin/bash

# Microsoft Fabric Analytics MCP Server - Docker Build and Push Script
# This script builds the Docker image and pushes it to Azure Container Registry

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="fabric-analytics-mcp"
VERSION="${VERSION:-latest}"

# Azure Container Registry configuration
ACR_NAME="${ACR_NAME:-}"
AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-fabric-mcp-rg}"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check if logged into Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged into Azure. Please run 'az login' first"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to validate configuration
validate_config() {
    print_status "Validating configuration..."
    
    if [[ -z "$ACR_NAME" ]]; then
        print_error "ACR_NAME environment variable is not set"
        print_status "Please set ACR_NAME to your Azure Container Registry name"
        exit 1
    fi
    
    if [[ -z "$AZURE_SUBSCRIPTION_ID" ]]; then
        print_warning "AZURE_SUBSCRIPTION_ID not set, using current subscription"
        AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    fi
    
    print_success "Configuration validation passed"
}

# Function to build Docker image
build_image() {
    print_status "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    
    # Build the image
    docker build \
        --tag "${IMAGE_NAME}:${VERSION}" \
        --tag "${IMAGE_NAME}:latest" \
        --label "version=${VERSION}" \
        --label "build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --label "git-commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        --label "git-branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')" \
        .
    
    print_success "Docker image built successfully"
}

# Function to test the image
test_image() {
    print_status "Testing Docker image..."
    
    # Run a quick test to ensure the image starts properly
    CONTAINER_ID=$(docker run -d --rm -p 3000:3000 "${IMAGE_NAME}:${VERSION}")
    
    # Wait a few seconds for the container to start
    sleep 5
    
    # Check if container is still running
    if docker ps | grep -q "$CONTAINER_ID"; then
        print_success "Image test passed"
        docker stop "$CONTAINER_ID" || true
    else
        print_error "Image test failed - container exited"
        docker logs "$CONTAINER_ID" || true
        exit 1
    fi
}

# Function to login to Azure Container Registry
acr_login() {
    print_status "Logging into Azure Container Registry..."
    
    # Set the subscription
    az account set --subscription "$AZURE_SUBSCRIPTION_ID"
    
    # Login to ACR
    az acr login --name "$ACR_NAME"
    
    print_success "Successfully logged into ACR"
}

# Function to tag and push image
push_image() {
    print_status "Tagging and pushing image to ACR..."
    
    local acr_url="${ACR_NAME}.azurecr.io"
    local full_image_name="${acr_url}/${IMAGE_NAME}"
    
    # Tag the image for ACR
    docker tag "${IMAGE_NAME}:${VERSION}" "${full_image_name}:${VERSION}"
    docker tag "${IMAGE_NAME}:${VERSION}" "${full_image_name}:latest"
    
    # Push the images
    docker push "${full_image_name}:${VERSION}"
    docker push "${full_image_name}:latest"
    
    print_success "Image pushed successfully to ${full_image_name}:${VERSION}"
    
    # Output the full image name for use in deployment
    echo ""
    print_status "Image ready for deployment:"
    echo "  ${full_image_name}:${VERSION}"
    echo "  ${full_image_name}:latest"
}

# Function to cleanup local images (optional)
cleanup() {
    if [[ "${CLEANUP_LOCAL:-false}" == "true" ]]; then
        print_status "Cleaning up local images..."
        docker rmi "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:latest" || true
        print_success "Local images cleaned up"
    fi
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -v, --version VERSION   Set image version (default: latest)"
    echo "  -t, --test              Run image tests after build"
    echo "  -c, --cleanup           Cleanup local images after push"
    echo "  --no-push               Build only, don't push to registry"
    echo ""
    echo "Environment Variables:"
    echo "  ACR_NAME                Azure Container Registry name (required)"
    echo "  AZURE_SUBSCRIPTION_ID   Azure subscription ID (optional)"
    echo "  RESOURCE_GROUP          Azure resource group (default: fabric-mcp-rg)"
    echo "  VERSION                 Image version (default: latest)"
    echo "  CLEANUP_LOCAL           Cleanup local images after push (default: false)"
    echo ""
    echo "Examples:"
    echo "  ACR_NAME=myregistry $0"
    echo "  ACR_NAME=myregistry $0 --version v1.0.0 --test"
    echo "  ACR_NAME=myregistry $0 --no-push"
}

# Main function
main() {
    local run_tests=false
    local push_to_registry=true
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -t|--test)
                run_tests=true
                shift
                ;;
            -c|--cleanup)
                CLEANUP_LOCAL=true
                shift
                ;;
            --no-push)
                push_to_registry=false
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    print_status "Starting Docker build and push process..."
    
    # Run the build process
    check_prerequisites
    validate_config
    build_image
    
    if [[ "$run_tests" == "true" ]]; then
        test_image
    fi
    
    if [[ "$push_to_registry" == "true" ]]; then
        acr_login
        push_image
    else
        print_status "Skipping push to registry (--no-push specified)"
    fi
    
    cleanup
    
    print_success "Build and push process completed successfully!"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
