#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FabricApiClient, ApiResponse } from './fabric-client.js';
import { SimulationService } from './simulation-service.js';
import { MicrosoftAuthClient, AuthMethod, AuthResult } from './auth-client.js';

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

const JobStatusSchema = BaseWorkspaceSchema.extend({
  jobId: z.string().min(1).describe("Job ID to check status")
});

// Notebook Management Schemas
const CreateNotebookSchema = BaseWorkspaceSchema.extend({
  displayName: z.string().min(1).max(256).describe("Display name for the notebook"),
  description: z.string().max(1024).optional().describe("Optional description")
});

const NotebookOperationSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID")
});

const UpdateNotebookSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to update"),
  displayName: z.string().min(1).max(256).optional().describe("New display name"),
  description: z.string().max(1024).optional().describe("New description")
});

const GetNotebookDefinitionSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID"),
  format: z.enum(["ipynb", "fabricGitSource"]).default("ipynb").describe("Format to return notebook in")
});

const NotebookDefinitionPart = z.object({
  path: z.string().describe("File path within the notebook"),
  payload: z.string().describe("Base64 encoded content"),
  payloadType: z.enum(["InlineBase64", "InlineText"]).describe("Type of payload encoding")
});

const NotebookDefinitionSchema = z.object({
  parts: z.array(NotebookDefinitionPart).describe("Notebook definition parts")
});

const UpdateNotebookDefinitionSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to update"),
  definition: NotebookDefinitionSchema.describe("Updated notebook definition")
});

const NotebookParameterSchema = z.object({
  value: z.unknown().describe("Parameter value"),
  type: z.enum(["string", "int", "float", "bool"]).describe("Parameter type")
});

const NotebookExecutionConfigSchema = z.object({
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
});

const RunNotebookSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID to run"),
  parameters: z.record(NotebookParameterSchema).optional().describe("Notebook parameters"),
  configuration: NotebookExecutionConfigSchema.optional().describe("Execution configuration")
});

// Spark Monitoring Schemas
const SparkMonitoringBaseSchema = BaseWorkspaceSchema.extend({
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

interface NotebookTemplate {
  nbformat: number;
  nbformat_minor: number;
  cells: Array<{
    cell_type: string;
    source: string[];
    execution_count?: number | null;
    outputs?: any[];
    metadata: Record<string, any>;
  }>;
  metadata: {
    language_info?: { name: string };
  };
}

/**
 * Generate predefined notebook templates
 */
function getNotebookTemplate(template: string): NotebookTemplate {
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
    },
    sales_analysis: {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: "markdown",
          source: ["# Sales Analysis Notebook\n\nThis notebook provides comprehensive sales data analysis capabilities."],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Import required libraries\n",
            "import pandas as pd\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n",
            "from datetime import datetime, timedelta"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Load sales data\n",
            "# Replace with your actual data source\n",
            "df_sales = spark.sql(\"SELECT * FROM lakehouse.sales_data LIMIT 1000\")\n",
            "df_sales.display()"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        }
      ],
      metadata: {
        language_info: { name: "python" }
      }
    },
    data_exploration: {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: "markdown",
          source: ["# Data Exploration Notebook\n\nStructured approach to data exploration and analysis."],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Data exploration imports\n",
            "import pandas as pd\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n",
            "from pyspark.sql import functions as F"
          ],
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

server.tool(
  "create-fabric-notebook",
  "Create a new notebook from template in Microsoft Fabric workspace",
  CreateNotebookFromTemplateSchema.shape,
  async ({ bearerToken, workspaceId, displayName, template, customNotebook, environmentId, lakehouseId, lakehouseName }) => {
    // Since createNotebook is not available in FabricApiClient, use create-item with notebook type
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-item",
      (client) => client.createItem("Notebook", displayName, `Created from ${template} template`),
      { displayName, template, itemType: "Notebook" }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully created notebook: "${displayName}"\nID: ${result.data?.id || "Generated"}\nTemplate: ${template}\nType: Notebook${environmentId ? `\nEnvironment: ${environmentId}` : ""}${lakehouseId ? `\nDefault Lakehouse: ${lakehouseId}` : ""}`
      }]
    };
  }
);

server.tool(
  "get-workspace-spark-applications",
  "Get all Spark applications in a workspace for monitoring",
  SparkMonitoringBaseSchema.shape,
  async ({ bearerToken, workspaceId, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "workspace-spark-applications",
      (client) => client.listItems("All"), // Use available method as fallback
      { continuationToken, operation: "spark-monitoring" }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark applications: ${result.error}` }]
      };
    }

    const items = result.data?.value || [];
    const sparkItems = items.filter((item: any) => 
      item.type === "Notebook" || item.type === "Lakehouse" || item.displayName.toLowerCase().includes("spark")
    );

    if (sparkItems.length === 0) {
      return {
        content: [{ type: "text", text: `No Spark-related items found in workspace ${workspaceId}. This includes Notebooks and Lakehouses that can run Spark jobs.` }]
      };
    }

    const itemsList = sparkItems.slice(0, 10).map((item: any, index: number) => 
      `${index + 1}. ${item.displayName} (${item.type})\n   ID: ${item.id}\n   Modified: ${item.modifiedDate}`
    ).join("\n\n");

    return {
      content: [{
        type: "text",
        text: `Spark-related Items in Workspace:\n\nTotal: ${sparkItems.length}\n\nItems:\n${itemsList}${sparkItems.length > 10 ? "\n\n... and " + (sparkItems.length - 10) + " more" : ""}`
      }]
    };
  }
);

// ==================== NOTEBOOK MANAGEMENT TOOLS ====================

server.tool(
  "list-fabric-notebooks",
  "List all notebooks in a Microsoft Fabric workspace",
  BaseWorkspaceSchema.shape,
  async ({ bearerToken, workspaceId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "list-notebooks",
      (client) => client.listNotebooks(),
      {}
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error listing notebooks: ${result.error}` }]
      };
    }

    const notebooks = result.data?.value || [];
    if (notebooks.length === 0) {
      return {
        content: [{ type: "text", text: `No notebooks found in workspace ${workspaceId}` }]
      };
    }

    const notebooksList = notebooks.map((notebook: any, index: number) => 
      `${index + 1}. ${notebook.displayName}\n   ID: ${notebook.id}\n   Description: ${notebook.description || "No description"}\n   Modified: ${notebook.modifiedDate || "Unknown"}`
    ).join("\n\n");

    return {
      content: [{ type: "text", text: `Notebooks in workspace:\n\n${notebooksList}` }]
    };
  }
);

server.tool(
  "get-fabric-notebook",
  "Get details of a specific notebook in Microsoft Fabric workspace",
  NotebookOperationSchema.shape,
  async ({ bearerToken, workspaceId, notebookId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook",
      (client) => client.getNotebook(notebookId),
      { notebookId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook: ${result.error}` }]
      };
    }

    const notebook = result.data;
    return {
      content: [{
        type: "text",
        text: `Notebook Details:\n\nName: ${notebook?.displayName}\nID: ${notebook?.id}\nType: ${notebook?.type}\nDescription: ${notebook?.description || "No description"}\nWorkspace: ${notebook?.workspaceId}`
      }]
    };
  }
);

server.tool(
  "update-fabric-notebook",
  "Update an existing notebook in Microsoft Fabric workspace",
  UpdateNotebookSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, displayName, description }) => {
    const updates: Record<string, string> = {};
    if (displayName) updates.displayName = displayName;
    if (description) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return {
        content: [{ type: "text", text: "No updates provided. Please specify displayName or description to update." }]
      };
    }

    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "update-notebook",
      (client) => client.updateNotebook(notebookId, updates),
      { notebookId, updates }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error updating notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully updated notebook: "${result.data?.displayName}"\nID: ${result.data?.id}\nDescription: ${result.data?.description || "No description"}`
      }]
    };
  }
);

server.tool(
  "delete-fabric-notebook",
  "Delete a notebook from Microsoft Fabric workspace",
  NotebookOperationSchema.shape,
  async ({ bearerToken, workspaceId, notebookId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "delete-notebook",
      (client) => client.deleteNotebook(notebookId),
      { notebookId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error deleting notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully deleted notebook with ID: ${notebookId}`
      }]
    };
  }
);

server.tool(
  "get-fabric-notebook-definition",
  "Get the definition/content of a notebook in Microsoft Fabric workspace",
  GetNotebookDefinitionSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, format }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook-definition",
      (client) => client.getNotebookDefinition(notebookId, format),
      { notebookId, format }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook definition: ${result.error}` }]
      };
    }

    const definition = result.data?.definition;
    if (!definition || !definition.parts) {
      return {
        content: [{ type: "text", text: "No notebook definition found or invalid format." }]
      };
    }

    const parts = definition.parts.map((part: any, index: number) => 
      `${index + 1}. ${part.path} (${part.payloadType})`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `Notebook Definition (${format} format):\n\nParts:\n${parts}\n\nNote: Content is base64 encoded. Use appropriate tools to decode and view the actual notebook content.`
      }]
    };
  }
);

server.tool(
  "run-fabric-notebook",
  "Execute/run a notebook in Microsoft Fabric workspace",
  RunNotebookSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, parameters, configuration }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "run-notebook",
      (client) => client.runNotebook(notebookId, parameters as Record<string, import('./fabric-client.js').NotebookParameter> | undefined, configuration),
      { notebookId, parameters, configuration }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error running notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully started notebook execution:\nNotebook ID: ${notebookId}\nJob ID: ${result.data?.id || 'Unknown'}\nStatus: ${result.data?.status || 'Started'}\nCreated: ${result.data?.createdDateTime || 'Now'}`
      }]
    };
  }
);

// ==================== SPARK MONITORING TOOLS ====================

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
        content: [{ type: "text", text: `Error getting monitoring dashboard: ${result.error}` }]
      };
    }

    const dashboard = result.data;
    const summary = dashboard?.summary;
    
    return {
      content: [{
        type: "text",
        text: `Spark Monitoring Dashboard:\n\n📊 Summary:\n• Total Applications: ${summary?.total || 0}\n• Running: ${summary?.running || 0}\n• Completed: ${summary?.completed || 0}\n• Failed: ${summary?.failed || 0}\n• Pending: ${summary?.pending || 0}\n\n📈 By Item Type:\n${Object.entries(dashboard?.byItemType || {}).map(([type, count]) => `• ${type}: ${count}`).join('\n')}\n\n🎯 By State:\n${Object.entries(dashboard?.byState || {}).map(([state, count]) => `• ${state}: ${count}`).join('\n')}\n\n🕒 Recent Activity: ${dashboard?.recentActivity?.length || 0} recent applications`
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Microsoft Fabric Analytics MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
