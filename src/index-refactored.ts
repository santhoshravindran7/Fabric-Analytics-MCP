#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Configuration and types
interface FabricConfig {
  apiBaseUrl: string;
  version: string;
  userAgent: string;
  timeout: number;
}

interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  error?: string;
}

interface JobExecutionResult {
  id: string;
  status: string;
  createdDateTime: string;
  completedDateTime?: string;
  error?: string;
}

interface SparkJobConfig {
  driverCores: number;
  driverMemory: string;
  executorCores: number;
  executorMemory: string;
  numExecutors: number;
}

// Default configuration
const DEFAULT_CONFIG: FabricConfig = {
  apiBaseUrl: "https://api.fabric.microsoft.com/v1",
  version: "1.0.0",
  userAgent: "Fabric-Analytics-MCP-Server/1.0.0",
  timeout: 30000
};

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

// API Client class for better organization and testability
class FabricApiClient {
  constructor(
    private bearerToken: string,
    private workspaceId: string,
    private config: FabricConfig = DEFAULT_CONFIG
  ) {}

  async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = "GET", body, headers = {} } = options;
    const url = `${this.config.apiBaseUrl}/workspaces/${this.workspaceId}/${endpoint}`;
    
    const requestHeaders: Record<string, string> = {
      "Authorization": `Bearer ${this.bearerToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": this.config.userAgent,
      ...headers
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json();
      return {
        status: 'success',
        data
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Request failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async listItems(itemType?: string): Promise<ApiResponse> {
    const endpoint = itemType ? `items?type=${itemType}` : "items";
    return this.makeRequest(endpoint);
  }

  async createItem(itemType: string, displayName: string, description?: string): Promise<ApiResponse> {
    const body = {
      displayName,
      type: itemType,
      ...(description && { description })
    };
    return this.makeRequest("items", { method: "POST", body });
  }

  async getItem(itemId: string): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}`);
  }

  async updateItem(itemId: string, updates: { displayName?: string; description?: string }): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}`, { method: "PATCH", body: updates });
  }

  async deleteItem(itemId: string): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}`, { method: "DELETE" });
  }

  async executeNotebook(notebookId: string, parameters?: Record<string, any>): Promise<ApiResponse<JobExecutionResult>> {
    const body = parameters ? { parameters } : {};
    return this.makeRequest(`items/${notebookId}/jobs/instances`, { method: "POST", body });
  }

  async submitSparkJob(lakehouseId: string, code: string, language: string = "python", config?: SparkJobConfig): Promise<ApiResponse<JobExecutionResult>> {
    const body = {
      code,
      language,
      lakehouseId,
      ...(config && { clusterConfig: config })
    };
    return this.makeRequest(`items/${lakehouseId}/jobs/spark`, { method: "POST", body });
  }

  async getJobStatus(jobId: string): Promise<ApiResponse<JobExecutionResult>> {
    return this.makeRequest(`jobs/${jobId}`);
  }
}

// Simulation service for testing without real API access
class SimulationService {
  static async simulateApiCall(operation: string, params: any = {}): Promise<ApiResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    switch (operation) {
      case "list-items":
        return {
          status: 'success',
          data: {
            value: [
              {
                id: "lh-sample-001",
                displayName: "Sales Analytics Lakehouse",
                type: "Lakehouse",
                description: "Main lakehouse for sales data processing",
                createdDate: "2025-06-01T10:00:00Z",
                modifiedDate: "2025-06-18T08:30:00Z"
              },
              {
                id: "nb-sample-001",
                displayName: "Customer Analysis Notebook",
                type: "Notebook",
                description: "Notebook for customer segmentation analysis",
                createdDate: "2025-06-10T14:20:00Z",
                modifiedDate: "2025-06-18T09:15:00Z"
              }
            ]
          }
        };

      case "create-item":
        return {
          status: 'success',
          data: {
            id: `${params.itemType.toLowerCase()}-${Date.now()}`,
            displayName: params.displayName,
            type: params.itemType,
            description: params.description || "",
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString()
          }
        };

      case "execute-notebook":
        return {
          status: 'success',
          data: {
            id: `job-nb-${Date.now()}`,
            status: "Running",
            createdDateTime: new Date().toISOString(),
            type: "NotebookExecution"
          }
        };

      case "spark-job":
        return {
          status: 'success',
          data: {
            id: `spark-job-${Date.now()}`,
            status: "Submitted",
            createdDateTime: new Date().toISOString(),
            language: params.language || "python",
            clusterInfo: params.config || {
              driverCores: 4,
              driverMemory: "8g",
              executorCores: 2,
              executorMemory: "4g",
              numExecutors: 2
            }
          }
        };

      case "job-status":
        const statuses = ["Running", "Completed", "Failed", "Cancelled"];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        return {
          status: 'success',
          data: {
            id: params.jobId,
            status: randomStatus,
            createdDateTime: new Date(Date.now() - 300000).toISOString(),
            ...(randomStatus === "Completed" && { completedDateTime: new Date().toISOString() }),
            ...(randomStatus === "Failed" && { error: "Sample execution error for testing" })
          }
        };

      default:
        return {
          status: 'error',
          error: `Unknown simulation operation: ${operation}`
        };
    }
  }
}

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

// Helper function to handle API calls with fallback to simulation
async function executeApiCall<T>(
  bearerToken: string | undefined,
  workspaceId: string,
  operation: string,
  apiCall: (client: FabricApiClient) => Promise<ApiResponse<T>>,
  simulationParams?: any
): Promise<ApiResponse<T>> {
  if (bearerToken && bearerToken !== "test-token" && bearerToken !== "simulation") {
    try {
      const client = new FabricApiClient(bearerToken, workspaceId);
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
    }    const job = result.data;
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Microsoft Fabric Analytics MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
