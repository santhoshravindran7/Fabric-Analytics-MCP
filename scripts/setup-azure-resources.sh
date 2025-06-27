#!/bin/bash

# Microsoft Fabric Analytics MCP Server - Azure Resources Setup Script
# This script creates all necessary Azure resources for the MCP server deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-fabric-mcp-rg}"
LOCATION="${LOCATION:-eastus}"
ACR_NAME="${ACR_NAME:-}"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-fabric-mcp-cluster}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-fabric-mcp-kv-$(date +%s)}"
MANAGED_IDENTITY_NAME="${MANAGED_IDENTITY_NAME:-fabric-mcp-identity}"
LOG_ANALYTICS_WORKSPACE="${LOG_ANALYTICS_WORKSPACE:-fabric-mcp-logs}"

# DNS and Domain configuration
DOMAIN_NAME="${DOMAIN_NAME:-}"
DNS_ZONE_NAME="${DNS_ZONE_NAME:-}"
DNS_RESOURCE_GROUP="${DNS_RESOURCE_GROUP:-$RESOURCE_GROUP}"

# Application Gateway configuration
APP_GATEWAY_NAME="${APP_GATEWAY_NAME:-fabric-mcp-appgw}"
PUBLIC_IP_NAME="${PUBLIC_IP_NAME:-fabric-mcp-pip}"
VNET_NAME="${VNET_NAME:-fabric-mcp-vnet}"
SUBNET_NAME="${SUBNET_NAME:-fabric-mcp-subnet}"
APP_GATEWAY_SUBNET_NAME="${APP_GATEWAY_SUBNET_NAME:-appgw-subnet}"

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
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed or not in PATH"
        exit 1
    fi
    
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
    
    if [[ -z "$AZURE_SUBSCRIPTION_ID" ]]; then
        print_warning "AZURE_SUBSCRIPTION_ID not set, using current subscription"
        AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    fi
    
    # Ensure Key Vault name is globally unique
    if [[ ${#KEY_VAULT_NAME} -gt 24 ]]; then
        KEY_VAULT_NAME="${KEY_VAULT_NAME:0:24}"
    fi
    
    print_success "Configuration validation passed"
}

# Function to create resource group
create_resource_group() {
    print_status "Creating resource group: $RESOURCE_GROUP"
    
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --subscription "$AZURE_SUBSCRIPTION_ID" \
        --tags \
            project="fabric-analytics-mcp" \
            environment="production" \
            created-by="$(az account show --query user.name -o tsv)" \
            created-date="$(date -u +%Y-%m-%d)" \
        --output table
    
    print_success "Resource group created"
}

# Function to create Log Analytics workspace
create_log_analytics() {
    print_status "Creating Log Analytics workspace: $LOG_ANALYTICS_WORKSPACE"
    
    az monitor log-analytics workspace create \
        --resource-group "$RESOURCE_GROUP" \
        --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
        --location "$LOCATION" \
        --sku PerGB2018 \
        --retention-time 30 \
        --output table
    
    print_success "Log Analytics workspace created"
}

# Function to create managed identity
create_managed_identity() {
    print_status "Creating managed identity: $MANAGED_IDENTITY_NAME"
    
    az identity create \
        --name "$MANAGED_IDENTITY_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output table
    
    # Get the identity details
    local identity_id=$(az identity show --name "$MANAGED_IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
    local client_id=$(az identity show --name "$MANAGED_IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query clientId -o tsv)
    local principal_id=$(az identity show --name "$MANAGED_IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query principalId -o tsv)
    
    print_success "Managed identity created"
    print_status "Identity ID: $identity_id"
    print_status "Client ID: $client_id"
    print_status "Principal ID: $principal_id"
    
    # Export for use in other functions
    export MANAGED_IDENTITY_ID="$identity_id"
    export MANAGED_IDENTITY_CLIENT_ID="$client_id"
    export MANAGED_IDENTITY_PRINCIPAL_ID="$principal_id"
}

# Function to create Key Vault
create_key_vault() {
    print_status "Creating Key Vault: $KEY_VAULT_NAME"
    
    az keyvault create \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku standard \
        --enable-rbac-authorization true \
        --enable-soft-delete true \
        --soft-delete-retention-days 7 \
        --enable-purge-protection false \
        --output table
    
    # Grant the managed identity access to Key Vault
    print_status "Granting managed identity access to Key Vault..."
    
    local vault_id=$(az keyvault show --name "$KEY_VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
    
    az role assignment create \
        --assignee "$MANAGED_IDENTITY_PRINCIPAL_ID" \
        --role "Key Vault Secrets User" \
        --scope "$vault_id" \
        --output table
    
    print_success "Key Vault created and configured"
}

# Function to create virtual network
create_virtual_network() {
    print_status "Creating virtual network: $VNET_NAME"
    
    # Create VNet
    az network vnet create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$VNET_NAME" \
        --location "$LOCATION" \
        --address-prefixes 10.0.0.0/16 \
        --output table
    
    # Create AKS subnet
    az network vnet subnet create \
        --resource-group "$RESOURCE_GROUP" \
        --vnet-name "$VNET_NAME" \
        --name "$SUBNET_NAME" \
        --address-prefixes 10.0.1.0/24 \
        --output table
    
    # Create Application Gateway subnet
    az network vnet subnet create \
        --resource-group "$RESOURCE_GROUP" \
        --vnet-name "$VNET_NAME" \
        --name "$APP_GATEWAY_SUBNET_NAME" \
        --address-prefixes 10.0.2.0/24 \
        --output table
    
    print_success "Virtual network created"
}

# Function to create public IP for Application Gateway
create_public_ip() {
    print_status "Creating public IP: $PUBLIC_IP_NAME"
    
    az network public-ip create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$PUBLIC_IP_NAME" \
        --location "$LOCATION" \
        --allocation-method Static \
        --sku Standard \
        --dns-name "fabric-mcp-$(date +%s)" \
        --output table
    
    local public_ip=$(az network public-ip show --resource-group "$RESOURCE_GROUP" --name "$PUBLIC_IP_NAME" --query ipAddress -o tsv)
    local fqdn=$(az network public-ip show --resource-group "$RESOURCE_GROUP" --name "$PUBLIC_IP_NAME" --query dnsSettings.fqdn -o tsv)
    
    print_success "Public IP created: $public_ip"
    print_status "FQDN: $fqdn"
    
    export PUBLIC_IP_ADDRESS="$public_ip"
    export PUBLIC_IP_FQDN="$fqdn"
}

# Function to create Application Gateway
create_application_gateway() {
    print_status "Creating Application Gateway: $APP_GATEWAY_NAME"
    
    # Get subnet ID
    local subnet_id=$(az network vnet subnet show \
        --resource-group "$RESOURCE_GROUP" \
        --vnet-name "$VNET_NAME" \
        --name "$APP_GATEWAY_SUBNET_NAME" \
        --query id -o tsv)
    
    # Create Application Gateway
    az network application-gateway create \
        --name "$APP_GATEWAY_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --capacity 2 \
        --sku Standard_v2 \
        --public-ip-address "$PUBLIC_IP_NAME" \
        --subnet "$subnet_id" \
        --servers "10.0.1.10" \
        --output table
    
    print_success "Application Gateway created"
}

# Function to create Azure Container Registry
create_acr() {
    print_status "Creating Azure Container Registry: $ACR_NAME"
    
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
    
    # Grant managed identity access to ACR
    print_status "Granting managed identity access to ACR..."
    
    local acr_id=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
    
    az role assignment create \
        --assignee "$MANAGED_IDENTITY_PRINCIPAL_ID" \
        --role "AcrPull" \
        --scope "$acr_id" \
        --output table
}

# Function to create AKS cluster
create_aks_cluster() {
    print_status "Creating AKS cluster: $AKS_CLUSTER_NAME"
    
    # Get subnet ID
    local subnet_id=$(az network vnet subnet show \
        --resource-group "$RESOURCE_GROUP" \
        --vnet-name "$VNET_NAME" \
        --name "$SUBNET_NAME" \
        --query id -o tsv)
    
    # Get Log Analytics workspace ID
    local workspace_id=$(az monitor log-analytics workspace show \
        --resource-group "$RESOURCE_GROUP" \
        --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
        --query id -o tsv)
    
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
            --assign-identity "$MANAGED_IDENTITY_ID" \
            --attach-acr "$ACR_NAME" \
            --enable-addons monitoring \
            --workspace-resource-id "$workspace_id" \
            --enable-cluster-autoscaler \
            --min-count 1 \
            --max-count 10 \
            --kubernetes-version "1.28" \
            --network-plugin azure \
            --network-policy azure \
            --vnet-subnet-id "$subnet_id" \
            --service-cidr 10.2.0.0/24 \
            --dns-service-ip 10.2.0.10 \
            --output table
        
        print_success "AKS cluster created successfully"
    fi
}

# Function to create DNS zone (if domain is provided)
create_dns_zone() {
    if [[ -n "$DOMAIN_NAME" ]]; then
        print_status "Creating DNS zone for domain: $DOMAIN_NAME"
        
        # Use domain name as DNS zone name if not provided
        if [[ -z "$DNS_ZONE_NAME" ]]; then
            DNS_ZONE_NAME="$DOMAIN_NAME"
        fi
        
        # Check if DNS zone already exists
        if az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$DNS_RESOURCE_GROUP" &> /dev/null; then
            print_status "DNS zone $DNS_ZONE_NAME already exists"
        else
            az network dns zone create \
                --name "$DNS_ZONE_NAME" \
                --resource-group "$DNS_RESOURCE_GROUP" \
                --output table
            
            print_success "DNS zone created"
        fi
        
        # Create A record pointing to public IP
        if [[ -n "${PUBLIC_IP_ADDRESS:-}" ]]; then
            print_status "Creating DNS A record..."
            
            az network dns record-set a add-record \
                --resource-group "$DNS_RESOURCE_GROUP" \
                --zone-name "$DNS_ZONE_NAME" \
                --record-set-name "fabric-mcp" \
                --ipv4-address "$PUBLIC_IP_ADDRESS" \
                --output table
            
            az network dns record-set a add-record \
                --resource-group "$DNS_RESOURCE_GROUP" \
                --zone-name "$DNS_ZONE_NAME" \
                --record-set-name "api.fabric-mcp" \
                --ipv4-address "$PUBLIC_IP_ADDRESS" \
                --output table
            
            print_success "DNS A records created"
        fi
    fi
}

# Function to output summary
output_summary() {
    echo ""
    print_success "Azure resources setup completed!"
    echo ""
    print_status "Resource Summary:"
    echo "  Resource Group: $RESOURCE_GROUP"
    echo "  Location: $LOCATION"
    echo "  ACR Name: $ACR_NAME"
    echo "  AKS Cluster: $AKS_CLUSTER_NAME"
    echo "  Key Vault: $KEY_VAULT_NAME"
    echo "  Managed Identity: $MANAGED_IDENTITY_NAME"
    echo "  Log Analytics: $LOG_ANALYTICS_WORKSPACE"
    echo "  Virtual Network: $VNET_NAME"
    echo "  Application Gateway: $APP_GATEWAY_NAME"
    echo "  Public IP: ${PUBLIC_IP_ADDRESS:-'Not created'}"
    
    if [[ -n "$DOMAIN_NAME" ]]; then
        echo "  Domain: $DOMAIN_NAME"
        echo "  DNS Zone: $DNS_ZONE_NAME"
    fi
    
    echo ""
    print_status "Next Steps:"
    echo "1. Store your Microsoft Fabric credentials in Key Vault:"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name fabric-client-id --value 'your-client-id'"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name fabric-client-secret --value 'your-client-secret'"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name fabric-tenant-id --value 'your-tenant-id'"
    echo ""
    echo "2. Build and push your Docker image:"
    echo "   ACR_NAME=$ACR_NAME ./scripts/build-and-push.sh"
    echo ""
    echo "3. Deploy to AKS:"
    echo "   ACR_NAME=$ACR_NAME AKS_CLUSTER_NAME=$AKS_CLUSTER_NAME ./scripts/deploy-to-aks.sh"
    
    if [[ -n "$DOMAIN_NAME" ]]; then
        echo ""
        echo "4. Configure your domain's nameservers to point to Azure DNS:"
        local nameservers=$(az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$DNS_RESOURCE_GROUP" --query nameServers -o tsv 2>/dev/null | tr '\n' ' ')
        if [[ -n "$nameservers" ]]; then
            echo "   Nameservers: $nameservers"
        fi
    fi
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  --skip-networking       Skip VNet and Application Gateway creation"
    echo "  --skip-dns              Skip DNS zone creation"
    echo "  --skip-aks              Skip AKS cluster creation"
    echo "  --skip-acr              Skip ACR creation"
    echo ""
    echo "Environment Variables:"
    echo "  AZURE_SUBSCRIPTION_ID     Azure subscription ID"
    echo "  RESOURCE_GROUP            Azure resource group (default: fabric-mcp-rg)"
    echo "  LOCATION                  Azure region (default: eastus)"
    echo "  ACR_NAME                  Azure Container Registry name (required)"
    echo "  AKS_CLUSTER_NAME          AKS cluster name (default: fabric-mcp-cluster)"
    echo "  KEY_VAULT_NAME            Key Vault name (auto-generated if not set)"
    echo "  MANAGED_IDENTITY_NAME     Managed identity name (default: fabric-mcp-identity)"
    echo "  LOG_ANALYTICS_WORKSPACE   Log Analytics workspace name (default: fabric-mcp-logs)"
    echo "  DOMAIN_NAME               Your domain name for DNS configuration"
    echo "  DNS_ZONE_NAME             DNS zone name (defaults to DOMAIN_NAME)"
    echo "  DNS_RESOURCE_GROUP        DNS resource group (defaults to RESOURCE_GROUP)"
    echo ""
    echo "Examples:"
    echo "  # Create all resources"
    echo "  ACR_NAME=myregistry $0"
    echo ""
    echo "  # Create with custom domain"
    echo "  ACR_NAME=myregistry DOMAIN_NAME=example.com $0"
    echo ""
    echo "  # Skip networking components"
    echo "  ACR_NAME=myregistry $0 --skip-networking"
}

# Main function
main() {
    local skip_networking=false
    local skip_dns=false
    local skip_aks=false
    local skip_acr=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            --skip-networking)
                skip_networking=true
                shift
                ;;
            --skip-dns)
                skip_dns=true
                shift
                ;;
            --skip-aks)
                skip_aks=true
                shift
                ;;
            --skip-acr)
                skip_acr=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    print_status "Starting Azure resources setup..."
    
    # Run the setup process
    check_prerequisites
    validate_config
    
    # Set Azure subscription
    az account set --subscription "$AZURE_SUBSCRIPTION_ID"
    
    # Create resources
    create_resource_group
    create_log_analytics
    create_managed_identity
    create_key_vault
    
    if [[ "$skip_networking" == "false" ]]; then
        create_virtual_network
        create_public_ip
        create_application_gateway
    fi
    
    if [[ "$skip_acr" == "false" ]]; then
        create_acr
    fi
    
    if [[ "$skip_aks" == "false" ]]; then
        create_aks_cluster
    fi
    
    if [[ "$skip_dns" == "false" ]]; then
        create_dns_zone
    fi
    
    output_summary
    
    print_success "Azure resources setup completed successfully!"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
