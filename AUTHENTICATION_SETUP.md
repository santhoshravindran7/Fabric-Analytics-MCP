# 🔐 **Authentication Configuration Guide**

This guide shows how to configure different authentication methods for production deployment of the Microsoft Fabric Analytics MCP Server.

## 📋 **Supported Authentication Methods**

### **1. 🎫 Bearer Token Authentication**
**Use Case**: Development, testing, or when you already have a valid token
**Configuration**: Pass bearer token directly to tools

### **2. 🤖 Service Principal Authentication** ⭐ **RECOMMENDED FOR PRODUCTION**
**Use Case**: Production deployment, automated systems, CI/CD pipelines
**Configuration**: Environment variables for SPN credentials

### **3. 📱 Device Code Authentication**
**Use Case**: Headless environments, remote servers
**Configuration**: Interactive device code flow

### **4. 🌐 Interactive Authentication**
**Use Case**: Development, testing on local machines
**Configuration**: Browser-based authentication

---

## 🚀 **Production Setup: Service Principal Authentication**

### **Step 1: Create Azure AD Application**

1. **Go to Azure Portal** → Azure Active Directory → App registrations
2. **Click "New registration"**
3. **Fill out the form**:
   - Name: `Fabric-Analytics-MCP-Server`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: Leave blank
4. **Click "Register"**

### **Step 2: Generate Client Secret**

1. **Go to your app** → Certificates & secrets
2. **Click "New client secret"**
3. **Add description**: `MCP Server Secret`
4. **Set expiration**: 24 months (recommended)
5. **Click "Add"**
6. **Copy the secret value** immediately (you won't see it again!)

### **Step 3: Grant Microsoft Fabric Permissions**

1. **Go to your app** → API permissions
2. **Click "Add a permission"**
3. **Select "APIs my organization uses"**
4. **Search for "Power BI Service"** or **"Microsoft Fabric"**
5. **Select application permissions**:
   - `Dataset.ReadWrite.All`
   - `Workspace.ReadWrite.All`
   - `Item.ReadWrite.All`
6. **Click "Grant admin consent"**

### **Step 4: Environment Variables Configuration**

Create these environment variables for production deployment:

```bash
# Service Principal Configuration
FABRIC_CLIENT_ID=your-app-client-id
FABRIC_CLIENT_SECRET=your-app-client-secret  
FABRIC_TENANT_ID=your-tenant-id

# Optional: Default workspace
FABRIC_DEFAULT_WORKSPACE_ID=your-default-workspace-id

# Authentication method (default: bearer)
FABRIC_AUTH_METHOD=service_principal
```

### **Step 5: Claude Desktop Configuration for Production**

Update your Claude Desktop config to use environment variables:

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "your-app-client-id",
        "FABRIC_CLIENT_SECRET": "your-app-client-secret",
        "FABRIC_TENANT_ID": "your-tenant-id"
      }
    }
  }
}
```

---

## 🔧 **Authentication Method Configuration**

### **Method 1: Environment Variables (Recommended)**

Set these in your system or deployment environment:

```bash
# Windows (PowerShell)
$env:FABRIC_AUTH_METHOD="service_principal"
$env:FABRIC_CLIENT_ID="your-client-id"
$env:FABRIC_CLIENT_SECRET="your-client-secret"
$env:FABRIC_TENANT_ID="your-tenant-id"

# Linux/macOS
export FABRIC_AUTH_METHOD="service_principal"
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
export FABRIC_TENANT_ID="your-tenant-id"
```

### **Method 2: Claude Desktop Environment**

Configure directly in Claude Desktop config:

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "12345678-1234-1234-1234-123456789abc",
        "FABRIC_CLIENT_SECRET": "your-secret-here",
        "FABRIC_TENANT_ID": "87654321-4321-4321-4321-cba987654321"
      }
    }
  }
}
```

### **Method 3: Device Code Flow**

For headless environments:

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node", 
      "args": ["C:\\path\\to\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "device_code",
        "FABRIC_CLIENT_ID": "your-client-id",
        "FABRIC_TENANT_ID": "your-tenant-id"
      }
    }
  }
}
```

---

## 🛡️ **Security Best Practices**

### **✅ DO:**
- Use Service Principal authentication for production
- Store secrets in environment variables or secure key vaults
- Rotate client secrets regularly (every 6-12 months)
- Use least-privilege permissions
- Monitor authentication logs

### **❌ DON'T:**
- Hardcode secrets in configuration files
- Commit secrets to version control
- Use personal bearer tokens in production
- Share client secrets via email or chat
- Use overly broad permissions

---

## 🧪 **Testing Authentication Setup**

### **Test Service Principal Authentication**

Run this command to verify your SPN setup:

```bash
# With environment variables set
node -e "
const { MicrosoftAuthClient } = require('./build/auth-client.js');
const client = new MicrosoftAuthClient({
  clientId: process.env.FABRIC_CLIENT_ID
});
client.authenticateWithServicePrincipal(
  process.env.FABRIC_CLIENT_ID,
  process.env.FABRIC_CLIENT_SECRET, 
  process.env.FABRIC_TENANT_ID
).then(result => {
  console.log('✅ Authentication successful!');
  console.log('Token expires:', result.expiresOn);
}).catch(err => {
  console.error('❌ Authentication failed:', err.message);
});
"
```

### **Test with Claude Desktop**

Try these queries after authentication setup:

```
"Test my Microsoft Fabric authentication setup"
"List all items in my default workspace" 
"What authentication method am I using?"
```

---

## 🔄 **Authentication Flow Diagram**

```
Claude Desktop → MCP Server → Auth Check → Microsoft Fabric API
                     ↓
                Environment Variables
                     ↓
            Service Principal Flow
                     ↓
              Access Token Cache
                     ↓
              API Request with Token
```

---

## 📞 **Support & Troubleshooting**

### **Common Issues:**

1. **"Authentication failed"**
   - Verify client ID, secret, and tenant ID
   - Check API permissions are granted
   - Ensure admin consent is provided

2. **"Token expired"**
   - The MCP server handles token refresh automatically
   - Check if client secret has expired

3. **"Insufficient permissions"**
   - Verify Microsoft Fabric API permissions
   - Check workspace access rights

### **Debug Mode:**

Enable debug logging by setting:

```bash
export FABRIC_DEBUG_AUTH=true
```

This will show detailed authentication flow information.
