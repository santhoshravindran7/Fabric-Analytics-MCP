#!/bin/bash

# Microsoft Fabric Analytics MCP Server - AKS Deployment Script
# This script deploys the MCP server to Azure Kubernetes Service

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
K8S_DIR="$PROJECT_ROOT/k8s"

# Azure and Kubernetes configuration
AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-fabric-mcp-rg}"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-fabric-mcp-cluster}"
ACR_NAME="${ACR_NAME:-}"
LOCATION="${LOCATION:-eastus}"
IMAGE_VERSION="${IMAGE_VERSION:-latest}"

# Domain and DNS configuration
DOMAIN_NAME="${DOMAIN_NAME:-}"
DNS_RESOURCE_GROUP="${DNS_RESOURCE_GROUP:-$RESOURCE_GROUP}"

# Microsoft Fabric configuration
FABRIC_CLIENT_ID="${FABRIC_CLIENT_ID:-}"
FABRIC_CLIENT_SECRET="${FABRIC_CLIENT_SECRET:-}"
FABRIC_TENANT_ID="${FABRIC_TENANT_ID:-}"
FABRIC_DEFAULT_WORKSPACE_ID="${FABRIC_DEFAULT_WORKSPACE_ID:-}"

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
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if helm is installed (optional but recommended)
    if ! command -v helm &> /dev/null; then
        print_warning "Helm is not installed. Some advanced features may not be available"
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
        exit 1
    fi
    
    if [[ -z "$FABRIC_CLIENT_ID" ]] || [[ -z "$FABRIC_CLIENT_SECRET" ]] || [[ -z "$FABRIC_TENANT_ID" ]]; then
        print_error "Microsoft Fabric authentication variables are not set"
        print_error "Please set FABRIC_CLIENT_ID, FABRIC_CLIENT_SECRET, and FABRIC_TENANT_ID"
        exit 1
    fi
    
    if [[ -z "$AZURE_SUBSCRIPTION_ID" ]]; then
        print_warning "AZURE_SUBSCRIPTION_ID not set, using current subscription"
        AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    fi
    
    print_success "Configuration validation passed"
}

# Function to create or update resource group
create_resource_group() {
    print_status "Creating resource group..."
    
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --subscription "$AZURE_SUBSCRIPTION_ID" \
        --output table
    
    print_success "Resource group created/updated"
}

# Function to create Azure Container Registry
create_acr() {
    print_status "Creating Azure Container Registry..."
    
    # Check if ACR already exists
    if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_status "ACR $ACR_NAME already exists"
    else
        az acr create \
            --name "$ACR_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku Standard \
            --admin-enabled true \
            --output table
        
        print_success "ACR created successfully"
    fi
}

# Function to create AKS cluster
create_aks_cluster() {
    print_status "Creating AKS cluster..."
    
    # Check if AKS cluster already exists
    if az aks show --name "$AKS_CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_status "AKS cluster $AKS_CLUSTER_NAME already exists"
    else
        az aks create \
            --name "$AKS_CLUSTER_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --node-count 3 \
            --node-vm-size Standard_D2s_v3 \
            --enable-managed-identity \
            --attach-acr "$ACR_NAME" \
            --enable-addons monitoring \
            --enable-cluster-autoscaler \
            --min-count 1 \
            --max-count 10 \
            --kubernetes-version "1.28" \
            --network-plugin azure \
            --network-policy azure \
            --output table
        
        print_success "AKS cluster created successfully"
    fi
}

# Function to configure kubectl
configure_kubectl() {
    print_status "Configuring kubectl..."
    
    az aks get-credentials \
        --name "$AKS_CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --overwrite-existing
    
    # Test connection
    kubectl cluster-info
    
    print_success "kubectl configured successfully"
}

# Function to install ingress controller
install_ingress_controller() {
    print_status "Installing NGINX Ingress Controller..."
    
    # Add NGINX Ingress Helm repository
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Install NGINX Ingress Controller
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.type=LoadBalancer \
        --set controller.service.externalTrafficPolicy=Local \
        --set controller.metrics.enabled=true \
        --set controller.podSecurityContext.runAsUser=101 \
        --wait
    
    print_success "NGINX Ingress Controller installed"
}

# Function to install cert-manager
install_cert_manager() {
    print_status "Installing cert-manager..."
    
    # Add cert-manager Helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set installCRDs=true \
        --wait
    
    print_success "cert-manager installed"
}

# Function to update Kubernetes manifests with actual values
update_manifests() {
    print_status "Updating Kubernetes manifests with configuration..."
    
    local temp_dir="/tmp/fabric-mcp-manifests"
    rm -rf "$temp_dir"
    mkdir -p "$temp_dir"
    
    # Copy manifests to temp directory
    cp -r "$K8S_DIR"/* "$temp_dir/"
    
    # Update ACR image reference in deployment.yaml
    local acr_image="${ACR_NAME}.azurecr.io/fabric-analytics-mcp:${IMAGE_VERSION}"
    sed -i "s|your-acr-registry.azurecr.io/fabric-analytics-mcp:latest|${acr_image}|g" "$temp_dir/deployment.yaml"
    
    # Update domain in ingress.yaml if provided
    if [[ -n "$DOMAIN_NAME" ]]; then
        sed -i "s|fabric-mcp.your-domain.com|fabric-mcp.${DOMAIN_NAME}|g" "$temp_dir/ingress.yaml"
        sed -i "s|api.fabric-mcp.your-domain.com|api.fabric-mcp.${DOMAIN_NAME}|g" "$temp_dir/ingress.yaml"
        sed -i "s|fabric-mcp-appgw.your-domain.com|fabric-mcp-appgw.${DOMAIN_NAME}|g" "$temp_dir/ingress.yaml"
    fi
    
    echo "$temp_dir"
}

# Function to create Kubernetes secrets
create_secrets() {
    print_status "Creating Kubernetes secrets..."
    
    # Create namespace first
    kubectl apply -f "$1/namespace.yaml"
    
    # Create secret with Microsoft Fabric credentials
    kubectl create secret generic fabric-mcp-secrets \
        --namespace=fabric-mcp \
        --from-literal=FABRIC_CLIENT_ID="$FABRIC_CLIENT_ID" \
        --from-literal=FABRIC_CLIENT_SECRET="$FABRIC_CLIENT_SECRET" \
        --from-literal=FABRIC_TENANT_ID="$FABRIC_TENANT_ID" \
        --from-literal=FABRIC_DEFAULT_WORKSPACE_ID="$FABRIC_DEFAULT_WORKSPACE_ID" \
        --from-literal=JWT_SECRET="$(openssl rand -base64 32)" \
        --from-literal=API_KEY="$(openssl rand -base64 32)" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Secrets created successfully"
}

# Function to deploy to Kubernetes
deploy_to_kubernetes() {
    print_status "Deploying to Kubernetes..."
    
    local manifest_dir="$1"
    
    # Apply manifests in order
    kubectl apply -f "$manifest_dir/namespace.yaml"
    kubectl apply -f "$manifest_dir/rbac.yaml"
    kubectl apply -f "$manifest_dir/configmap.yaml"
    kubectl apply -f "$manifest_dir/deployment.yaml"
    kubectl apply -f "$manifest_dir/service.yaml"
    kubectl apply -f "$manifest_dir/hpa.yaml"
    
    # Apply ingress if domain is configured
    if [[ -n "$DOMAIN_NAME" ]]; then
        kubectl apply -f "$manifest_dir/ingress.yaml"
    fi
    
    print_success "Application deployed to Kubernetes"
}

# Function to wait for deployment
wait_for_deployment() {
    print_status "Waiting for deployment to be ready..."
    
    kubectl wait --for=condition=available deployment/fabric-analytics-mcp \
        --namespace=fabric-mcp \
        --timeout=300s
    
    print_success "Deployment is ready"
}

# Function to get service information
get_service_info() {
    print_status "Getting service information..."
    
    echo ""
    print_status "Service Status:"
    kubectl get services -n fabric-mcp -o wide
    
    echo ""
    print_status "Pod Status:"
    kubectl get pods -n fabric-mcp -o wide
    
    echo ""
    print_status "Ingress Status:"
    kubectl get ingress -n fabric-mcp -o wide
    
    # Get LoadBalancer IP
    local lb_ip=$(kubectl get service fabric-analytics-mcp-service -n fabric-mcp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [[ -n "$lb_ip" ]]; then
        echo ""
        print_success "Service accessible at: http://$lb_ip"
        if [[ -n "$DOMAIN_NAME" ]]; then
            print_status "Once DNS is configured, also available at: https://fabric-mcp.$DOMAIN_NAME"
        fi
    fi
}

# Function to cleanup temp files
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -rf "/tmp/fabric-mcp-manifests" || true
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  --skip-cluster          Skip AKS cluster creation"
    echo "  --skip-acr              Skip ACR creation"
    echo "  --skip-ingress          Skip ingress controller installation"
    echo "  --skip-cert-manager     Skip cert-manager installation"
    echo "  --update-only           Only update the application (skip infrastructure)"
    echo ""
    echo "Environment Variables:"
    echo "  AZURE_SUBSCRIPTION_ID     Azure subscription ID"
    echo "  RESOURCE_GROUP            Azure resource group (default: fabric-mcp-rg)"
    echo "  AKS_CLUSTER_NAME          AKS cluster name (default: fabric-mcp-cluster)"
    echo "  ACR_NAME                  Azure Container Registry name (required)"
    echo "  LOCATION                  Azure region (default: eastus)"
    echo "  IMAGE_VERSION             Docker image version (default: latest)"
    echo "  DOMAIN_NAME               Your domain name for ingress"
    echo "  FABRIC_CLIENT_ID          Microsoft Fabric client ID (required)"
    echo "  FABRIC_CLIENT_SECRET      Microsoft Fabric client secret (required)"
    echo "  FABRIC_TENANT_ID          Microsoft Fabric tenant ID (required)"
    echo "  FABRIC_DEFAULT_WORKSPACE_ID  Default workspace ID (optional)"
    echo ""
    echo "Examples:"
    echo "  # Full deployment"
    echo "  ACR_NAME=myregistry FABRIC_CLIENT_ID=xxx FABRIC_CLIENT_SECRET=yyy FABRIC_TENANT_ID=zzz $0"
    echo ""
    echo "  # Update existing deployment"
    echo "  ACR_NAME=myregistry $0 --update-only"
    echo ""
    echo "  # Skip infrastructure components"
    echo "  ACR_NAME=myregistry $0 --skip-cluster --skip-acr"
}

# Main function
main() {
    local skip_cluster=false
    local skip_acr=false
    local skip_ingress=false
    local skip_cert_manager=false
    local update_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            --skip-cluster)
                skip_cluster=true
                shift
                ;;
            --skip-acr)
                skip_acr=true
                shift
                ;;
            --skip-ingress)
                skip_ingress=true
                shift
                ;;
            --skip-cert-manager)
                skip_cert_manager=true
                shift
                ;;
            --update-only)
                update_only=true
                skip_cluster=true
                skip_acr=true
                skip_ingress=true
                skip_cert_manager=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    print_status "Starting AKS deployment process..."
    
    # Run the deployment process
    check_prerequisites
    validate_config
    
    # Set Azure subscription
    az account set --subscription "$AZURE_SUBSCRIPTION_ID"
    
    if [[ "$skip_acr" == "false" ]]; then
        create_resource_group
        create_acr
    fi
    
    if [[ "$skip_cluster" == "false" ]]; then
        create_aks_cluster
    fi
    
    configure_kubectl
    
    if [[ "$skip_ingress" == "false" ]]; then
        install_ingress_controller
    fi
    
    if [[ "$skip_cert_manager" == "false" ]]; then
        install_cert_manager
    fi
    
    # Update manifests and deploy
    local manifest_dir=$(update_manifests)
    create_secrets "$manifest_dir"
    deploy_to_kubernetes "$manifest_dir"
    wait_for_deployment
    get_service_info
    
    # Cleanup
    trap cleanup EXIT
    
    print_success "AKS deployment completed successfully!"
    
    echo ""
    print_status "Next Steps:"
    echo "1. Configure DNS to point your domain to the LoadBalancer IP"
    echo "2. Update your Claude Desktop configuration to use the new endpoint"
    echo "3. Monitor the deployment with: kubectl get pods -n fabric-mcp -w"
    echo "4. View logs with: kubectl logs -f deployment/fabric-analytics-mcp -n fabric-mcp"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
