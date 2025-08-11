# Microsoft Fabric Analytics MCP Server - Docker Installation

## Quick Start with Docker

### Using Pre-built Image (Coming Soon)

```bash
# Pull and run the official image
docker run -d \
  --name fabric-mcp \
  -p 3000:3000 \
  -e FABRIC_AUTH_METHOD=bearer_token \
  -e FABRIC_CLIENT_ID=your-client-id \
  -e FABRIC_CLIENT_SECRET=your-secret \
  -e FABRIC_TENANT_ID=your-tenant-id \
  santhoshravindran7/fabric-analytics-mcp:latest
```

### Building from Source

```bash
# Clone repository
git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
cd Fabric-Analytics-MCP

# Build Docker image
docker build -t fabric-analytics-mcp .

# Run container
docker run -d \
  --name fabric-mcp \
  -p 3000:3000 \
  --env-file .env \
  fabric-analytics-mcp
```

### Docker Compose

```yaml
version: '3.8'
services:
  fabric-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - FABRIC_AUTH_METHOD=bearer_token
      - FABRIC_CLIENT_ID=${FABRIC_CLIENT_ID}
      - FABRIC_CLIENT_SECRET=${FABRIC_CLIENT_SECRET}
      - FABRIC_TENANT_ID=${FABRIC_TENANT_ID}
    volumes:
      - ./config:/app/config
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Environment Configuration

Create a `.env` file:

```env
FABRIC_AUTH_METHOD=bearer_token
FABRIC_CLIENT_ID=your-client-id
FABRIC_CLIENT_SECRET=your-client-secret
FABRIC_TENANT_ID=your-tenant-id
FABRIC_DEFAULT_WORKSPACE_ID=your-workspace-id
```

### Health Check

```bash
# Check container health
docker exec fabric-mcp curl -f http://localhost:3000/health

# View logs
docker logs fabric-mcp

# Access container shell
docker exec -it fabric-mcp bash
```

## Kubernetes Deployment

### Helm Chart (Recommended)

```bash
# Add Helm repository (coming soon)
helm repo add fabric-mcp https://santhoshravindran7.github.io/fabric-analytics-mcp-helm

# Install with custom values
helm install fabric-mcp fabric-mcp/fabric-analytics-mcp \
  --set auth.method=service_principal \
  --set auth.clientId=your-client-id \
  --set auth.clientSecret=your-secret \
  --set auth.tenantId=your-tenant-id
```

### Manual Kubernetes Deployment

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=fabric-analytics-mcp

# Port forward for local access
kubectl port-forward service/fabric-analytics-mcp 3000:3000
```

### Configuration via ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fabric-mcp-config
data:
  FABRIC_AUTH_METHOD: "service_principal"
  FABRIC_DEFAULT_WORKSPACE_ID: "your-workspace-id"
```

## Production Considerations

### Security

- Use Kubernetes secrets for sensitive data
- Enable TLS/SSL for external access
- Configure network policies
- Use service accounts with minimal permissions

### Scaling

- Configure horizontal pod autoscaling (HPA)
- Set appropriate resource limits and requests
- Consider using node affinity for performance

### Monitoring

- Prometheus metrics enabled by default
- Grafana dashboards included
- Health check endpoints available
- Structured logging with correlation IDs

### Backup & Recovery

- Configuration stored in ConfigMaps
- No persistent storage required for stateless operation
- Consider backing up logs for audit purposes
