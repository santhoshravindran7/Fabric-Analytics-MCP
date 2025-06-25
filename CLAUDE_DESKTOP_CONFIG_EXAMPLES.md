# 🔧 **Claude Desktop Configuration Examples**

This file provides ready-to-use Claude Desktop configuration examples for different authentication scenarios.

## 📋 **Configuration File Location**

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

---

## 🚀 **Production Configuration (Service Principal)**

### **Recommended for Production Deployments**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "12345678-1234-1234-1234-123456789abc",
        "FABRIC_CLIENT_SECRET": "your-client-secret-here",
        "FABRIC_TENANT_ID": "87654321-4321-4321-4321-cba987654321",
        "FABRIC_DEFAULT_WORKSPACE_ID": "your-default-workspace-id"
      }
    }
  }
}
```

### **Required Azure Setup**:
1. Create Azure AD App Registration
2. Generate client secret
3. Grant Microsoft Fabric API permissions
4. Get admin consent

---

## 🧪 **Development Configuration (Device Code)**

### **Great for Development and Testing**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "device_code",
        "FABRIC_CLIENT_ID": "12345678-1234-1234-1234-123456789abc",
        "FABRIC_TENANT_ID": "87654321-4321-4321-4321-cba987654321",
        "FABRIC_DEFAULT_WORKSPACE_ID": "your-default-workspace-id"
      }
    }
  }
}
```

### **How it works**:
- First API call will display a device code
- Visit the URL and enter the code
- Browser authentication will complete the flow

---

## 🖥️ **Local Development (Interactive)**

### **Automatic Browser Authentication**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "interactive",
        "FABRIC_CLIENT_ID": "12345678-1234-1234-1234-123456789abc",
        "FABRIC_TENANT_ID": "87654321-4321-4321-4321-cba987654321",
        "FABRIC_DEFAULT_WORKSPACE_ID": "your-default-workspace-id"
      }
    }
  }
}
```

### **How it works**:
- Opens browser automatically for sign-in
- Ideal for local development
- Requires interactive session

---

## 💡 **Simulation Mode (No Auth Required)**

### **For Testing and Demos**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "bearer"
      }
    }
  }
}
```

### **How it works**:
- No authentication required
- Returns realistic simulated data
- Perfect for demos and testing

---

## 🔑 **Manual Bearer Token**

### **When You Have a Valid Token**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "bearer",
        "FABRIC_DEFAULT_WORKSPACE_ID": "your-default-workspace-id"
      }
    }
  }
}
```

Then provide the bearer token in each tool call:
```
"List items in workspace abc123 using bearer token 'eyJ0eXAiOiJKV1QiLCJhb...'"
```

---

## 🌍 **Environment Variables Method**

### **Set System Environment Variables**

Instead of putting credentials in Claude Desktop config, you can set system environment variables:

**Windows (PowerShell)**:
```powershell
$env:FABRIC_AUTH_METHOD="service_principal"
$env:FABRIC_CLIENT_ID="your-client-id"
$env:FABRIC_CLIENT_SECRET="your-client-secret"
$env:FABRIC_TENANT_ID="your-tenant-id"
$env:FABRIC_DEFAULT_WORKSPACE_ID="your-workspace-id"
```

**Linux/macOS**:
```bash
export FABRIC_AUTH_METHOD="service_principal"
export FABRIC_CLIENT_ID="your-client-id"
export FABRIC_CLIENT_SECRET="your-client-secret"
export FABRIC_TENANT_ID="your-tenant-id"
export FABRIC_DEFAULT_WORKSPACE_ID="your-workspace-id"
```

Then use a simple Claude Desktop config:
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"]
    }
  }
}
```

---

## 🔍 **Debug Configuration**

### **With Debug Logging Enabled**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\build\\index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "your-client-id",
        "FABRIC_CLIENT_SECRET": "your-client-secret",
        "FABRIC_TENANT_ID": "your-tenant-id",
        "FABRIC_DEBUG_AUTH": "true",
        "NODE_ENV": "development"
      }
    }
  }
}
```

---

## ✅ **Verification Commands**

After setting up, test your configuration with these Claude Desktop queries:

```
"Check my Fabric authentication status"
"List available Microsoft Fabric tools"  
"List items in my default workspace"
"Test my authentication setup"
```

---

## 🚨 **Security Notes**

### **Production Security**:
- **Never commit secrets** to version control
- **Use Azure Key Vault** for production secrets
- **Rotate secrets regularly** (every 6-12 months)
- **Use least-privilege permissions**

### **Development Security**:
- **Use separate dev/test Azure apps**
- **Don't share credentials** via email/chat
- **Use device code flow** for shared dev environments

---

## 🔧 **Troubleshooting**

### **Common Issues**:

1. **"Authentication failed"**
   - Check client ID, secret, tenant ID
   - Verify API permissions
   - Ensure admin consent

2. **"No tools available"**
   - Check file path in config
   - Verify build succeeded (`npm run build`)
   - Check logs for errors

3. **"Module not found"**
   - Run `npm install` 
   - Check Node.js version (18+)
   - Verify dependencies

### **Debug Steps**:
1. Enable debug logging
2. Check Claude Desktop logs
3. Test authentication separately
4. Verify workspace access
