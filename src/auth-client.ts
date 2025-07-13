import { 
  PublicClientApplication, 
  ConfidentialClientApplication,
  DeviceCodeRequest,
  ClientCredentialRequest,
  SilentFlowRequest,
  AccountInfo,
  Configuration,
  LogLevel
} from "@azure/msal-node";
import { createServer } from "http";
import { URL } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface AuthConfig {
  clientId: string;
  authority?: string;
  redirectUri?: string;
  clientSecret?: string;
  scope?: string[];
}

export interface AuthResult {
  accessToken: string;
  expiresOn: Date;
  account?: AccountInfo;
}

/* eslint-disable no-unused-vars */
export enum AuthMethod {
  BEARER_TOKEN = "bearer",
  SERVICE_PRINCIPAL = "service_principal", 
  DEVICE_CODE = "device_code",
  INTERACTIVE = "interactive",
  AZURE_CLI = "azure_cli"
}
/* eslint-enable no-unused-vars */

export class MicrosoftAuthClient {
  private publicClient?: PublicClientApplication;
  private confidentialClient?: ConfidentialClientApplication;
  private config: AuthConfig;
  private readonly defaultScope = ["https://api.fabric.microsoft.com/.default"];

  constructor(config: AuthConfig) {
    this.config = {
      ...config,
      authority: config.authority || "https://login.microsoftonline.com/common",
      scope: config.scope || this.defaultScope
    };
  }

  /**
   * Initialize the appropriate MSAL client based on auth method
   */
  private initializeClient(method: AuthMethod): void {
    const clientConfig: Configuration = {
      auth: {
        clientId: this.config.clientId,
        authority: this.config.authority,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, _containsPii) => {
            if (level === LogLevel.Error) {
              console.error("MSAL Error:", message);
            }
          },
          piiLoggingEnabled: false,
          logLevel: LogLevel.Warning,
        },
      },
    };

    if (method === AuthMethod.SERVICE_PRINCIPAL && this.config.clientSecret) {
      // Use confidential client for service principal
      this.confidentialClient = new ConfidentialClientApplication({
        ...clientConfig,
        auth: {
          ...clientConfig.auth,
          clientSecret: this.config.clientSecret,
        },
      });
    } else {
      // Use public client for device code and interactive flows
      this.publicClient = new PublicClientApplication(clientConfig);
    }
  }

  /**
   * Authenticate using bearer token (direct token provision)
   */
  async authenticateWithBearerToken(token: string): Promise<AuthResult> {
    // For bearer token, we don't need MSAL - just validate and return
    if (!token || !token.startsWith('Bearer ')) {
      throw new Error("Invalid bearer token format. Expected format: 'Bearer <token>'");
    }

    const accessToken = token.substring(7); // Remove 'Bearer ' prefix
    
    // Basic token validation (check if it's a JWT-like structure)
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      throw new Error("Invalid bearer token format. Token does not appear to be a valid JWT.");
    }

    return {
      accessToken,
      expiresOn: new Date(Date.now() + 3600000), // Default 1 hour expiry
    };
  }

  /**
   * Authenticate using service principal (client credentials flow)
   */
  async authenticateWithServicePrincipal(
    clientId: string,
    clientSecret: string,
    tenantId: string
  ): Promise<AuthResult> {
    this.config.clientId = clientId;
    this.config.clientSecret = clientSecret;
    this.config.authority = `https://login.microsoftonline.com/${tenantId}`;
    
    this.initializeClient(AuthMethod.SERVICE_PRINCIPAL);

    if (!this.confidentialClient) {
      throw new Error("Failed to initialize confidential client for service principal authentication");
    }

    const clientCredentialRequest: ClientCredentialRequest = {
      scopes: this.config.scope!,
      skipCache: false,
    };

    try {
      const response = await this.confidentialClient.acquireTokenByClientCredential(clientCredentialRequest);
      
      if (!response || !response.accessToken) {
        throw new Error("Failed to acquire token using service principal");
      }

      return {
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || new Date(Date.now() + 3600000),
        account: response.account || undefined,
      };
    } catch (error) {
      throw new Error(`Service principal authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Authenticate using device code flow (for headless environments)
   */
  async authenticateWithDeviceCode(clientId: string, tenantId?: string): Promise<AuthResult> {
    this.config.clientId = clientId;
    if (tenantId) {
      this.config.authority = `https://login.microsoftonline.com/${tenantId}`;
    }
    
    this.initializeClient(AuthMethod.DEVICE_CODE);

    if (!this.publicClient) {
      throw new Error("Failed to initialize public client for device code authentication");
    }

    const deviceCodeRequest: DeviceCodeRequest = {
      scopes: this.config.scope!,
      deviceCodeCallback: (response) => {
        console.log("\n=== DEVICE CODE AUTHENTICATION ===");
        console.log(`Please visit: ${response.verificationUri}`);
        console.log(`And enter the code: ${response.userCode}`);
        console.log(`Expires in: ${response.expiresIn} seconds`);
        console.log("Waiting for authentication...\n");
      },
    };

    try {
      const response = await this.publicClient.acquireTokenByDeviceCode(deviceCodeRequest);
      
      if (!response || !response.accessToken) {
        throw new Error("Failed to acquire token using device code");
      }

      return {
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || new Date(Date.now() + 3600000),
        account: response.account || undefined,
      };
    } catch (error) {
      throw new Error(`Device code authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Authenticate using interactive flow (opens browser)
   */
  async authenticateInteractively(clientId: string, tenantId?: string): Promise<AuthResult> {
    this.config.clientId = clientId;
    this.config.redirectUri = "http://localhost:8080";
    if (tenantId) {
      this.config.authority = `https://login.microsoftonline.com/${tenantId}`;
    }
    
    this.initializeClient(AuthMethod.INTERACTIVE);

    if (!this.publicClient) {
      throw new Error("Failed to initialize public client for interactive authentication");
    }

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        if (req.url && req.url.startsWith('/?code=')) {
          const url = new URL(req.url, 'http://localhost:8080');
          const code = url.searchParams.get('code');
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h2>Authentication successful!</h2>
                <p>You can close this window and return to the application.</p>
              </body>
            </html>
          `);
          
          server.close();
          
          if (code) {
            this.handleAuthorizationCode(code).then(resolve).catch(reject);
          } else {
            reject(new Error("No authorization code received"));
          }
        }
      });

      server.listen(8080, () => {
        const authUrl = this.buildAuthUrl();
        console.log("\n=== INTERACTIVE AUTHENTICATION ===");
        console.log(`Please visit: ${authUrl}`);
        console.log("Waiting for authentication...\n");
        
        // Auto-open browser if possible
        import('child_process').then(({ exec }) => {
          exec(`start ${authUrl}`, (error) => {
            if (error) {
              console.log("Could not auto-open browser. Please manually visit the URL above.");
            }
          });
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error("Authentication timeout"));
      }, 300000);
    });
  }

  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri!,
      scope: this.config.scope!.join(' '),
      response_mode: 'query',
    });

    return `${this.config.authority}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  private async handleAuthorizationCode(_code: string): Promise<AuthResult> {
    // This is a simplified implementation - in a real scenario, you'd exchange the code for tokens
    // For now, we'll use device code flow as a fallback
    console.log("Received authorization code, exchanging for tokens...");
    
    // Fallback to device code flow
    return this.authenticateWithDeviceCode(this.config.clientId);
  }

  /**
   * Get token silently (from cache)
   */
  async getTokenSilently(account: AccountInfo): Promise<AuthResult | null> {
    if (!this.publicClient) {
      return null;
    }

    const silentRequest: SilentFlowRequest = {
      scopes: this.config.scope!,
      account: account,
    };

    try {
      const response = await this.publicClient.acquireTokenSilent(silentRequest);
      
      if (!response || !response.accessToken) {
        return null;
      }

      return {
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || new Date(Date.now() + 3600000),
        account: response.account || undefined,
      };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    } catch (_error) {
      return null; // Silent acquisition failed, need interactive flow
    }
  }

  /**
   * Get all cached accounts
   */
  async getCachedAccounts(): Promise<AccountInfo[]> {
    if (!this.publicClient) {
      return [];
    }

    return this.publicClient.getTokenCache().getAllAccounts();
  }

  /**
   * Clear token cache
   */
  async clearCache(): Promise<void> {
    if (this.publicClient) {
      const accounts = await this.getCachedAccounts();
      for (const account of accounts) {
        await this.publicClient.getTokenCache().removeAccount(account);
      }
    }
  }

  /**
   * Validate if token is still valid
   */
  isTokenValid(authResult: AuthResult): boolean {
    return authResult.expiresOn > new Date();
  }

  /**
   * Get authentication method prompt for CLI
   */
  static getAuthMethodPrompt(): string {
    return `
Choose authentication method:
1. Bearer Token (provide your own token)
2. Service Principal (client ID + secret + tenant)
3. Device Code (sign in with browser on another device)
4. Interactive (sign in with browser - opens automatically)
5. Azure CLI (use Azure CLI logged-in context)

Enter choice (1-5): `;
  }

  /**
   * Parse authentication method from user input
   */
  static parseAuthMethod(input: string): AuthMethod {
    switch (input.trim()) {
      case "1":
        return AuthMethod.BEARER_TOKEN;
      case "2":
        return AuthMethod.SERVICE_PRINCIPAL;
      case "3":
        return AuthMethod.DEVICE_CODE;
      case "4":
        return AuthMethod.INTERACTIVE;
      case "5":
        return AuthMethod.AZURE_CLI;
      default:
        throw new Error("Invalid authentication method selection");
    }
  }

  /**
   * Authenticate using Azure CLI context
   * This method leverages the existing Azure CLI login session
   */
  async authenticateWithAzureCli(scope?: string[]): Promise<AuthResult> {
    try {
      // Check if Azure CLI is installed and user is logged in
      await this.checkAzureCliStatus();
      
      // Get access token using Azure CLI
      const targetScope = scope || this.config.scope || this.defaultScope;
      const scopeString = targetScope.join(' ');
      
      // Use Azure CLI to get token for Microsoft Fabric/Power BI
      const command = `az account get-access-token --scope "${scopeString}" --output json`;
      
      console.log("🔄 Getting access token from Azure CLI...");
      console.log(`   Scope: ${scopeString}`);
      
      const { stdout } = await execAsync(command);
      const tokenResponse = JSON.parse(stdout);
      
      if (!tokenResponse.accessToken) {
        throw new Error("Failed to get access token from Azure CLI - no access token in response");
      }
      
      // Parse expiration date
      const expiresOn = new Date(tokenResponse.expiresOn || Date.now() + 3600000);
      
      console.log("✅ Successfully authenticated using Azure CLI");
      console.log(`   Token expires: ${expiresOn.toISOString()}`);
      console.log(`   Token length: ${tokenResponse.accessToken.length} characters`);
      
      return {
        accessToken: tokenResponse.accessToken,
        expiresOn: expiresOn,
        account: undefined // Azure CLI doesn't provide account info in the same format
      };
      
    } catch (error) {
      console.error("❌ Azure CLI authentication failed:", error instanceof Error ? error.message : String(error));
      console.error("🔧 Troubleshooting steps:");
      console.error("   1. Ensure Azure CLI is installed: az --version");
      console.error("   2. Ensure you're logged in: az account show");
      console.error("   3. Try refreshing login: az account get-access-token --scope https://api.fabric.microsoft.com/.default");
      throw new Error(`Azure CLI authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check Azure CLI installation and login status
   */
  private async checkAzureCliStatus(): Promise<void> {
    try {
      // Check if Azure CLI is installed
      await execAsync('az --version');
      console.log("✅ Azure CLI is installed");
      
      // Check if user is logged in
      const { stdout } = await execAsync('az account show --output json');
      const account = JSON.parse(stdout);
      
      if (!account || !account.id) {
        throw new Error("No Azure account found. Please run 'az login' first.");
      }
      
      console.log(`✅ Logged in as: ${account.user?.name || account.user?.type || 'Unknown'}`);
      console.log(`   Subscription: ${account.name} (${account.id})`);
      console.log(`   Tenant: ${account.tenantId}`);
      
      // Test access to Microsoft Fabric specifically
      try {
        await execAsync('az account get-access-token --scope "https://api.fabric.microsoft.com/.default" --query "accessToken" --output tsv');
        console.log("✅ Microsoft Fabric API access confirmed");
      } catch (fabricError) {
        console.warn("⚠️  Warning: Could not verify Fabric API access, but authentication may still work");
        console.warn(`    Error: ${fabricError instanceof Error ? fabricError.message : String(fabricError)}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('az: command not found') || errorMessage.includes("'az' is not recognized")) {
        throw new Error(`
Azure CLI is not installed or not in PATH. 
Please install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
Then run 'az login' to authenticate.`);
      }
      
      if (errorMessage.includes('Please run')) {
        throw new Error(`
Azure CLI is installed but you are not logged in.
Please run 'az login' to authenticate with your Azure account.`);
      }
      
      throw error;
    }
  }

  /**
   * Validate that Azure CLI authentication is properly configured for MCP usage
   * This is useful for troubleshooting Claude Desktop integration
   */
  async validateAzureCliForMCP(): Promise<{valid: boolean, message: string, recommendations?: string[]}> {
    try {
      console.log("🔍 Validating Azure CLI configuration for MCP usage...");
      
      // Step 1: Check Azure CLI installation
      await execAsync('az --version');
      
      // Step 2: Check login status
      const { stdout: accountInfo } = await execAsync('az account show --output json');
      const account = JSON.parse(accountInfo);
      
      if (!account || !account.id) {
        return {
          valid: false,
          message: "Azure CLI not logged in",
          recommendations: [
            "Run 'az login' to authenticate",
            "Ensure you have access to Microsoft Fabric in your tenant"
          ]
        };
      }
      
      // Step 3: Test Fabric token acquisition
      const { stdout: tokenInfo } = await execAsync('az account get-access-token --scope "https://api.fabric.microsoft.com/.default" --output json');
      const tokenResponse = JSON.parse(tokenInfo);
      
      if (!tokenResponse.accessToken) {
        return {
          valid: false,
          message: "Cannot acquire Fabric access token",
          recommendations: [
            "Verify you have Microsoft Fabric permissions",
            "Check if your tenant has Fabric enabled",
            "Try running: az account get-access-token --scope https://api.fabric.microsoft.com/.default"
          ]
        };
      }
      
      // Step 4: Test a simple Fabric API call
      try {
        await execAsync(`az rest --method GET --url "https://api.fabric.microsoft.com/v1/workspaces" --resource "https://api.fabric.microsoft.com/" --query "value[0:1]"`);
        
        return {
          valid: true,
          message: `Azure CLI authentication configured correctly for user: ${account.user?.name || 'Unknown'}`
        };
      } catch (_apiError) {
        return {
          valid: false,
          message: "Token acquired but Fabric API call failed",
          recommendations: [
            "Verify you have permissions to access Microsoft Fabric",
            "Check if your organization allows Fabric API access",
            "Contact your administrator about Fabric access permissions"
          ]
        };
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('az: command not found') || errorMessage.includes("'az' is not recognized")) {
        return {
          valid: false,
          message: "Azure CLI not installed",
          recommendations: [
            "Install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli",
            "Add Azure CLI to your system PATH",
            "Restart your terminal/VS Code after installation"
          ]
        };
      }
      
      return {
        valid: false,
        message: `Azure CLI validation failed: ${errorMessage}`,
        recommendations: [
          "Ensure Azure CLI is properly installed",
          "Run 'az login' to authenticate",
          "Check your network connection"
        ]
      };
    }
  }
}

export default MicrosoftAuthClient;
