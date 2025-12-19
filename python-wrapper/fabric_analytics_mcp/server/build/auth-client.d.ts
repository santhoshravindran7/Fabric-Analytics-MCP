import { AccountInfo } from "@azure/msal-node";
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
export declare enum AuthMethod {
    BEARER_TOKEN = "bearer",
    AZURE_CLI = "azure_cli",
    SERVICE_PRINCIPAL = "service_principal",
    DEVICE_CODE = "device_code",
    INTERACTIVE = "interactive"
}
export declare class MicrosoftAuthClient {
    private publicClient?;
    private confidentialClient?;
    private config;
    private readonly defaultScope;
    constructor(config: AuthConfig);
    /**
     * Initialize the appropriate MSAL client based on auth method
     */
    private initializeClient;
    /**
     * Authenticate using bearer token (direct token provision)
     */
    authenticateWithBearerToken(token: string): Promise<AuthResult>;
    /**
     * Authenticate using service principal (client credentials flow)
     */
    authenticateWithServicePrincipal(clientId: string, clientSecret: string, tenantId: string): Promise<AuthResult>;
    /**
     * Authenticate using device code flow (for headless environments)
     */
    authenticateWithDeviceCode(clientId: string, tenantId?: string): Promise<AuthResult>;
    /**
     * Authenticate using interactive flow (opens browser)
     */
    authenticateInteractively(clientId: string, tenantId?: string): Promise<AuthResult>;
    private buildAuthUrl;
    private handleAuthorizationCode;
    /**
     * Authenticate using Azure CLI
     * Uses the current Azure CLI login session
     */
    authenticateWithAzureCli(resource?: string): Promise<AuthResult | null>;
    /**
     * Get token silently (from cache)
     */
    getTokenSilently(account: AccountInfo): Promise<AuthResult | null>;
    /**
     * Get all cached accounts
     */
    getCachedAccounts(): Promise<AccountInfo[]>;
    /**
     * Clear token cache
     */
    clearCache(): Promise<void>;
    /**
     * Validate if token is still valid
     */
    isTokenValid(authResult: AuthResult): boolean;
    /**
     * Get authentication method prompt for CLI
     */
    static getAuthMethodPrompt(): string;
    /**
     * Parse authentication method from user input
     */
    static parseAuthMethod(input: string): AuthMethod;
}
export default MicrosoftAuthClient;
