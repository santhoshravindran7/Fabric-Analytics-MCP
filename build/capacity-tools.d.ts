import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthMethod } from './auth-client.js';
export declare function registerCapacityTools(server: McpServer, authConfig: {
    defaultWorkspaceId?: string;
    method: AuthMethod;
}, executeApiCall: <T>(bearerToken: string | undefined, workspaceId: string, operation: string, apiCall: (_client: any) => Promise<{
    status: 'success' | 'error';
    data?: T;
    error?: string;
}>, simulationParams?: Record<string, unknown>) => Promise<{
    status: 'success' | 'error';
    data?: T;
    error?: string;
}>): void;
