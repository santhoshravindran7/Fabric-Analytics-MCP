# Claude Desktop Authentication Fix

## Problem
Users reported timeouts when using the MCP server with Claude Desktop (Issues #2 and #3). The server would hang during initialization when using interactive authentication methods (device code, interactive, or service principal), causing 60-second timeouts.

## Root Cause
Claude Desktop's sandboxed environment cannot complete interactive authentication flows during MCP server initialization. When the server attempted to authenticate using MSAL flows, it would block the MCP handshake process.

## Solution (Phase 1)
Implemented timeout protection and better error handling for authentication flows:

### 1. Authentication Timeout Protection
- Added 10-second timeout for authentication attempts
- Prevents blocking in Claude Desktop environment
- Graceful fallback to simulation mode when authentication fails

### 2. Enhanced FABRIC_TOKEN Support
- Prioritized `FABRIC_TOKEN` environment variable for bearer token authentication
- Bypasses interactive authentication flows entirely
- Immediate authentication without blocking

### 3. Improved Error Messages
- Clear guidance for Claude Desktop users when authentication fails
- Step-by-step instructions for bearer token setup
- Links to Power BI token generation tools

## Usage for Claude Desktop

### Recommended: Bearer Token Method
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["path/to/build/index.js"],
      "env": {
        "FABRIC_AUTH_METHOD": "bearer_token",
        "FABRIC_TOKEN": "your_bearer_token_here",
        "FABRIC_DEFAULT_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

### How to Get a Bearer Token
1. Visit https://app.powerbi.com/embedsetup
2. Generate a bearer token for your workspace
3. Copy the token to your Claude Desktop config

### Alternative: Per-Tool Token
You can also provide the token directly when calling tools:
```
bearerToken: "your_bearer_token_here"
```

## Fallback Behavior
If authentication fails, the server automatically falls back to simulation mode, allowing users to test functionality without requiring valid tokens.

## Technical Details

### Changes Made
1. **`getAuthToken()` function**: Added timeout wrapper around authentication calls
2. **`executeApiCall()` function**: Enhanced to check `FABRIC_TOKEN` env var first
3. **Error handling**: Improved messages with Claude Desktop-specific guidance

### Code Changes
- Timeout protection prevents blocking authentication flows
- Environment variable prioritization: `FABRIC_TOKEN` > authentication flows
- Better error messages with actionable guidance

## Testing
- ✅ Build process remains successful
- ✅ Backward compatibility maintained
- ✅ Enhanced Claude Desktop support
- ✅ Graceful fallback to simulation mode

## Future Enhancements (Phase 2)
- Automatic token refresh handling
- Token validation and expiry checking  
- Enhanced simulation responses
- Claude Desktop-specific optimizations
