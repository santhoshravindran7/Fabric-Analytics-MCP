# Azure Kubernetes Service (AKS) Deployment Guide

This guide provides comprehensive instructions for deploying the Microsoft Fabric Analytics MCP Server to Azure Kubernetes Service (AKS) for enterprise production use.

## 📋 **Table of Contents**

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Monitoring & Management](#monitoring--management)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Cost Optimization](#cost-optimization)

## 🔧 **Prerequisites**

### **Required Tools**
- **Azure CLI** (v2.40.0 or later)
- **kubectl** (v1.25.0 or later)
- **Docker** (v20.10.0 or later)
- **Helm** (v3.10.0 or later) - Optional but recommended

### **Azure Requirements**
- Azure subscription with appropriate permissions
- Resource group creation permissions
- AKS and ACR creation permissions
- Key Vault access permissions

### **Microsoft Fabric Requirements**
- Azure AD application registration (Service Principal)
- Microsoft Fabric workspace access
- Required API permissions for Fabric operations

## 🚀 **Quick Start**

### **1. Clone and Prepare**
```bash
git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
cd Fabric-Analytics-MCP
npm install
npm run build
```

### **2. Set Environment Variables**
```bash
# Azure Configuration
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export RESOURCE_GROUP="fabric-mcp-rg"
export ACR_NAME="fabricmcpregistry"  # Must be globally unique
export AKS_CLUSTER_NAME="fabric-mcp-cluster"
export LOCATION="eastus"

# Microsoft Fabric Authentication
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
export FABRIC_TENANT_ID="your-tenant-id"
export FABRIC_DEFAULT_WORKSPACE_ID="your-workspace-id"

# Optional: Custom Domain
export DOMAIN_NAME="your-domain.com"
```

### **3. One-Command Deployment**
```bash
# Setup Azure resources, build image, and deploy
./scripts/setup-azure-resources.sh && \
./scripts/build-and-push.sh && \
./scripts/deploy-to-aks.sh
```

## 🏗️ **Detailed Setup**

### **Step 1: Azure Resources Setup**

Create all necessary Azure resources:

```bash
# Create Azure resources
./scripts/setup-azure-resources.sh

# Or create individual components
./scripts/setup-azure-resources.sh --skip-networking  # Skip VNet/AppGW
./scripts/setup-azure-resources.sh --skip-dns         # Skip DNS zone
```

This creates:
- Resource Group
- Azure Container Registry (ACR)
- AKS Cluster with auto-scaling (1-10 nodes)
- Azure Key Vault for secrets
- Managed Identity for secure access
- Log Analytics workspace for monitoring
- Virtual Network with subnets
- Application Gateway for advanced routing
- Public IP and DNS configuration

### **Step 2: Build and Push Docker Image**

```bash
# Build and push to ACR
ACR_NAME=your-registry ./scripts/build-and-push.sh

# With specific version and testing
ACR_NAME=your-registry ./scripts/build-and-push.sh --version v1.0.0 --test

# Build only (no push)
ACR_NAME=your-registry ./scripts/build-and-push.sh --no-push
```

### **Step 3: Deploy to AKS**

```bash
# Full deployment
./scripts/deploy-to-aks.sh

# Update existing deployment only
./scripts/deploy-to-aks.sh --update-only

# Skip infrastructure components
./scripts/deploy-to-aks.sh --skip-cluster --skip-ingress
```

## ⚙️ **Configuration**

### **Environment Variables**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | No | Current subscription |
| `RESOURCE_GROUP` | Azure resource group name | No | `fabric-mcp-rg` |
| `ACR_NAME` | Azure Container Registry name | Yes | - |
| `AKS_CLUSTER_NAME` | AKS cluster name | No | `fabric-mcp-cluster` |
| `LOCATION` | Azure region | No | `eastus` |
| `FABRIC_CLIENT_ID` | Fabric service principal client ID | Yes | - |
| `FABRIC_CLIENT_SECRET` | Fabric service principal secret | Yes | - |
| `FABRIC_TENANT_ID` | Azure AD tenant ID | Yes | - |
| `FABRIC_DEFAULT_WORKSPACE_ID` | Default Fabric workspace ID | No | - |
| `DOMAIN_NAME` | Custom domain for ingress | No | - |
| `IMAGE_VERSION` | Docker image version | No | `latest` |

### **Kubernetes Configuration**

The deployment includes:

**Namespace**: `fabric-mcp`
- Isolated environment for the application
- Resource quotas and network policies
- RBAC with minimal required permissions

**Deployment**: `fabric-analytics-mcp`
- 3 replicas with rolling updates
- Resource limits: 500m CPU, 512Mi memory
- Security context: non-root user, read-only filesystem
- Health checks: liveness, readiness, and startup probes

**Services**:
- LoadBalancer service for external access
- ClusterIP service for internal communication
- Headless service for StatefulSet support

**Auto-scaling**:
- Horizontal Pod Autoscaler (HPA): 3-10 pods
- Triggers: 70% CPU, 80% memory utilization
- Vertical Pod Autoscaler (VPA) for resource optimization

### **Security Configuration**

**Pod Security**:
- Non-root user execution (UID 1001)
- Read-only root filesystem
- Dropped ALL capabilities
- Security context constraints

**Network Security**:
- Network policies for traffic isolation
- Ingress controller with SSL termination
- Rate limiting and CORS configuration

**Secrets Management**:
- Azure Key Vault integration
- Kubernetes secrets for runtime credentials
- Managed identity for secure access

## 🚀 **Deployment**

### **Standard Deployment**

```bash
# Complete deployment with monitoring
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo update

./scripts/deploy-to-aks.sh
```

### **Custom Domain Deployment**

```bash
# With custom domain and SSL
export DOMAIN_NAME="mcp.yourcompany.com"
./scripts/deploy-to-aks.sh
```

### **Production Deployment with Azure Application Gateway**

```bash
# Using Application Gateway Ingress Controller
export USE_APP_GATEWAY="true"
./scripts/deploy-to-aks.sh
```

### **Deployment Verification**

```bash
# Check deployment status
kubectl get deployments -n fabric-mcp

# Check pod status
kubectl get pods -n fabric-mcp -o wide

# Check service status
kubectl get services -n fabric-mcp

# Check ingress
kubectl get ingress -n fabric-mcp

# View logs
kubectl logs -f deployment/fabric-analytics-mcp -n fabric-mcp
```

## 📊 **Monitoring & Management**

### **Built-in Monitoring**

The deployment includes comprehensive monitoring:

**Azure Monitor Integration**:
- Container insights for AKS cluster
- Log Analytics workspace for centralized logging
- Application Insights for performance monitoring

**Prometheus Metrics**:
- Endpoint: `/metrics`
- Custom application metrics
- Kubernetes cluster metrics

**Health Endpoints**:
- Health check: `/health`
- Readiness check: `/ready`
- Metrics: `/metrics`

### **Monitoring Commands**

```bash
# View cluster status
kubectl cluster-info

# Monitor pod resource usage
kubectl top pods -n fabric-mcp

# View HPA status
kubectl get hpa -n fabric-mcp

# Check autoscaler events
kubectl describe hpa fabric-analytics-mcp-hpa -n fabric-mcp

# View application logs
kubectl logs -f deployment/fabric-analytics-mcp -n fabric-mcp --tail=100

# Port forward for local testing
kubectl port-forward service/fabric-analytics-mcp-service -n fabric-mcp 3000:80
```

### **Scaling Operations**

```bash
# Manual scaling
kubectl scale deployment fabric-analytics-mcp --replicas=5 -n fabric-mcp

# Update autoscaler settings
kubectl patch hpa fabric-analytics-mcp-hpa -n fabric-mcp -p '{"spec":{"maxReplicas":15}}'

# View scaling events
kubectl get events -n fabric-mcp --sort-by='.lastTimestamp'
```

## 🔄 **Updates and Maintenance**

### **Application Updates**

```bash
# Build new version
export IMAGE_VERSION="v1.1.0"
./scripts/build-and-push.sh --version $IMAGE_VERSION

# Update deployment
kubectl set image deployment/fabric-analytics-mcp \
  fabric-analytics-mcp=${ACR_NAME}.azurecr.io/fabric-analytics-mcp:$IMAGE_VERSION \
  -n fabric-mcp

# Monitor rollout
kubectl rollout status deployment/fabric-analytics-mcp -n fabric-mcp

# Rollback if needed
kubectl rollout undo deployment/fabric-analytics-mcp -n fabric-mcp
```

### **Configuration Updates**

```bash
# Update ConfigMap
kubectl edit configmap fabric-mcp-config -n fabric-mcp

# Update Secrets
kubectl create secret generic fabric-mcp-secrets \
  --from-literal=FABRIC_CLIENT_SECRET="new-secret" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployment to pick up changes
kubectl rollout restart deployment/fabric-analytics-mcp -n fabric-mcp
```

### **Cluster Maintenance**

```bash
# Upgrade AKS cluster
az aks upgrade \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --kubernetes-version 1.29

# Upgrade node pools
az aks nodepool upgrade \
  --resource-group $RESOURCE_GROUP \
  --cluster-name $AKS_CLUSTER_NAME \
  --name nodepool1 \
  --kubernetes-version 1.29
```

## 🔧 **Troubleshooting**

### **Common Issues**

**Pods Not Starting**:
```bash
# Check pod events
kubectl describe pod <pod-name> -n fabric-mcp

# Check resource constraints
kubectl top nodes
kubectl describe nodes

# Check image pull issues
kubectl get events -n fabric-mcp --field-selector reason=Failed
```

**Authentication Issues**:
```bash
# Check secret contents
kubectl get secret fabric-mcp-secrets -n fabric-mcp -o yaml

# Test authentication
kubectl exec -it deployment/fabric-analytics-mcp -n fabric-mcp -- \
  node -e "console.log(process.env.FABRIC_CLIENT_ID)"

# Check managed identity
az identity show --name $MANAGED_IDENTITY_NAME --resource-group $RESOURCE_GROUP
```

**Networking Issues**:
```bash
# Check service endpoints
kubectl get endpoints -n fabric-mcp

# Test internal connectivity
kubectl run test-pod --image=busybox -i --tty --rm -- /bin/sh
# Inside pod: wget -O- http://fabric-analytics-mcp-service.fabric-mcp.svc.cluster.local:3000/health

# Check ingress configuration
kubectl describe ingress fabric-analytics-mcp-ingress -n fabric-mcp
```

**Performance Issues**:
```bash
# Check resource usage
kubectl top pods -n fabric-mcp

# Check HPA status
kubectl describe hpa fabric-analytics-mcp-hpa -n fabric-mcp

# Check cluster autoscaler
kubectl logs -f deployment/cluster-autoscaler -n kube-system
```

### **Debug Commands**

```bash
# Get all resources in namespace
kubectl get all -n fabric-mcp

# Describe deployment
kubectl describe deployment fabric-analytics-mcp -n fabric-mcp

# Check resource quotas
kubectl describe quota -n fabric-mcp

# View network policies
kubectl get networkpolicy -n fabric-mcp -o yaml

# Check RBAC
kubectl auth can-i list pods --as=system:serviceaccount:fabric-mcp:fabric-mcp-service-account
```

## 🔒 **Security Considerations**

### **Pod Security Standards**

The deployment enforces strict security policies:

- **Restricted PSS**: Pods run with minimal privileges
- **Non-root execution**: All processes run as UID 1001
- **Read-only filesystem**: No writes to container filesystem
- **Capability dropping**: All Linux capabilities removed
- **Security context**: Comprehensive security constraints

### **Network Security**

- **Network Policies**: Traffic isolation between namespaces
- **Ingress Security**: SSL/TLS termination with modern ciphers
- **Service Mesh**: Optional Istio/Linkerd integration
- **Rate Limiting**: Protection against DDoS attacks

### **Secrets Management**

- **Azure Key Vault**: Centralized secret storage
- **Workload Identity**: Secure access without credentials
- **Secret Rotation**: Automated credential updates
- **Audit Logging**: Complete access tracking

### **Security Monitoring**

```bash
# Check security policies
kubectl get psp,scc -A

# Review RBAC permissions
kubectl get rolebindings,clusterrolebindings -A -o wide

# Audit secret access
az monitor activity-log list --resource-group $RESOURCE_GROUP --caller $USER_EMAIL
```

## 💰 **Cost Optimization**

### **Resource Optimization**

**Right-sizing**:
- Use VPA recommendations for optimal resource requests
- Monitor actual usage vs. requested resources
- Adjust HPA thresholds based on traffic patterns

**Node Optimization**:
- Use spot instances for non-critical workloads
- Implement cluster autoscaler for dynamic scaling
- Consider reserved instances for stable workloads

**Storage Optimization**:
- Use ephemeral storage for temporary data
- Implement storage classes for different performance needs
- Regular cleanup of unused resources

### **Cost Monitoring**

```bash
# Check resource costs
az consumption usage list --start-date 2024-01-01 --end-date 2024-01-31

# Monitor resource utilization
kubectl top nodes
kubectl top pods -A

# Review resource requests vs usage
kubectl describe nodes | grep -A5 "Allocated resources"
```

### **Cost-Saving Strategies**

**Development Environment**:
```bash
# Scale down for development
kubectl scale deployment fabric-analytics-mcp --replicas=1 -n fabric-mcp

# Use smaller node sizes
az aks nodepool update --resource-group $RESOURCE_GROUP --cluster-name $AKS_CLUSTER_NAME --name nodepool1 --min-count 1 --max-count 3
```

**Production Environment**:
- Implement horizontal pod autoscaling
- Use cluster autoscaler for node management
- Monitor and optimize based on actual usage patterns
- Consider Azure Spot VMs for batch workloads

## 📞 **Support and Maintenance**

### **Regular Maintenance Tasks**

**Weekly**:
- Review cluster health and performance metrics
- Check for security updates and patches
- Monitor resource utilization and costs

**Monthly**:
- Update Kubernetes version (test in staging first)
- Review and rotate secrets if needed
- Backup and test disaster recovery procedures

**Quarterly**:
- Review and optimize resource allocations
- Conduct security audits and penetration testing
- Update documentation and runbooks

### **Emergency Procedures**

**Application Issues**:
```bash
# Quick rollback
kubectl rollout undo deployment/fabric-analytics-mcp -n fabric-mcp

# Scale up for high load
kubectl patch hpa fabric-analytics-mcp-hpa -n fabric-mcp -p '{"spec":{"maxReplicas":20}}'

# Emergency stop
kubectl scale deployment fabric-analytics-mcp --replicas=0 -n fabric-mcp
```

**Cluster Issues**:
```bash
# Drain problematic node
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Emergency cluster access
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME --admin
```

---

## 📚 **Additional Resources**

- [Azure Kubernetes Service Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Kubernetes Official Documentation](https://kubernetes.io/docs/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/en-us/azure/container-registry/)
- [Microsoft Fabric API Documentation](https://docs.microsoft.com/en-us/fabric/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

For issues and questions specific to this deployment, please [open an issue](https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues) in the repository.
