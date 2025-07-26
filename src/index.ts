#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FabricApiClient, ApiResponse, JobExecutionResult } from './fabric-client.js';
import { SimulationService } from './simulation-service.js';
import { MicrosoftAuthClient, AuthMethod, AuthResult } from './auth-client.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

const execAsync = promisify(exec);

// Enhanced Authentication Configuration
interface AuthConfig {
  method: AuthMethod;
  clientId?: string;
  clientSecret?: string;
  defaultWorkspaceId?: string;
}

/**
 * Load authentication configuration from environment variables
 */
function loadAuthConfig(): AuthConfig {
  const method = (process.env.FABRIC_AUTH_METHOD as AuthMethod) || AuthMethod.BEARER_TOKEN;
  
  return {
    method,
    clientId: process.env.FABRIC_CLIENT_ID,
    clientSecret: process.env.FABRIC_CLIENT_SECRET,
    defaultWorkspaceId: process.env.FABRIC_DEFAULT_WORKSPACE_ID
  };
}

// Global auth configuration
const authConfig = loadAuthConfig();
let cachedAuthResult: AuthResult | null = null;
let authClient: MicrosoftAuthClient | null = null;

/**
 * Initialize authentication client if needed
 */
function initializeAuthClient(): void {
  if (!authClient && authConfig.method !== AuthMethod.BEARER_TOKEN) {
    if (!authConfig.clientId) {
      throw new Error(`Client ID required for authentication method: ${authConfig.method}`);
    }

    authClient = new MicrosoftAuthClient({
      clientId: authConfig.clientId,
      clientSecret: authConfig.clientSecret
    });
  }
}

/**
 * Get or refresh authentication token with timeout protection for Claude Desktop
 */
async function getAuthToken(): Promise<string | null> {
  // If using bearer token method, return null (use simulation or environment token)
  if (authConfig.method === AuthMethod.BEARER_TOKEN) {
    return process.env.FABRIC_TOKEN || null;
  }

  // If using Azure CLI method, no client ID required
  if (authConfig.method === AuthMethod.AZURE_CLI) {
    // Check if we have a valid cached token
    if (cachedAuthResult && cachedAuthResult.expiresOn > new Date()) {
      return cachedAuthResult.accessToken;
    }

    // Initialize auth client for Azure CLI
    if (!authClient) {
      authClient = new MicrosoftAuthClient({
        clientId: 'dummy' // Not needed for Azure CLI
      });
    }

    try {
      const result = await authClient.authenticateWithAzureCli();
      if (result) {
        cachedAuthResult = result;
        return result.accessToken;
      }
    } catch (error) {
      console.error('Azure CLI authentication failed:', error);
    }
    return null;
  }

  // For other methods, require clientId
  if (!authConfig.clientId) {
    console.error(`Authentication method ${authConfig.method} requires FABRIC_CLIENT_ID to be set`);
    return null;
  }

  // Check if we have a valid cached token
  if (cachedAuthResult && cachedAuthResult.expiresOn > new Date()) {
    return cachedAuthResult.accessToken;
  }

  // Initialize auth client if needed
  initializeAuthClient();
  if (!authClient) {
    return null;
  }

  // Wrap authentication in a timeout to prevent blocking in Claude Desktop
  const authTimeout = 10000; // 10 seconds timeout to prevent blocking
  
  try {
    const authPromise = performAuthentication();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Authentication timeout')), authTimeout)
    );
    
    cachedAuthResult = await Promise.race([authPromise, timeoutPromise]);
    return cachedAuthResult.accessToken;
  } catch (error) {
    console.error(`Authentication failed for method ${authConfig.method}:`, error);
    return null;
  }
}

/**
 * Perform the actual authentication based on configured method
 */
async function performAuthentication(): Promise<AuthResult> {
  if (!authClient) {
    throw new Error('Auth client not initialized');
  }

  switch (authConfig.method) {
    case AuthMethod.INTERACTIVE:
      return await authClient.authenticateInteractively(
        authConfig.clientId!, 
        process.env.FABRIC_TENANT_ID
      );

    case AuthMethod.DEVICE_CODE:
      return await authClient.authenticateWithDeviceCode(
        authConfig.clientId!, 
        process.env.FABRIC_TENANT_ID
      );

    case AuthMethod.SERVICE_PRINCIPAL:
      if (!authConfig.clientSecret) {
        throw new Error('Client secret required for service principal authentication');
      }
      return await authClient.authenticateWithServicePrincipal(
        authConfig.clientId!,
        authConfig.clientSecret,
        process.env.FABRIC_TENANT_ID || 'common'
      );

    default:
      throw new Error(`Unsupported authentication method: ${authConfig.method}`);
  }
}

// Server instance
const server = new McpServer({
  name: "fabric-analytics",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
}, {
  capabilities: {
    logging: {}
  }
});

// Input validation schemas
const BaseWorkspaceSchema = z.object({
  bearerToken: z.string().min(1).describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().min(1).describe("Microsoft Fabric workspace ID")
});

const ItemOperationSchema = BaseWorkspaceSchema.extend({
  itemId: z.string().min(1).describe("Item ID in the workspace")
});

const CreateItemSchema = BaseWorkspaceSchema.extend({
  itemType: z.enum(["Lakehouse", "Notebook", "Dataset", "Report", "Dashboard"]).describe("Type of item to create"),
  displayName: z.string().min(1).max(256).describe("Display name for the item"),
  description: z.string().max(1024).optional().describe("Optional description")
});

const UpdateItemSchema = BaseWorkspaceSchema.extend({
  itemId: z.string().min(1).describe("Item ID to update"),
  displayName: z.string().min(1).max(256).optional().describe("New display name"),
  description: z.string().max(1024).optional().describe("New description")
});

const ListItemsSchema = BaseWorkspaceSchema.extend({
  itemType: z.enum(["Lakehouse", "Notebook", "Dataset", "Report", "Dashboard", "All"]).optional().describe("Filter by item type")
});

const NotebookExecutionSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to execute"),
  parameters: z.record(z.any()).optional().describe("Parameters to pass to notebook"),
  timeout: z.number().min(1).max(3600).default(300).describe("Execution timeout in seconds")
});

const SparkJobSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID for Spark context"),
  code: z.string().min(1).describe("Spark code to execute"),
  language: z.enum(["python", "scala", "sql"]).default("python").describe("Programming language"),
  clusterConfig: z.object({
    driverCores: z.number().min(1).max(16).default(4),
    driverMemory: z.string().default("8g"),
    executorCores: z.number().min(1).max(8).default(2),
    executorMemory: z.string().default("4g"),
    numExecutors: z.number().min(1).max(10).default(2)
  }).optional().describe("Spark cluster configuration")
});

const SparkJobDefinitionSchema = BaseWorkspaceSchema.extend({
  sparkJobDefinitionId: z.string().min(1).describe("Spark Job Definition ID"),
  jobType: z.enum(["sparkjob"]).default("sparkjob").describe("Type of job to create"),
  executionData: z.object({
    executableFile: z.string().optional().describe("Path to executable file"),
    mainClass: z.string().optional().describe("Main class for Spark job"),
    commandLineArguments: z.string().optional().describe("Command line arguments"),
    additionalLibraryUris: z.array(z.string()).optional().describe("Additional library URIs"),
    defaultLakehouseId: z.object({
      referenceType: z.enum(["ById"]).default("ById"),
      workspaceId: z.string().describe("Workspace ID"),
      itemId: z.string().describe("Lakehouse ID")
    }).optional().describe("Default lakehouse configuration"),
    environmentId: z.object({
      referenceType: z.enum(["ById"]).default("ById"),
      workspaceId: z.string().describe("Workspace ID"),
      itemId: z.string().describe("Environment ID")
    }).optional().describe("Environment configuration")
  }).optional().describe("Execution data for the Spark job")
});

const SparkJobInstanceSchema = BaseWorkspaceSchema.extend({
  sparkJobDefinitionId: z.string().min(1).describe("Spark Job Definition ID"),
  jobType: z.enum(["sparkjob"]).default("sparkjob").describe("Type of job instance")
});

const SparkJobStatusSchema = BaseWorkspaceSchema.extend({
  sparkJobDefinitionId: z.string().min(1).describe("Spark Job Definition ID"),
  jobInstanceId: z.string().min(1).describe("Job Instance ID to check status")
});

const JobStatusSchema = BaseWorkspaceSchema.extend({
  jobId: z.string().min(1).describe("Job ID to check status")
});

const LivySessionSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID for Livy session"),
  sessionConfig: z.object({
    kind: z.enum(["spark", "pyspark", "sparkr", "sql"]).optional().describe("Session kind"),
    driverMemory: z.string().optional().describe("Driver memory (e.g., '4g')"),
    driverCores: z.number().optional().describe("Number of driver cores"),
    executorMemory: z.string().optional().describe("Executor memory (e.g., '2g')"),
    executorCores: z.number().optional().describe("Number of executor cores"),
    numExecutors: z.number().optional().describe("Number of executors"),
    name: z.string().optional().describe("Session name"),
    conf: z.record(z.string()).optional().describe("Spark configuration")
  }).optional().describe("Session configuration")
});

const LivySessionOperationSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.number().min(0).describe("Livy session ID")
});

const LivyStatementSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.number().min(0).describe("Livy session ID"),
  code: z.string().min(1).describe("Code to execute"),
  kind: z.enum(["spark", "pyspark", "sparkr", "sql"]).optional().describe("Statement kind")
});

const LivyStatementOperationSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.number().min(0).describe("Livy session ID"),
  statementId: z.number().min(0).describe("Statement ID")
});

const LivyBatchSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  batchConfig: z.object({
    file: z.string().describe("Path to the executable file"),
    className: z.string().optional().describe("Main class name"),
    args: z.array(z.string()).optional().describe("Command line arguments"),
    jars: z.array(z.string()).optional().describe("JAR files"),
    pyFiles: z.array(z.string()).optional().describe("Python files"),
    files: z.array(z.string()).optional().describe("Other files"),
    driverMemory: z.string().optional().describe("Driver memory"),
    driverCores: z.number().optional().describe("Driver cores"),
    executorMemory: z.string().optional().describe("Executor memory"),
    executorCores: z.number().optional().describe("Executor cores"),
    numExecutors: z.number().optional().describe("Number of executors"),
    name: z.string().optional().describe("Batch job name"),
    conf: z.record(z.string()).optional().describe("Spark configuration")
  }).describe("Batch job configuration")
});

const LivyBatchOperationSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  batchId: z.number().min(0).describe("Batch job ID")
});

// Spark Monitoring Schemas
const SparkMonitoringBaseSchema = BaseWorkspaceSchema.extend({
  continuationToken: z.string().optional().describe("Continuation token for pagination")
});

const SparkNotebookMonitoringSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to monitor"),
  continuationToken: z.string().optional().describe("Continuation token for pagination")
});

const SparkJobDefinitionMonitoringSchema = BaseWorkspaceSchema.extend({
  sparkJobDefinitionId: z.string().min(1).describe("Spark Job Definition ID to monitor"),
  continuationToken: z.string().optional().describe("Continuation token for pagination")
});

const SparkLakehouseMonitoringSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID to monitor"),
  continuationToken: z.string().optional().describe("Continuation token for pagination")
});

const SparkApplicationOperationSchema = BaseWorkspaceSchema.extend({
  livyId: z.string().min(1).describe("Livy session/application ID")
});

const SparkDashboardSchema = BaseWorkspaceSchema.extend({
  includeCompleted: z.boolean().default(true).describe("Include completed applications"),
  maxResults: z.number().min(1).max(1000).default(100).describe("Maximum number of results")
});

// Notebook Management Schemas
const NotebookCell = z.object({
  cell_type: z.enum(["code", "markdown"]).describe("Type of notebook cell"),
  source: z.array(z.string()).describe("Cell content lines"),
  execution_count: z.number().nullable().optional().describe("Execution count for code cells"),
  outputs: z.array(z.any()).optional().describe("Cell outputs"),
  metadata: z.record(z.any()).optional().describe("Cell metadata")
});

const NotebookDefinition = z.object({
  nbformat: z.number().default(4).describe("Notebook format version"),
  nbformat_minor: z.number().default(5).describe("Notebook format minor version"),
  cells: z.array(NotebookCell).describe("Notebook cells"),
  metadata: z.object({
    language_info: z.object({
      name: z.enum(["python", "scala", "sql", "r"]).default("python").describe("Primary language")
    }).optional(),
    dependencies: z.object({
      environment: z.object({
        environmentId: z.string().describe("Environment ID"),
        workspaceId: z.string().describe("Environment workspace ID")
      }).optional().describe("Environment configuration"),
      lakehouse: z.object({
        default_lakehouse: z.string().describe("Default lakehouse ID"),
        default_lakehouse_name: z.string().describe("Default lakehouse name"),
        default_lakehouse_workspace_id: z.string().describe("Default lakehouse workspace ID")
      }).optional().describe("Lakehouse configuration")
    }).optional().describe("Notebook dependencies")
  }).optional().describe("Notebook metadata")
});

const CreateNotebookFromTemplateSchema = BaseWorkspaceSchema.extend({
  displayName: z.string().min(1).max(256).describe("Display name for the notebook"),
  template: z.enum([
    "blank",
    "sales_analysis", 
    "nyc_taxi_analysis",
    "data_exploration",
    "machine_learning",
    "custom"
  ]).default("blank").describe("Notebook template to use"),
  customNotebook: NotebookDefinition.optional().describe("Custom notebook definition (required if template is 'custom')"),
  environmentId: z.string().optional().describe("Environment ID to attach"),
  lakehouseId: z.string().optional().describe("Default lakehouse ID"),
  lakehouseName: z.string().optional().describe("Default lakehouse name")
});

const GetNotebookDefinitionSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to get definition for"),
  format: z.enum(["ipynb", "fabricGitSource"]).default("ipynb").describe("Format to return notebook in")
});

const RunNotebookSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to run"),
  parameters: z.record(z.object({
    value: z.any().describe("Parameter value"),
    type: z.enum(["string", "int", "float", "bool"]).default("string").describe("Parameter type")
  })).optional().describe("Notebook parameters"),
  configuration: z.object({
    conf: z.record(z.string()).optional().describe("Spark configuration"),
    environment: z.object({
      id: z.string().describe("Environment ID"),
      name: z.string().optional().describe("Environment name")
    }).optional().describe("Environment to use"),
    defaultLakehouse: z.object({
      name: z.string().describe("Lakehouse name"),
      id: z.string().describe("Lakehouse ID"),
      workspaceId: z.string().optional().describe("Lakehouse workspace ID")
    }).optional().describe("Default lakehouse"),
    useStarterPool: z.boolean().default(false).describe("Use starter pool"),
    useWorkspacePool: z.string().optional().describe("Workspace pool name")
  }).optional().describe("Execution configuration")
});

const UpdateNotebookDefinitionSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to update"),
  notebookDefinition: NotebookDefinition.describe("Updated notebook definition")
});

/**
 * Generate predefined notebook templates
 */
function getNotebookTemplate(template: string): any {
  const templates = {
    blank: {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: "markdown",
          source: ["# New Notebook\n\nStart your analysis here..."],
          metadata: {}
        },
        {
          cell_type: "code",
          source: ["# Import libraries\nimport pandas as pd\nimport numpy as np"],
          execution_count: null,
          outputs: [],
          metadata: {}
        }
      ],
      metadata: {
        language_info: { name: "python" }
      }
    }
  };
  
  return templates[template as keyof typeof templates] || templates.blank;
}

/**
 * Get current authentication status for health checks
 */
function getAuthenticationStatus() {
  const hasFabricToken = !!process.env.FABRIC_TOKEN;
  const hasValidCache = cachedAuthResult && cachedAuthResult.expiresOn > new Date();
  
  return {
    method: authConfig.method,
    configured: !!authConfig.clientId || hasFabricToken,
    hasCachedToken: hasValidCache,
    hasFabricToken: hasFabricToken,
    ready: authConfig.method === AuthMethod.BEARER_TOKEN || hasFabricToken || hasValidCache,
    recommendation: authConfig.method !== AuthMethod.BEARER_TOKEN && !hasFabricToken ? 
      "For Claude Desktop, use FABRIC_AUTH_METHOD=bearer_token with FABRIC_TOKEN" : 
      "Authentication properly configured"
  };
}

/**
 * Validate bearer token format and basic structure
 */
function validateBearerToken(token: string): { isValid: boolean; error?: string; expiresAt?: Date } {
  if (!token || token.length < 10) {
    return { isValid: false, error: "Token too short or empty" };
  }

  // Check if it's a JWT token
  if (token.includes('.')) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.exp) {
          const expiresAt = new Date(payload.exp * 1000);
          if (expiresAt < new Date()) {
            return { isValid: false, error: "Token has expired", expiresAt };
          }
          return { isValid: true, expiresAt };
        }
      }
    } catch (e) {
      // If parsing fails, treat as opaque token
    }
  }

  // For non-JWT tokens, assume valid if not obviously invalid
  return { isValid: true };
}

async function executeApiCall<T>(
  bearerToken: string | undefined,
  workspaceId: string,
  operation: string,
  apiCall: (_client: FabricApiClient) => Promise<ApiResponse<T>>,
  simulationParams?: any
): Promise<ApiResponse<T>> {
  let tokenToUse = bearerToken;

  // If no bearer token provided, check environment variables
  if (!tokenToUse || tokenToUse === "test-token" || tokenToUse === "simulation") {
    // First try environment FABRIC_TOKEN
    tokenToUse = process.env.FABRIC_TOKEN;
    
    // If still no token, try to get from MSAL auth
    if (!tokenToUse && authConfig.method !== AuthMethod.BEARER_TOKEN) {
      const authToken = await getAuthToken();
      tokenToUse = authToken || undefined;
    }
  }

  // Use default workspace if none provided and configured
  const workspaceToUse = workspaceId || authConfig.defaultWorkspaceId || workspaceId;

  if (tokenToUse && tokenToUse !== "test-token" && tokenToUse !== "simulation") {
    try {
      const client = new FabricApiClient(tokenToUse, workspaceToUse);
      return await apiCall(client);
    } catch (error) {
      return {
        status: 'error',
        error: `API call failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } else {
    return SimulationService.simulateApiCall(operation, simulationParams);
  }
}

// Tool implementations
server.tool(
  "list-fabric-items",
  "List items in a Microsoft Fabric workspace",
  ListItemsSchema.shape,
  async ({ bearerToken, workspaceId, itemType }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "list-items",
      (client) => client.listItems(itemType && itemType !== "All" ? itemType : undefined),
      { itemType }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error listing items: ${result.error}` }]
      };
    }

    const items = result.data?.value || [];
    if (items.length === 0) {
      return {
        content: [{ type: "text", text: `No items found in workspace ${workspaceId}` }]
      };
    }

    const itemsList = items.map((item: any, index: number) => 
      `${index + 1}. ${item.displayName} (${item.type})\n   ID: ${item.id}\n   Description: ${item.description || "No description"}\n   Modified: ${item.modifiedDate}`
    ).join("\n\n");

    return {
      content: [{ type: "text", text: `Items in workspace:\n\n${itemsList}` }]
    };
  }
);

server.tool(
  "create-fabric-item",
  "Create a new item in Microsoft Fabric workspace",
  CreateItemSchema.shape,
  async ({ bearerToken, workspaceId, itemType, displayName, description }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-item",
      (client) => client.createItem(itemType, displayName, description),
      { itemType, displayName, description }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating ${itemType}: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully created ${itemType}: "${displayName}"\nID: ${result.data?.id}\nCreated: ${result.data?.createdDate}`
      }]
    };
  }
);

// Additional tool implementations would continue here...

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Microsoft Fabric Analytics MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});