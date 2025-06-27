#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FabricApiClient, ApiResponse, JobExecutionResult } from './fabric-client.js';
import { SimulationService } from './simulation-service.js';
import { MicrosoftAuthClient, AuthMethod, AuthResult } from './auth-client.js';
import http from 'http';
import url from 'url';

// Enhanced Authentication Configuration
interface AuthConfig {
  method: AuthMethod;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
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
    tenantId: process.env.FABRIC_TENANT_ID,
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
  if (!authClient && authConfig.clientId && authConfig.method !== AuthMethod.BEARER_TOKEN) {
    authClient = new MicrosoftAuthClient({
      clientId: authConfig.clientId,
      clientSecret: authConfig.clientSecret,
      authority: authConfig.tenantId ? `https://login.microsoftonline.com/${authConfig.tenantId}` : undefined
    });
  }
}

/**
 * Get or refresh authentication token
 */
async function getAuthToken(): Promise<string | null> {
  // If using bearer token method or no auth configured, return null (use simulation)
  if (authConfig.method === AuthMethod.BEARER_TOKEN || !authConfig.clientId) {
    return null;
  }

  // Check if we have a valid cached token
  if (cachedAuthResult && cachedAuthResult.expiresOn > new Date()) {
    return cachedAuthResult.accessToken;
  }

  // Initialize auth client if needed
  initializeAuthClient();
  if (!authClient) {
    console.error("Authentication client not initialized");
    return null;
  }

  try {
    switch (authConfig.method) {
      case AuthMethod.SERVICE_PRINCIPAL:
        if (!authConfig.clientSecret || !authConfig.tenantId) {
          throw new Error("Service Principal requires CLIENT_SECRET and TENANT_ID");
        }
        cachedAuthResult = await authClient.authenticateWithServicePrincipal(
          authConfig.clientId!,
          authConfig.clientSecret,
          authConfig.tenantId
        );
        break;

      case AuthMethod.DEVICE_CODE:
        cachedAuthResult = await authClient.authenticateWithDeviceCode(
          authConfig.clientId!,
          authConfig.tenantId
        );
        break;

      case AuthMethod.INTERACTIVE:
        cachedAuthResult = await authClient.authenticateInteractively(
          authConfig.clientId!,
          authConfig.tenantId
        );
        break;

      default:
        throw new Error(`Unsupported authentication method: ${authConfig.method}`);
    }

    console.error(`✅ Authentication successful using ${authConfig.method}`);
    return cachedAuthResult.accessToken;
  } catch (error) {
    console.error(`❌ Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
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

/**
 * Helper function to handle API calls with enhanced authentication support.
 * @param bearerToken - Bearer token for authentication (optional if using env auth)
 * @param workspaceId - Workspace ID  
 * @param operation - Operation name for simulation
 * @param apiCall - Function to call the actual API
 * @param simulationParams - Parameters for simulation
 * @returns Promise resolving to API response
 */
async function executeApiCall<T>(
  bearerToken: string | undefined,
  workspaceId: string,
  operation: string,
  apiCall: (client: FabricApiClient) => Promise<ApiResponse<T>>,
  simulationParams?: any
): Promise<ApiResponse<T>> {
  let tokenToUse = bearerToken;

  // If no bearer token provided, try to get one from environment auth
  if (!tokenToUse || tokenToUse === "test-token" || tokenToUse === "simulation") {
    const envToken = await getAuthToken();
    if (envToken) {
      tokenToUse = envToken;
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

server.tool(
  "update-fabric-item",
  "Update an existing item in Microsoft Fabric workspace",
  UpdateItemSchema.shape,
  async ({ bearerToken, workspaceId, itemId, displayName, description }) => {
    const updates: any = {};
    if (displayName) updates.displayName = displayName;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return {
        content: [{ type: "text", text: "No updates specified. Provide displayName or description to update." }]
      };
    }

    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "update-item",
      (client) => client.updateItem(itemId, updates),
      { itemId, updates }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error updating item: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully updated item ${itemId}\nName: ${result.data?.displayName}\nDescription: ${result.data?.description || "No description"}`
      }]
    };
  }
);

server.tool(
  "delete-fabric-item",
  "Delete an item from Microsoft Fabric workspace",
  ItemOperationSchema.shape,
  async ({ bearerToken, workspaceId, itemId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "delete-item",
      (client) => client.deleteItem(itemId),
      { itemId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error deleting item: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: `Successfully deleted item ${itemId} from workspace ${workspaceId}` }]
    };
  }
);

server.tool(
  "get-fabric-item",
  "Get detailed information about a specific Microsoft Fabric item",
  ItemOperationSchema.shape,
  async ({ bearerToken, workspaceId, itemId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-item",
      (client) => client.getItem(itemId),
      { itemId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error retrieving item: ${result.error}` }]
      };
    }

    const item = result.data;
    return {
      content: [{
        type: "text",
        text: `Item Details:\nName: ${item.displayName}\nType: ${item.type}\nID: ${item.id}\nDescription: ${item.description || "No description"}\nCreated: ${item.createdDate}\nModified: ${item.modifiedDate}`
      }]
    };
  }
);

server.tool(
  "execute-fabric-notebook",
  "Execute a notebook in Microsoft Fabric workspace",
  NotebookExecutionSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, parameters, timeout }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "execute-notebook",
      (client) => client.executeNotebook(notebookId, parameters),
      { notebookId, parameters, timeout }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error executing notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Notebook execution started:\nJob ID: ${result.data?.id}\nStatus: ${result.data?.status}\nNotebook ID: ${notebookId}\nStarted: ${result.data?.createdDateTime}${parameters ? `\nParameters: ${JSON.stringify(parameters, null, 2)}` : ""}`
      }]
    };
  }
);

server.tool(
  "submit-spark-job",
  "Submit a Spark job to run on a Lakehouse",
  SparkJobSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, code, language, clusterConfig }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "spark-job",
      (client) => client.submitSparkJob(lakehouseId, code, language, clusterConfig),
      { lakehouseId, code, language, config: clusterConfig }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error submitting Spark job: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Spark job submitted successfully:\nJob ID: ${result.data?.id}\nStatus: ${result.data?.status}\nLanguage: ${language}\nLakehouse ID: ${lakehouseId}\nSubmitted: ${result.data?.createdDateTime}`
      }]
    };
  }
);

server.tool(
  "get-job-status",
  "Get the status of a running job",
  JobStatusSchema.shape,
  async ({ bearerToken, workspaceId, jobId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "job-status",
      (client) => client.getJobStatus(jobId),
      { jobId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting job status: ${result.error}` }]
      };
    }

    const job = result.data;
    if (!job) {
      return {
        content: [{ type: "text", text: "Error: No job data received" }]
      };
    }

    let statusText = `Job Status:\nJob ID: ${job.id}\nStatus: ${job.status}\nCreated: ${job.createdDateTime}`;
    
    if (job.completedDateTime) {
      statusText += `\nCompleted: ${job.completedDateTime}`;
    }
    
    if (job.error) {
      statusText += `\nError: ${job.error}`;
    }

    return {
      content: [{ type: "text", text: statusText }]
    };
  }
);

// Spark Job Definition Tools
server.tool(
  "create-spark-job-instance",
  "Create a Spark job instance from a Spark Job Definition",
  SparkJobInstanceSchema.shape,
  async ({ bearerToken, workspaceId, sparkJobDefinitionId, jobType }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-spark-job-instance",
      (client) => client.createSparkJobInstance(sparkJobDefinitionId, jobType),
      { sparkJobDefinitionId, jobType }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating Spark job instance: ${result.error}` }]
      };
    }

    const instance = result.data;
    if (!instance) {
      return {
        content: [{ type: "text", text: "Error: No instance data received" }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(instance, null, 2) }]
    };
  }
);

server.tool(
  "execute-spark-job-definition",
  "Execute a Spark Job Definition with execution data",
  SparkJobDefinitionSchema.shape,
  async ({ bearerToken, workspaceId, sparkJobDefinitionId, jobType, executionData }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "execute-spark-job-definition",
      (client) => client.executeSparkJobDefinition(sparkJobDefinitionId, jobType, executionData),
      { sparkJobDefinitionId, jobType, executionData }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error executing Spark job definition: ${result.error}` }]
      };
    }

    const execution = result.data;
    if (!execution) {
      return {
        content: [{ type: "text", text: "Error: No execution data received" }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(execution, null, 2) }]
    };
  }
);

server.tool(
  "get-spark-job-instance-status",
  "Get the status of a Spark job instance",
  SparkJobStatusSchema.shape,
  async ({ bearerToken, workspaceId, sparkJobDefinitionId, jobInstanceId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-spark-job-instance-status",
      (client) => client.getSparkJobInstanceStatus(sparkJobDefinitionId, jobInstanceId),
      { sparkJobDefinitionId, jobInstanceId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark job instance status: ${result.error}` }]
      };
    }

    const status = result.data;
    if (!status) {
      return {
        content: [{ type: "text", text: "Error: No status data received" }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(status, null, 2) }]
    };
  }
);

// Livy Session Tools
server.tool(
  "create-livy-session",
  "Create a new Livy session for interactive Spark execution",
  LivySessionSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionConfig }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-livy-session",
      (client) => client.createLivySession(lakehouseId, sessionConfig),
      { lakehouseId, sessionConfig }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating Livy session: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

server.tool(
  "get-livy-session",
  "Get the status of a Livy session",
  LivySessionOperationSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-livy-session",
      (client) => client.getLivySession(lakehouseId, sessionId),
      { lakehouseId, sessionId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Livy session: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

server.tool(
  "list-livy-sessions",
  "List all Livy sessions for a lakehouse",
  BaseWorkspaceSchema.extend({
    lakehouseId: z.string().min(1).describe("Lakehouse ID")
  }).shape,
  async ({ bearerToken, workspaceId, lakehouseId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "list-livy-sessions",
      (client) => client.listLivySessions(lakehouseId),
      { lakehouseId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error listing Livy sessions: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

server.tool(
  "delete-livy-session",
  "Delete a Livy session",
  LivySessionOperationSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "delete-livy-session",
      (client) => client.deleteLivySession(lakehouseId, sessionId),
      { lakehouseId, sessionId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error deleting Livy session: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: "Livy session deleted successfully" }]
    };
  }
);

server.tool(
  "execute-livy-statement",
  "Execute a statement in a Livy session",
  LivyStatementSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId, code, kind }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "execute-livy-statement",
      (client) => client.executeLivyStatement(lakehouseId, sessionId, { code, kind }),
      { lakehouseId, sessionId, code, kind }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error executing Livy statement: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

server.tool(
  "get-livy-statement",
  "Get the result of a statement execution",
  LivyStatementOperationSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId, statementId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-livy-statement",
      (client) => client.getLivyStatement(lakehouseId, sessionId, statementId),
      { lakehouseId, sessionId, statementId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Livy statement: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

server.tool(
  "create-livy-batch",
  "Create a Livy batch job",
  LivyBatchSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, batchConfig }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-livy-batch",
      (client) => client.createLivyBatch(lakehouseId, batchConfig),
      { lakehouseId, batchConfig }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating Livy batch: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

server.tool(
  "get-livy-batch",
  "Get the status of a Livy batch job",
  LivyBatchOperationSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, batchId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-livy-batch",
      (client) => client.getLivyBatch(lakehouseId, batchId),
      { lakehouseId, batchId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Livy batch: ${result.error}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
    };
  }
);

// ==================== SPARK MONITORING TOOLS ====================

server.tool(
  "get-workspace-spark-applications",
  "Get all Spark applications/sessions in a workspace",
  SparkMonitoringBaseSchema.shape,
  async ({ bearerToken, workspaceId, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-workspace-spark-applications",
      (client) => client.getWorkspaceSparkApplications(continuationToken),
      { continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting workspace Spark applications: ${result.error}` }]
      };
    }    const data = result.data || { value: [], continuationToken: null };
    const summary = {
      total: data.value?.length || 0,
      continuationToken: data.continuationToken,
      applications: data.value || []
    };

    return {
      content: [{ 
        type: "text", 
        text: `Workspace Spark Applications (${summary.total} found):\n\n${JSON.stringify(summary, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "get-notebook-spark-applications",
  "Get all Spark applications/sessions for a specific notebook",
  SparkNotebookMonitoringSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook-spark-applications",
      (client) => client.getNotebookSparkApplications(notebookId, continuationToken),
      { notebookId, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook Spark applications: ${result.error}` }]
      };
    }    const data = result.data || { value: [], continuationToken: null };
    const summary = {
      notebookId,
      total: data.value?.length || 0,
      continuationToken: data.continuationToken,
      applications: data.value || []
    };

    return {
      content: [{ 
        type: "text", 
        text: `Notebook ${notebookId} Spark Applications (${summary.total} found):\n\n${JSON.stringify(summary, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "get-spark-job-definition-applications",
  "Get all Spark applications/sessions for a specific Spark job definition",
  SparkJobDefinitionMonitoringSchema.shape,
  async ({ bearerToken, workspaceId, sparkJobDefinitionId, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-spark-job-definition-applications",
      (client) => client.getSparkJobDefinitionApplications(sparkJobDefinitionId, continuationToken),
      { sparkJobDefinitionId, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark job definition applications: ${result.error}` }]
      };
    }    const data = result.data || { value: [], continuationToken: null };
    const summary = {
      sparkJobDefinitionId,
      total: data.value?.length || 0,
      continuationToken: data.continuationToken,
      applications: data.value || []
    };

    return {
      content: [{ 
        type: "text", 
        text: `Spark Job Definition ${sparkJobDefinitionId} Applications (${summary.total} found):\n\n${JSON.stringify(summary, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "get-lakehouse-spark-applications",
  "Get all Spark applications/sessions for a specific lakehouse",
  SparkLakehouseMonitoringSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-lakehouse-spark-applications",
      (client) => client.getLakehouseSparkApplications(lakehouseId, continuationToken),
      { lakehouseId, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting lakehouse Spark applications: ${result.error}` }]
      };
    }    const data = result.data || { value: [], continuationToken: null };
    const summary = {
      lakehouseId,
      total: data.value?.length || 0,
      continuationToken: data.continuationToken,
      applications: data.value || []
    };

    return {
      content: [{ 
        type: "text", 
        text: `Lakehouse ${lakehouseId} Spark Applications (${summary.total} found):\n\n${JSON.stringify(summary, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "get-spark-application-details",
  "Get detailed information about a specific Spark application",
  SparkApplicationOperationSchema.shape,
  async ({ bearerToken, workspaceId, livyId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-spark-application-details",
      (client) => client.getSparkApplicationDetails(livyId),
      { livyId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark application details: ${result.error}` }]
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `Spark Application ${livyId} Details:\n\n${JSON.stringify(result.data, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "cancel-spark-application",
  "Cancel a running Spark application",
  SparkApplicationOperationSchema.shape,
  async ({ bearerToken, workspaceId, livyId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "cancel-spark-application",
      (client) => client.cancelSparkApplication(livyId),
      { livyId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error cancelling Spark application: ${result.error}` }]
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `Spark Application ${livyId} cancellation request submitted:\n\n${JSON.stringify(result.data, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "get-spark-monitoring-dashboard",
  "Get comprehensive Spark monitoring dashboard for workspace",
  SparkDashboardSchema.shape,
  async ({ bearerToken, workspaceId, includeCompleted, maxResults }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-spark-monitoring-dashboard",
      (client) => client.getSparkMonitoringDashboard(includeCompleted, maxResults),
      { includeCompleted, maxResults }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark monitoring dashboard: ${result.error}` }]
      };
    }

    const dashboard = result.data;
    const dashboardText = `
🔥 Spark Monitoring Dashboard - Workspace ${workspaceId}
${'='.repeat(60)}

📊 Summary:
  • Total Applications: ${dashboard.summary.total}
  • Running: ${dashboard.summary.running}
  • Completed: ${dashboard.summary.completed}
  • Failed/Cancelled: ${dashboard.summary.failed}
  • Pending: ${dashboard.summary.pending}

📈 By Item Type:
${Object.entries(dashboard.byItemType).map(([type, count]) => `  • ${type}: ${count}`).join('\n')}

📊 By State:
${Object.entries(dashboard.byState).map(([state, count]) => `  • ${state}: ${count}`).join('\n')}

🕒 Recent Activity (Last 10):
${dashboard.recentActivity.map((app: any, i: number) => `
  ${i + 1}. ${app.itemName} (${app.itemType})
     State: ${app.state}
     Submitted: ${app.submittedDateTime}
     Duration: ${app.totalDuration ? `${app.totalDuration.value} ${app.totalDuration.timeUnit}` : 'N/A'}
`).join('')}

📋 All Applications:
${JSON.stringify(dashboard.applications, null, 2)}
    `;

    return {
      content: [{ type: "text", text: dashboardText }]
    };
  }
);

// Authentication Status Tool
server.tool(
  "check-fabric-auth-status",
  "Check current authentication status and configuration",
  z.object({}).shape,
  async () => {
    const status = {
      authMethod: authConfig.method,
      hasClientId: !!authConfig.clientId,
      hasClientSecret: !!authConfig.clientSecret,
      hasTenantId: !!authConfig.tenantId,
      hasDefaultWorkspace: !!authConfig.defaultWorkspaceId,
      tokenCached: !!cachedAuthResult,
      tokenExpiry: cachedAuthResult?.expiresOn?.toISOString() || null,
      tokenValid: cachedAuthResult ? cachedAuthResult.expiresOn > new Date() : false
    };

    const statusText = `
🔐 **Microsoft Fabric Authentication Status**
${'='.repeat(50)}

**Authentication Method**: ${status.authMethod}

**Configuration**:
  ✅ Client ID: ${status.hasClientId ? 'Configured' : '❌ Missing'}
  ${status.authMethod === 'service_principal' ? `✅ Client Secret: ${status.hasClientSecret ? 'Configured' : '❌ Missing'}` : ''}
  ${status.authMethod !== 'bearer' ? `✅ Tenant ID: ${status.hasTenantId ? 'Configured' : '❌ Missing'}` : ''}
  ✅ Default Workspace: ${status.hasDefaultWorkspace ? authConfig.defaultWorkspaceId : '❌ Not configured'}

**Token Status**:
  • Token Cached: ${status.tokenCached ? '✅ Yes' : '❌ No'}
  • Token Valid: ${status.tokenValid ? '✅ Yes' : '❌ No/Expired'}
  • Expires: ${status.tokenExpiry || 'N/A'}

**Setup Instructions**:
${status.authMethod === 'bearer' ? `
For bearer token authentication, provide a valid token in tool calls.
` : `
To use ${status.authMethod} authentication, ensure these environment variables are set:
${status.authMethod === 'service_principal' ? `
  - FABRIC_CLIENT_ID
  - FABRIC_CLIENT_SECRET  
  - FABRIC_TENANT_ID
` : status.authMethod === 'device_code' ? `
  - FABRIC_CLIENT_ID
  - FABRIC_TENANT_ID (optional)
` : `
  - FABRIC_CLIENT_ID
  - FABRIC_TENANT_ID (optional)
`}
  - FABRIC_DEFAULT_WORKSPACE_ID (optional)
`}

**Next Steps**:
${!status.tokenValid && status.authMethod !== 'bearer' ? `
⚠️  Authentication required! Use any Fabric tool to trigger authentication.
` : status.tokenValid ? `
✅ Ready to use Microsoft Fabric APIs!
` : `
💡 Using simulation mode. Configure authentication for real API access.
`}
    `;

    return {
      content: [{ type: "text", text: statusText }]
    };
  }
)

/**
 * Health check endpoint for Docker/Kubernetes deployments
 */
function createHealthServer(): http.Server {
  const healthServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (pathname === '/health') {
      // Basic health check
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      }));
    } else if (pathname === '/ready') {
      // Readiness check - verify authentication and dependencies
      const checkReadiness = async () => {
        try {
          // Quick auth check if configured
          if (authConfig.method !== AuthMethod.BEARER_TOKEN && authClient) {
            // Don't actually authenticate, just check if we have the required config
            if (!authConfig.clientId || !authConfig.tenantId) {
              throw new Error('Missing required authentication configuration');
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ready',
            timestamp: new Date().toISOString(),
            authMethod: authConfig.method,
            hasClientId: !!authConfig.clientId,
            hasTenantId: !!authConfig.tenantId,
            hasDefaultWorkspace: !!authConfig.defaultWorkspaceId
          }));
        } catch (error) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      };

      checkReadiness().catch((error) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      });
    } else if (pathname === '/metrics') {
      // Basic metrics endpoint for monitoring
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      const metrics = [
        `# HELP mcp_server_uptime_seconds Server uptime in seconds`,
        `# TYPE mcp_server_uptime_seconds counter`,
        `mcp_server_uptime_seconds ${process.uptime()}`,
        ``,
        `# HELP mcp_server_memory_usage_bytes Memory usage in bytes`,
        `# TYPE mcp_server_memory_usage_bytes gauge`,
        `mcp_server_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
        `mcp_server_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}`,
        `mcp_server_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}`,
        `mcp_server_memory_usage_bytes{type="external"} ${process.memoryUsage().external}`,
        ``,
        `# HELP mcp_server_auth_method Authentication method configured`,
        `# TYPE mcp_server_auth_method info`,
        `mcp_server_auth_method{method="${authConfig.method}"} 1`,
        ``
      ].join('\n');
      res.end(metrics);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not Found',
        message: 'Available endpoints: /health, /ready, /metrics'
      }));
    }
  });

  return healthServer;
}

async function main() {
  // Start health server for Docker/Kubernetes deployments
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const enableHealthServer = process.env.ENABLE_HEALTH_SERVER !== 'false';
  
  if (enableHealthServer) {
    const healthServer = createHealthServer();
    healthServer.listen(port, () => {
      console.error(`Health server listening on port ${port}`);
      console.error('Health endpoints:');
      console.error(`  http://localhost:${port}/health - Health check`);
      console.error(`  http://localhost:${port}/ready - Readiness check`);
      console.error(`  http://localhost:${port}/metrics - Metrics endpoint`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.error('SIGTERM received, shutting down gracefully');
      healthServer.close(() => {
        console.error('Health server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.error('SIGINT received, shutting down gracefully');
      healthServer.close(() => {
        console.error('Health server closed');
        process.exit(0);
      });
    });
  }

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Microsoft Fabric Analytics MCP Server running on stdio");
  
  if (enableHealthServer) {
    console.error(`Health endpoints available at http://localhost:${port}`);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
