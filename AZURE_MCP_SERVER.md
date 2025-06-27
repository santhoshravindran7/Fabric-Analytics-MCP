# Azure Model Context Protocol Server Deployment Guide

Microsoft Azure now offers a preview service for hosting MCP servers natively, eliminating the need for custom infrastructure management. This guide covers deploying the Microsoft Fabric Analytics MCP Server using Azure's managed MCP service.

## 📋 **Table of Contents**

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment Options](#deployment-options)
- [Monitoring & Management](#monitoring--management)
- [Security](#security)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)
- [Migration from Self-Hosted](#migration-from-self-hosted)

## 🌟 **Overview**

Azure Model Context Protocol Server (Preview) provides:

- **Serverless MCP hosting** with automatic scaling
- **Built-in authentication** and authorization
- **Global CDN distribution** for low latency
- **Integrated monitoring** and logging
- **Zero infrastructure management**
- **Pay-per-request pricing** model
- **Automatic SSL/TLS** certificates
- **Built-in secrets management**

## 🔧 **Prerequisites**

### **Azure Requirements**
- Azure subscription with preview access
- Azure CLI v2.45.0 or later with MCP extension
- Resource group creation permissions
- Azure AD application registration permissions

### **Preview Access**
```bash
# Request preview access
az feature register --namespace Microsoft.MCP --name ServerHosting

# Check status
az feature show --namespace Microsoft.MCP --name ServerHosting

# Install MCP CLI extension
az extension add --name mcp-preview
```

### **Microsoft Fabric Requirements**
- Azure AD application (Service Principal) with Fabric permissions
- Microsoft Fabric workspace access
- Required API permissions configured

## 🚀 **Quick Start**

### **1. Setup Authentication**
```bash
# Set environment variables
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export RESOURCE_GROUP="fabric-mcp-rg"
export MCP_SERVER_NAME="fabric-analytics-mcp"

# Microsoft Fabric credentials
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
export FABRIC_TENANT_ID="your-tenant-id"
```

### **2. Deploy MCP Server**
```bash
# Create resource group
az group create --name $RESOURCE_GROUP --location eastus

# Deploy from GitHub repository
az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP" \
  --branch "main" \
  --runtime "node" \
  --runtime-version "18" \
  --auth-method "service-principal"
```

### **3. Configure Secrets**
```bash
# Set authentication secrets
az mcp server config set \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting "FABRIC_AUTH_METHOD=service_principal" \
  --setting "FABRIC_CLIENT_ID=$FABRIC_CLIENT_ID" \
  --secret "FABRIC_CLIENT_SECRET=$FABRIC_CLIENT_SECRET" \
  --setting "FABRIC_TENANT_ID=$FABRIC_TENANT_ID"
```

### **4. Get Endpoint**
```bash
# Get the server endpoint
az mcp server show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "endpoint" \
  --output tsv
```

## ⚙️ **Configuration**

### **Deployment Configuration**

**Basic Configuration**:
```bash
az mcp server create \
  --name "fabric-analytics-mcp" \
  --resource-group "fabric-mcp-rg" \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP" \
  --branch "main" \
  --runtime "node" \
  --runtime-version "18" \
  --region "eastus" \
  --scaling-mode "automatic" \
  --min-instances 0 \
  --max-instances 10
```

**Advanced Configuration**:
```bash
az mcp server create \
  --name "fabric-analytics-mcp" \
  --resource-group "fabric-mcp-rg" \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP" \
  --branch "main" \
  --runtime "node" \
  --runtime-version "18" \
  --region "eastus" \
  --scaling-mode "automatic" \
  --min-instances 1 \
  --max-instances 20 \
  --memory "512Mi" \
  --cpu "0.5" \
  --timeout 30 \
  --custom-domain "mcp.yourcompany.com" \
  --enable-monitoring true \
  --enable-logging true
```

### **Environment Variables**

```bash
# Application settings (non-sensitive)
az mcp server config set \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting "NODE_ENV=production" \
  --setting "LOG_LEVEL=info" \
  --setting "FABRIC_AUTH_METHOD=service_principal" \
  --setting "FABRIC_API_BASE_URL=https://api.fabric.microsoft.com" \
  --setting "FABRIC_API_VERSION=v1"

# Secrets (sensitive data)
az mcp server config set \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --secret "FABRIC_CLIENT_ID=$FABRIC_CLIENT_ID" \
  --secret "FABRIC_CLIENT_SECRET=$FABRIC_CLIENT_SECRET" \
  --secret "FABRIC_TENANT_ID=$FABRIC_TENANT_ID"
```

### **Custom Domain Configuration**

```bash
# Add custom domain
az mcp server domain add \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --domain "mcp.yourcompany.com" \
  --certificate-source "managed"

# Verify domain
az mcp server domain verify \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --domain "mcp.yourcompany.com"
```

## 🚀 **Deployment Options**

### **GitHub Integration**

**Automatic Deployment**:
```bash
# Deploy with automatic updates
az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP" \
  --branch "main" \
  --auto-sync true \
  --sync-interval "5m"
```

**Manual Deployment**:
```bash
# Deploy specific commit
az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP" \
  --commit "abc123def456" \
  --auto-sync false
```

### **Container Image Deployment**

```bash
# Deploy from container registry
az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --source-type "container" \
  --image "youracr.azurecr.io/fabric-analytics-mcp:latest" \
  --registry-username "your-username" \
  --registry-password "your-password"
```

### **ZIP Package Deployment**

```bash
# Package and deploy
npm run build
zip -r mcp-server.zip build/ package.json

az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --source-type "package" \
  --package-path "./mcp-server.zip" \
  --entry-point "build/index.js"
```

## 📊 **Monitoring & Management**

### **Built-in Monitoring**

**View Server Status**:
```bash
# Get server details
az mcp server show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP

# Check deployment status
az mcp server deployment list \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP

# View metrics
az mcp server metrics show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-31T23:59:59Z"
```

**Log Analysis**:
```bash
# View application logs
az mcp server logs show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --lines 100 \
  --follow

# Filter logs by level
az mcp server logs show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --level "error" \
  --start-time "2024-01-01T00:00:00Z"

# Export logs
az mcp server logs export \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --output-file "mcp-logs.json" \
  --format "json"
```

### **Performance Monitoring**

**Key Metrics**:
- Request count and rate
- Response time percentiles
- Error rate and types
- Memory and CPU usage
- Instance count and scaling events

**Alerts Configuration**:
```bash
# Create alert for high error rate
az monitor metrics alert create \
  --name "mcp-high-error-rate" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.MCP/servers/$MCP_SERVER_NAME" \
  --condition "avg Platform.ErrorRate > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group-ids "/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/actionGroups/mcp-alerts"

# Create alert for high response time
az monitor metrics alert create \
  --name "mcp-high-latency" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.MCP/servers/$MCP_SERVER_NAME" \
  --condition "avg Platform.ResponseTime > 1000" \
  --window-size 5m \
  --evaluation-frequency 1m
```

### **Health Checks**

```bash
# Test server health
curl "https://$MCP_SERVER_NAME.mcp.azure.com/health"

# Test authentication
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     "https://$MCP_SERVER_NAME.mcp.azure.com/tools"

# Performance test
ab -n 100 -c 10 "https://$MCP_SERVER_NAME.mcp.azure.com/health"
```

## 🔒 **Security**

### **Authentication & Authorization**

**Azure AD Integration**:
```bash
# Configure Azure AD authentication
az mcp server auth set \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --auth-type "azure-ad" \
  --tenant-id $FABRIC_TENANT_ID \
  --client-id $FABRIC_CLIENT_ID \
  --allowed-audiences "api://fabric-mcp"

# Set up role-based access
az mcp server rbac assign \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --principal-id "user-or-group-id" \
  --role "MCP.Reader"
```

**API Key Authentication**:
```bash
# Generate API key
az mcp server auth key create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --key-name "client-api-key" \
  --expiry "2024-12-31"

# List API keys
az mcp server auth key list \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP

# Revoke API key
az mcp server auth key delete \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --key-name "client-api-key"
```

### **Network Security**

**IP Restrictions**:
```bash
# Allow specific IP ranges
az mcp server access-restriction add \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --rule-name "office-network" \
  --ip-address "203.0.113.0/24" \
  --action "Allow" \
  --priority 100

# Block specific IPs
az mcp server access-restriction add \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --rule-name "block-suspicious" \
  --ip-address "198.51.100.50" \
  --action "Deny" \
  --priority 200
```

**Virtual Network Integration**:
```bash
# Deploy to VNet
az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --vnet-name "mcp-vnet" \
  --subnet-name "mcp-subnet" \
  --private-endpoint-enabled true
```

### **Secrets Management**

**Azure Key Vault Integration**:
```bash
# Connect to Key Vault
az mcp server keyvault add \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --keyvault-name "fabric-mcp-kv" \
  --managed-identity-enabled true

# Reference Key Vault secrets
az mcp server config set \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting "FABRIC_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=fabric-mcp-kv;SecretName=fabric-client-secret)"
```

## 💰 **Cost Optimization**

### **Pricing Model**

Azure MCP Server uses a consumption-based pricing model:

- **Request-based billing**: Pay only for actual requests
- **Compute time billing**: Charged for execution time
- **Data transfer**: Outbound data transfer charges
- **Storage**: Minimal storage costs for code and logs

### **Cost Optimization Strategies**

**Scaling Configuration**:
```bash
# Optimize for cost
az mcp server update \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-instances 0 \
  --max-instances 5 \
  --scale-down-delay 300 \
  --memory "256Mi" \
  --cpu "0.25"

# Optimize for performance
az mcp server update \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-instances 2 \
  --max-instances 20 \
  --scale-up-delay 30 \
  --memory "1Gi" \
  --cpu "1.0"
```

**Cost Monitoring**:
```bash
# View cost analysis
az consumption usage list \
  --resource-group $RESOURCE_GROUP \
  --start-date "2024-01-01" \
  --end-date "2024-01-31"

# Set budget alerts
az consumption budget create \
  --resource-group $RESOURCE_GROUP \
  --budget-name "mcp-monthly-budget" \
  --amount 100 \
  --time-grain "Monthly" \
  --start-date "2024-01-01" \
  --end-date "2024-12-31"
```

### **Development vs Production**

**Development Environment**:
```bash
# Cost-optimized development setup
az mcp server create \
  --name "fabric-mcp-dev" \
  --resource-group $RESOURCE_GROUP \
  --tier "Basic" \
  --min-instances 0 \
  --max-instances 2 \
  --memory "256Mi" \
  --cpu "0.25" \
  --auto-sleep true \
  --sleep-timeout 300
```

**Production Environment**:
```bash
# Performance-optimized production setup
az mcp server create \
  --name "fabric-mcp-prod" \
  --resource-group $RESOURCE_GROUP \
  --tier "Premium" \
  --min-instances 2 \
  --max-instances 50 \
  --memory "1Gi" \
  --cpu "1.0" \
  --auto-sleep false \
  --enable-availability-zones true
```

## 🔧 **Troubleshooting**

### **Common Issues**

**Deployment Failures**:
```bash
# Check deployment status
az mcp server deployment show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --deployment-id "latest"

# View deployment logs
az mcp server deployment logs \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --deployment-id "latest"

# Retry failed deployment
az mcp server deployment retry \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --deployment-id "latest"
```

**Authentication Issues**:
```bash
# Test authentication
az mcp server auth test \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP

# Check secret configuration
az mcp server config list \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --include-secrets false

# Validate Fabric credentials
curl -X POST "https://login.microsoftonline.com/$FABRIC_TENANT_ID/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$FABRIC_CLIENT_ID&client_secret=$FABRIC_CLIENT_SECRET&scope=https://analysis.windows.net/powerbi/api/.default&grant_type=client_credentials"
```

**Performance Issues**:
```bash
# Check current scaling
az mcp server metrics show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --metric "InstanceCount" \
  --interval PT1M

# Review response times
az mcp server metrics show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --metric "ResponseTime" \
  --aggregation "Average"

# Check for throttling
az mcp server metrics show \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --metric "ThrottledRequests"
```

### **Debug Commands**

```bash
# Enable debug logging
az mcp server config set \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting "LOG_LEVEL=debug"

# Test connectivity
az mcp server test \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --test-type "connectivity"

# Validate configuration
az mcp server validate \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP
```

## 🔄 **Migration from Self-Hosted**

### **Migrating from AKS**

**1. Export Configuration**:
```bash
# Export Kubernetes configuration
kubectl get configmap fabric-mcp-config -n fabric-mcp -o yaml > config.yaml
kubectl get secret fabric-mcp-secrets -n fabric-mcp -o yaml > secrets.yaml

# Convert to Azure MCP Server format
python scripts/convert-k8s-to-mcp.py config.yaml secrets.yaml > mcp-config.json
```

**2. Create Azure MCP Server**:
```bash
# Import configuration
az mcp server create \
  --name $MCP_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --config-file "mcp-config.json" \
  --source-type "github" \
  --repository "santhoshravindran7/Fabric-Analytics-MCP"
```

**3. Test and Validate**:
```bash
# Test new endpoint
curl "https://$MCP_SERVER_NAME.mcp.azure.com/health"

# Compare responses
diff <(curl -s "https://old-endpoint.com/tools") \
     <(curl -s "https://$MCP_SERVER_NAME.mcp.azure.com/tools")
```

**4. Update Clients**:
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "mcp-client",
      "args": ["--endpoint", "https://fabric-analytics-mcp.mcp.azure.com"]
    }
  }
}
```

### **Rollback Plan**

```bash
# Keep old deployment during transition
kubectl get deployment fabric-analytics-mcp -n fabric-mcp -o yaml > backup-deployment.yaml

# Quick rollback if needed
kubectl apply -f backup-deployment.yaml

# Update clients back to old endpoint
# Update Claude Desktop config, etc.
```

## 📞 **Support and Resources**

### **Azure MCP Server Support**

- **Documentation**: [Azure MCP Server Docs](https://docs.microsoft.com/azure/mcp-server/)
- **Support**: [Azure Support Portal](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- **Community**: [Azure MCP Server Community](https://github.com/Azure/mcp-server-discussions)
- **Preview Feedback**: [MCP Server Feedback](https://feedback.azure.com/d365community/forum/mcp-server)

### **Microsoft Fabric Integration**

- **Fabric API**: [Microsoft Fabric REST API](https://docs.microsoft.com/rest/api/fabric/)
- **Authentication**: [Azure AD App Registration](https://docs.microsoft.com/azure/active-directory/develop/quickstart-register-app)
- **Permissions**: [Fabric API Permissions](https://docs.microsoft.com/fabric/security/security-overview)

### **Emergency Contacts**

For production issues:
1. **Azure Support**: Create support ticket for infrastructure issues
2. **Microsoft Fabric Support**: For Fabric API and authentication issues
3. **Repository Issues**: [GitHub Issues](https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues) for application-specific problems

---

**Note**: Azure MCP Server is currently in preview. Features and pricing may change before general availability. Review the [Azure Preview Terms](https://azure.microsoft.com/support/legal/preview-supplemental-terms/) for current limitations and support policies.
