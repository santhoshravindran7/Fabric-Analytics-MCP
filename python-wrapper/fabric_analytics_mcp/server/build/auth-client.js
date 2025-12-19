import { PublicClientApplication, ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { createServer } from "http";
import { URL } from "url";
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export var AuthMethod;
(function (AuthMethod) {
    AuthMethod["BEARER_TOKEN"] = "bearer";
    AuthMethod["AZURE_CLI"] = "azure_cli";
    AuthMethod["SERVICE_PRINCIPAL"] = "service_principal";
    AuthMethod["DEVICE_CODE"] = "device_code";
    AuthMethod["INTERACTIVE"] = "interactive";
})(AuthMethod || (AuthMethod = {}));
export class MicrosoftAuthClient {
    constructor(config) {
        this.defaultScope = ["https://api.fabric.microsoft.com/.default"];
        this.config = {
            ...config,
            authority: config.authority || "https://login.microsoftonline.com/common",
            scope: config.scope || this.defaultScope
        };
    }
    /**
     * Initialize the appropriate MSAL client based on auth method
     */
    initializeClient(method) {
        const clientConfig = {
            auth: {
                clientId: this.config.clientId,
                authority: this.config.authority,
            },
            system: {
                loggerOptions: {
                    loggerCallback: (level, message, containsPii) => {
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
        }
        else {
            // Use public client for device code and interactive flows
            this.publicClient = new PublicClientApplication(clientConfig);
        }
    }
    /**
     * Authenticate using bearer token (direct token provision)
     */
    async authenticateWithBearerToken(token) {
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
    async authenticateWithServicePrincipal(clientId, clientSecret, tenantId) {
        this.config.clientId = clientId;
        this.config.clientSecret = clientSecret;
        this.config.authority = `https://login.microsoftonline.com/${tenantId}`;
        this.initializeClient(AuthMethod.SERVICE_PRINCIPAL);
        if (!this.confidentialClient) {
            throw new Error("Failed to initialize confidential client for service principal authentication");
        }
        const clientCredentialRequest = {
            scopes: this.config.scope,
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
        }
        catch (error) {
            throw new Error(`Service principal authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Authenticate using device code flow (for headless environments)
     */
    async authenticateWithDeviceCode(clientId, tenantId) {
        this.config.clientId = clientId;
        if (tenantId) {
            this.config.authority = `https://login.microsoftonline.com/${tenantId}`;
        }
        this.initializeClient(AuthMethod.DEVICE_CODE);
        if (!this.publicClient) {
            throw new Error("Failed to initialize public client for device code authentication");
        }
        const deviceCodeRequest = {
            scopes: this.config.scope,
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
        }
        catch (error) {
            throw new Error(`Device code authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Authenticate using interactive flow (opens browser)
     */
    async authenticateInteractively(clientId, tenantId) {
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
                    }
                    else {
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
    buildAuthUrl() {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            redirect_uri: this.config.redirectUri,
            scope: this.config.scope.join(' '),
            response_mode: 'query',
        });
        return `${this.config.authority}/oauth2/v2.0/authorize?${params.toString()}`;
    }
    async handleAuthorizationCode(code) {
        // This is a simplified implementation - in a real scenario, you'd exchange the code for tokens
        // For now, we'll use device code flow as a fallback
        console.log("Received authorization code, exchanging for tokens...");
        // Fallback to device code flow
        return this.authenticateWithDeviceCode(this.config.clientId);
    }
    /**
     * Authenticate using Azure CLI
     * Uses the current Azure CLI login session
     */
    async authenticateWithAzureCli(resource = "https://api.fabric.microsoft.com") {
        try {
            // Get access token using Azure CLI
            const { stdout } = await execAsync(`az account get-access-token --resource "${resource}" --query "accessToken" --output tsv`);
            const accessToken = stdout.trim();
            if (!accessToken) {
                console.error("Failed to get access token from Azure CLI");
                return null;
            }
            // Parse the token to get expiration (optional)
            let expiresOn = new Date(Date.now() + 3600000); // Default 1 hour
            try {
                // Try to get token details including expiration
                const { stdout: tokenDetails } = await execAsync(`az account get-access-token --resource "${resource}" --output json`);
                const tokenInfo = JSON.parse(tokenDetails);
                if (tokenInfo.expiresOn) {
                    expiresOn = new Date(tokenInfo.expiresOn);
                }
            }
            catch (e) {
                // If parsing fails, use default expiration
                console.warn("Could not parse token expiration, using default");
            }
            return {
                accessToken,
                expiresOn,
                account: undefined
            };
        }
        catch (error) {
            console.error("Azure CLI authentication failed:", error);
            console.error("Make sure you are logged in with 'az login' and have access to Microsoft Fabric");
            return null;
        }
    }
    /**
     * Get token silently (from cache)
     */
    async getTokenSilently(account) {
        if (!this.publicClient) {
            return null;
        }
        const silentRequest = {
            scopes: this.config.scope,
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
        }
        catch (error) {
            return null; // Silent acquisition failed, need interactive flow
        }
    }
    /**
     * Get all cached accounts
     */
    async getCachedAccounts() {
        if (!this.publicClient) {
            return [];
        }
        return this.publicClient.getTokenCache().getAllAccounts();
    }
    /**
     * Clear token cache
     */
    async clearCache() {
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
    isTokenValid(authResult) {
        return authResult.expiresOn > new Date();
    }
    /**
     * Get authentication method prompt for CLI
     */
    static getAuthMethodPrompt() {
        return `
Choose authentication method:
1. Bearer Token (provide your own token)
2. Azure CLI (use current az login session)
3. Service Principal (client ID + secret + tenant)
4. Device Code (sign in with browser on another device)
5. Interactive (sign in with browser - opens automatically)

Enter choice (1-5): `;
    }
    /**
     * Parse authentication method from user input
     */
    static parseAuthMethod(input) {
        switch (input.trim()) {
            case "1":
                return AuthMethod.BEARER_TOKEN;
            case "2":
                return AuthMethod.AZURE_CLI;
            case "3":
                return AuthMethod.SERVICE_PRINCIPAL;
            case "4":
                return AuthMethod.DEVICE_CODE;
            case "5":
                return AuthMethod.INTERACTIVE;
            default:
                throw new Error("Invalid authentication method selection");
        }
    }
}
export default MicrosoftAuthClient;
//# sourceMappingURL=auth-client.js.map