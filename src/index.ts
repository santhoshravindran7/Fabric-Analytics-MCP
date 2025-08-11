#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FabricApiClient, ApiResponse } from './fabric-client.js';
import { SimulationService } from './simulation-service.js';
import { MicrosoftAuthClient, AuthMethod, AuthResult } from './auth-client.js';
import http from 'http';
import url from 'url';

// Type definitions for Fabric items
interface FabricItem {
  id: string;
  displayName: string;
  type: string;
  description?: string;
  modifiedDate?: string;
}

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
  if (!authClient && authConfig.method !== AuthMethod.BEARER_TOKEN) {
    // For Azure CLI, we still need a client instance even without clientId
    const clientId = authConfig.clientId || "04b07795-8ddb-461a-bbee-02f9e1bf7b46"; // Default Azure CLI client ID
    
    authClient = new MicrosoftAuthClient({
      clientId: clientId,
      clientSecret: authConfig.clientSecret,
      authority: authConfig.tenantId ? `https://login.microsoftonline.com/${authConfig.tenantId}` : undefined
    });
  }
}

/**
 * Get or refresh authentication token with timeout protection for Claude Desktop
 */
async function getAuthToken(): Promise<string | null> {
  // If using bearer token method, return null (use simulation or environment token)
  if (authConfig.method === AuthMethod.BEARER_TOKEN) {
    return null;
  }

  // For Azure CLI, we don't need a clientId from config
  if (authConfig.method === AuthMethod.AZURE_CLI) {
    // Check if we have a valid cached token
    if (cachedAuthResult && cachedAuthResult.expiresOn > new Date()) {
      return cachedAuthResult.accessToken;
    }

    // Initialize auth client for Azure CLI
    initializeAuthClient();
    if (!authClient) {
      console.error("Authentication client not initialized");
      return null;
    }

    try {
      const result = await authClient.authenticateWithAzureCli();
      if (result) {
        cachedAuthResult = result;
        console.error(`✅ Azure CLI authentication successful`);
        return cachedAuthResult.accessToken;
      } else {
        console.error(`❌ Azure CLI authentication returned null`);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Azure CLI authentication failed: ${errorMessage}`);
      return null;
    }
  }

  // For other methods, require clientId
  if (!authConfig.clientId) {
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

  // Wrap authentication in a timeout to prevent blocking in Claude Desktop
  const authTimeout = 10000; // 10 seconds timeout to prevent blocking
  
  try {
    const authPromise = performAuthentication();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Authentication timeout - Claude Desktop environment may not support interactive authentication. Consider using FABRIC_AUTH_METHOD=bearer_token with a pre-generated token."));
      }, authTimeout);
    });

    cachedAuthResult = await Promise.race([authPromise, timeoutPromise]);
    console.error(`✅ Authentication successful using ${authConfig.method}`);
    return cachedAuthResult.accessToken;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Authentication failed: ${errorMessage}`);
    
    // Provide helpful guidance for Claude Desktop users
    if (errorMessage.includes("timeout") || errorMessage.includes("Claude Desktop")) {
      console.error("💡 For Claude Desktop usage, consider using bearer token authentication:");
      console.error("   1. Set FABRIC_AUTH_METHOD=bearer_token");
      console.error("   2. Provide token directly in tool calls");
      console.error("   3. Or set FABRIC_TOKEN environment variable");
    }
    
    return null;
  }
}

/**
 * Perform the actual authentication based on configured method
 */
async function performAuthentication(): Promise<AuthResult> {
  if (!authClient) {
    throw new Error("Authentication client not initialized");
  }

  switch (authConfig.method) {
    case AuthMethod.SERVICE_PRINCIPAL:
      if (!authConfig.clientSecret || !authConfig.tenantId) {
        throw new Error("Service Principal requires CLIENT_SECRET and TENANT_ID");
      }
      return await authClient.authenticateWithServicePrincipal(
        authConfig.clientId!,
        authConfig.clientSecret,
        authConfig.tenantId
      );

    case AuthMethod.DEVICE_CODE:
      return await authClient.authenticateWithDeviceCode(
        authConfig.clientId!,
        authConfig.tenantId
      );

    case AuthMethod.INTERACTIVE:
      return await authClient.authenticateInteractively(
        authConfig.clientId!,
        authConfig.tenantId
      );

    case AuthMethod.AZURE_CLI: {
      const result = await authClient.authenticateWithAzureCli();
      if (!result) {
        throw new Error("Azure CLI authentication returned null");
      }
      return result;
    }

    default:
      throw new Error(`Unsupported authentication method: ${authConfig.method}`);
  }
}

// Server instance
const server = new McpServer({
  name: "fabric-analytics",
  version: "1.0.0",
}, {
  capabilities: {
    logging: {},
    tools: {},
    resources: {}
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
const _CreateNotebookSchema = BaseWorkspaceSchema.extend({
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

const _UpdateNotebookDefinitionSchema = BaseWorkspaceSchema.extend({
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

// Additional Spark Job Schemas
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

// Livy Session Schemas
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

// Enhanced Spark Monitoring Schemas
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

// Restored missing schemas
const SparkMonitoringBaseSchema = BaseWorkspaceSchema.extend({
  continuationToken: z.string().optional().describe("Continuation token for pagination")
});

const SparkApplicationOperationSchema = BaseWorkspaceSchema.extend({
  livyId: z.string().min(1).describe("Livy session/application ID")
});

const NotebookSparkApplicationSchema = BaseWorkspaceSchema.extend({
  notebookId: z.string().min(1).describe("Notebook ID"),
  livyId: z.string().min(1).describe("Livy session ID"),
  appId: z.string().min(1).describe("Spark application ID (e.g., application_1742369571479_0001)"),
  attemptId: z.string().optional().describe("Optional attempt ID"),
  jobId: z.string().optional().describe("Optional specific job ID for job details")
});

const SparkDashboardSchema = BaseWorkspaceSchema.extend({
  includeCompleted: z.boolean().default(true).describe("Include completed applications"),
  maxResults: z.number().min(1).max(1000).default(100).describe("Maximum number of results")
});

// Enhanced Livy Log Analysis Schemas
const LivySessionLogAnalysisSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.number().min(0).describe("Livy session ID"),
  analysisType: z.enum(["summary", "detailed", "performance", "errors", "recommendations"]).default("detailed").describe("Type of log analysis to perform"),
  useLLM: z.boolean().default(true).describe("Use LLM for intelligent log analysis")
});

const LivyStatementLogAnalysisSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"), 
  sessionId: z.number().min(0).describe("Livy session ID"),
  statementId: z.number().min(0).describe("Statement ID to analyze"),
  analysisType: z.enum(["performance", "errors", "optimization", "comprehensive"]).default("comprehensive").describe("Type of analysis to perform"),
  includeRecommendations: z.boolean().default(true).describe("Include optimization recommendations")
});

const LivyExecutionHistorySchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.number().min(0).optional().describe("Optional specific session ID to analyze"),
  timeRange: z.enum(["1h", "6h", "24h", "7d", "30d"]).default("24h").describe("Time range for history analysis"),
  analysisType: z.enum(["performance_trends", "error_patterns", "resource_usage", "comprehensive"]).default("comprehensive").describe("Type of historical analysis")
});

// Workspace Management Schemas
const ListWorkspacesSchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication"),
  type: z.string().optional().describe("Optional workspace type filter"),
  capacityId: z.string().optional().describe("Optional capacity ID filter"),
  name: z.string().optional().describe("Optional name filter"),
  state: z.string().optional().describe("Optional state filter (Active, Deleted, etc.)"),
  continuationToken: z.string().optional().describe("Optional continuation token for pagination")
});

const FindWorkspaceSchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication"),
  searchName: z.string().min(1).describe("Workspace name to search for (partial match supported)")
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

const _CreateNotebookFromTemplateSchema = BaseWorkspaceSchema.extend({
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
    outputs?: unknown[];
    metadata: Record<string, unknown>;
  }>;
  metadata: {
    language_info?: { name: string };
  };
}

/**
 * Generate predefined notebook templates
 */
function _getNotebookTemplate(template: string): NotebookTemplate {
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
    return { isValid: false, error: "Token is too short or empty" };
  }

  // Skip validation for special tokens
  if (token === "azure_cli" || token === "simulation" || token === "test-token") {
    return { isValid: true };
  }

  // Check if it's a JWT token
  if (token.includes('.')) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { isValid: false, error: "Invalid JWT format" };
      }

      // Decode JWT payload to check expiration
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      if (payload.exp) {
        const expirationDate = new Date(payload.exp * 1000);
        const now = new Date();
        
        if (expirationDate <= now) {
          return { 
            isValid: false, 
            error: `Token expired at ${expirationDate.toISOString()}`,
            expiresAt: expirationDate
          };
        }
        
        // Warn if token expires soon (within 1 hour)
        const oneHour = 60 * 60 * 1000;
        if (expirationDate.getTime() - now.getTime() < oneHour) {
          console.error(`⚠️ Token expires soon: ${expirationDate.toISOString()}`);
        }
        
        return { isValid: true, expiresAt: expirationDate };
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    } catch (error) {
      return { isValid: false, error: "Failed to decode JWT token" };
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
  simulationParams?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  let tokenToUse = bearerToken;

  // Handle special Azure CLI token request
  if (tokenToUse === "azure_cli") {
    console.error("🔄 Azure CLI authentication requested via bearerToken parameter");
    
    // Try direct Azure CLI command execution since auth client might fail in isolated process
    try {
      const { execSync } = require('child_process');
      const command = 'az account get-access-token --resource "https://analysis.windows.net/powerbi/api" --query "accessToken" --output tsv';
      const directToken = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
        stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, capture stdout and stderr
      }).trim();
      
      if (directToken && directToken.length > 100) {
        tokenToUse = directToken;
        console.error("✅ Successfully obtained Azure CLI token via direct command execution");
      } else {
        throw new Error("Direct Azure CLI command returned empty or invalid token");
      }
    } catch (directError) {
      console.error(`❌ Direct Azure CLI command failed: ${directError instanceof Error ? directError.message : String(directError)}`);
      
      // Fallback to auth client method
      const authToken = await getAuthToken();
      if (authToken) {
        tokenToUse = authToken;
        console.error("✅ Successfully obtained Azure CLI token via auth client fallback");
      } else {
        return {
          status: 'error',
          error: `Failed to obtain Azure CLI token via both direct command and auth client. 
          
Troubleshooting steps:
1. Ensure Azure CLI is installed and in PATH
2. Run 'az login' in your terminal
3. Verify token with: az account get-access-token --resource "https://analysis.windows.net/powerbi/api"
4. Restart VS Code to refresh the MCP server process
5. Alternative: Use bearerToken with actual token value instead of "azure_cli"`
        };
      }
    }
  }

  // If no bearer token provided, check environment variables
  if (!tokenToUse || tokenToUse === "test-token" || tokenToUse === "simulation") {
    // First try FABRIC_TOKEN environment variable
    const envToken = process.env.FABRIC_TOKEN;
    if (envToken) {
      tokenToUse = envToken;
    } else {
      // If no FABRIC_TOKEN, try authentication method
      const authToken = await getAuthToken();
      if (authToken) {
        tokenToUse = authToken;
      }
    }
  }

  // Use default workspace if none provided and configured
  const workspaceToUse = workspaceId || authConfig.defaultWorkspaceId || workspaceId;

  if (tokenToUse && tokenToUse !== "test-token" && tokenToUse !== "simulation") {
    // Validate token before using it
    const validation = validateBearerToken(tokenToUse);
    if (!validation.isValid) {
      return {
        status: 'error',
        error: `Invalid bearer token: ${validation.error}. Please generate a new token from https://app.powerbi.com/embedsetup`
      };
    }

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
    // Authentication failed or no token available - provide helpful guidance
    if (authConfig.method !== AuthMethod.BEARER_TOKEN && authConfig.clientId) {
      return {
        status: 'error',
        error: `Authentication failed. For Claude Desktop usage:
1. Use bearer token authentication: Set FABRIC_AUTH_METHOD=bearer_token
2. Provide token directly in tool calls via bearerToken parameter
3. Or get a token from: https://app.powerbi.com/embedsetup and set FABRIC_TOKEN env var
4. Alternative: Use simulation mode by setting bearerToken to "simulation"
5. For Azure CLI: Use bearerToken "azure_cli" to automatically use Azure CLI authentication`
      };
    }
    
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

    const itemsList = items.map((item: FabricItem, index: number) => 
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
    const updates: Record<string, unknown> = {};
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
  "Create a new notebook in Microsoft Fabric workspace using the official API",
  {
    bearerToken: z.string().min(1).describe("Microsoft Fabric bearer token"),
    workspaceId: z.string().min(1).describe("Microsoft Fabric workspace ID"),
    displayName: z.string().min(1).max(256).describe("Display name for the notebook"),
    description: z.string().max(1024).optional().describe("Optional description for the notebook")
  },
  async ({ bearerToken, workspaceId, displayName, description }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-notebook",
      async (_client) => {
        // Use the direct Fabric API for creating notebooks
        const response = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/notebooks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            displayName,
            description: description || `Notebook created on ${new Date().toISOString()}`
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create notebook: ${response.status} ${response.statusText}`);
        }

        return { status: 'success' as const, data: await response.json() };
      },
      { displayName, description, itemType: "Notebook" }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully created notebook: "${displayName}"\nID: ${result.data?.id}\nType: ${result.data?.type}\nWorkspace: ${result.data?.workspaceId}\nDescription: ${result.data?.description || "No description"}`
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
    const sparkItems = items.filter((item: FabricItem) => 
      item.type === "Notebook" || item.type === "Lakehouse" || item.displayName.toLowerCase().includes("spark")
    );

    if (sparkItems.length === 0) {
      return {
        content: [{ type: "text", text: `No Spark-related items found in workspace ${workspaceId}. This includes Notebooks and Lakehouses that can run Spark jobs.` }]
      };
    }

    const itemsList = sparkItems.slice(0, 10).map((item: FabricItem, index: number) => 
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

server.tool(
  "get-notebook-spark-applications",
  "Get all Spark applications/sessions for a specific notebook",
  SparkNotebookMonitoringSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook-spark-applications",
      (client) => client.getNotebookSparkApplications?.(notebookId, continuationToken) || 
                  client.simulateSparkApplications("notebook", notebookId),
      { notebookId, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook Spark applications: ${result.error}` }]
      };
    }

    const data = result.data || { value: [], continuationToken: null };
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
      (client) => client.getSparkJobDefinitionApplications?.(sparkJobDefinitionId, continuationToken) || 
                  client.simulateSparkApplications("job-definition", sparkJobDefinitionId),
      { sparkJobDefinitionId, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark job definition applications: ${result.error}` }]
      };
    }

    const data = result.data || { value: [], continuationToken: null };
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
      (client) => client.getLakehouseSparkApplications?.(lakehouseId, continuationToken) || 
                  client.simulateSparkApplications("lakehouse", lakehouseId),
      { lakehouseId, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting lakehouse Spark applications: ${result.error}` }]
      };
    }

    const data = result.data || { value: [], continuationToken: null };
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
      (client) => client.getSparkApplicationDetails?.(livyId) || 
                  client.simulateSparkApplicationDetails(livyId),
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
      (client) => client.cancelSparkApplication?.(livyId) || 
                  client.simulateCancelSparkApplication(livyId),
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
  "get-notebook-spark-application-details",
  "Get detailed information about a specific Spark application from a notebook session",
  NotebookSparkApplicationSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, livyId, appId, attemptId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook-spark-application-details",
      (client) => client.getNotebookSparkApplicationDetails?.(notebookId, livyId, appId, attemptId),
      { notebookId, livyId, appId, attemptId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook Spark application details: ${result.error}` }]
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `Notebook ${notebookId} Spark Application ${appId} Details:\n\n${JSON.stringify(result.data, null, 2)}` 
      }]
    };
  }
);

server.tool(
  "get-notebook-spark-application-jobs",
  "Get jobs for a specific Spark application from a notebook session",
  NotebookSparkApplicationSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, livyId, appId, jobId, attemptId }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook-spark-application-jobs",
      (client) => client.getNotebookSparkApplicationJobs?.(notebookId, livyId, appId, jobId, attemptId),
      { notebookId, livyId, appId, jobId, attemptId }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook Spark application jobs: ${result.error}` }]
      };
    }

    const jobText = jobId ? `Job ${jobId}` : "Jobs";
    return {
      content: [{ 
        type: "text", 
        text: `Notebook ${notebookId} Spark Application ${appId} ${jobText}:\n\n${JSON.stringify(result.data, null, 2)}` 
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
      (client) => client.getSparkMonitoringDashboard?.(includeCompleted, maxResults) || 
                  client.simulateSparkDashboard(includeCompleted, maxResults),
      { includeCompleted, maxResults }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting Spark monitoring dashboard: ${result.error}` }]
      };
    }

    const dashboard = result.data;
// Interface for dashboard applications
interface DashboardApp {
  itemName?: string;
  displayName: string;
  itemType?: string;
  type: string;
  state?: string;
  submittedDateTime?: string;
  totalDuration?: {
    value: number;
    timeUnit: string;
  };
}

    const dashboardText = `
🖥️ Spark Monitoring Dashboard - Workspace ${workspaceId}
${'='.repeat(60)}

📊 Summary:
  • Total Applications: ${dashboard.summary.total}
  • Running: ${dashboard.summary.running}
  • Completed: ${dashboard.summary.completed}
  • Failed/Cancelled: ${dashboard.summary.failed}
  • Pending: ${dashboard.summary.pending}

📋 By Item Type:
${Object.entries(dashboard.byItemType).map(([type, count]) => `  • ${type}: ${count}`).join('\n')}

📈 By State:
${Object.entries(dashboard.byState).map(([state, count]) => `  • ${state}: ${count}`).join('\n')}

🕒 Recent Activity (Last 10):
${dashboard.recentActivity.map((app: DashboardApp, i: number) => `
  ${i + 1}. ${app.itemName || app.displayName} (${app.itemType || app.type})
     State: ${app.state || 'Unknown'}
     Submitted: ${app.submittedDateTime || 'N/A'}
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

// ==================== LLM-POWERED ANALYSIS HELPERS ====================

interface SessionInfo {
  id: number;
  state: string;
  kind: string;
  appInfo?: Record<string, unknown>;
  log?: string[];
}

interface StatementData {
  id: number;
  state: string;
  code: string;
  kind?: string; // Optional since LivyStatementResult doesn't always have this
  started?: string;
  completed?: string;
  output?: {
    data?: Record<string, unknown>;
  };
}

interface PerformanceMetrics {
  executionTime: number | null;
  status: string;
  kind: string;
  hasOutput: boolean;
  outputType: string | null;
  outputMetrics?: {
    hasTextResult: boolean;
    hasJsonResult: boolean;
    hasErrorResult: boolean;
    outputSize: number;
  };
}

interface _StatementAnalysis {
  statementInfo: {
    id: number;
    state: string;
    code: string;
    kind: string;
    started?: string;
    completed?: string;
    output?: { data?: Record<string, unknown> };
  };
  performanceMetrics: PerformanceMetrics;
  analysisType: string;
  recommendations?: { type: string; timestamp: string; recommendations: string[] };
}

interface LogAnalysis {
  summary: {
    totalLogLines: number;
    errorCount: number;
    warningCount: number;
    sessionState: string;
    sessionKind: string;
  };
  errors: string[];
  warnings: string[];
  performanceIndicators: string[];
  performanceAnalysis?: Record<string, string[]>;
  errorAnalysis?: Record<string, unknown>;
  recommendations?: string[];
}

/**
 * Analyze session logs using LLM-powered insights
 */
function analyzeSessionLogsWithLLM(sessionInfo: SessionInfo, analysisType: string): LogAnalysis {
  const logs = sessionInfo.log || [];
  
  // Extract key metrics from logs
  const errorPatterns = logs.filter(log => log.toLowerCase().includes('error') || log.toLowerCase().includes('exception'));
  const warningPatterns = logs.filter(log => log.toLowerCase().includes('warn') || log.toLowerCase().includes('warning'));
  const performanceIndicators = logs.filter(log => 
    log.includes('duration') || log.includes('time') || log.includes('memory') || log.includes('cpu')
  );

  const analysis: LogAnalysis = {
    summary: {
      totalLogLines: logs.length,
      errorCount: errorPatterns.length,
      warningCount: warningPatterns.length,
      sessionState: sessionInfo.state,
      sessionKind: sessionInfo.kind
    },
    errors: errorPatterns.slice(0, 10), // Top 10 errors
    warnings: warningPatterns.slice(0, 5), // Top 5 warnings
    performanceIndicators: performanceIndicators.slice(0, 5)
  };

  // Add specific analysis based on type
  switch (analysisType) {
    case 'performance':
      analysis.performanceAnalysis = analyzePerformanceFromLogs(logs);
      break;
    case 'errors':
      analysis.errorAnalysis = analyzeErrorsFromLogs(errorPatterns);
      break;
    case 'recommendations':
      analysis.recommendations = generateSessionRecommendations(sessionInfo, logs);
      break;
    case 'detailed':
    default:
      analysis.performanceAnalysis = analyzePerformanceFromLogs(logs);
      analysis.errorAnalysis = analyzeErrorsFromLogs(errorPatterns);
      analysis.recommendations = generateSessionRecommendations(sessionInfo, logs);
      break;
  }

  return analysis;
}

function extractPerformanceMetrics(statementData: StatementData): PerformanceMetrics {
  const metrics: PerformanceMetrics = {
    executionTime: null,
    status: statementData.state,
    kind: statementData.kind || 'unknown', // Provide default if kind is missing
    hasOutput: !!statementData.output,
    outputType: statementData.output?.data ? Object.keys(statementData.output.data)[0] : null
  };

  // Calculate execution time if start/completion times are available
  if (statementData.started && statementData.completed) {
    const startTime = new Date(statementData.started).getTime();
    const endTime = new Date(statementData.completed).getTime();
    metrics.executionTime = endTime - startTime; // milliseconds
  }

  // Extract output metrics if available
  if (statementData.output?.data) {
    const outputData = statementData.output.data;
    metrics.outputMetrics = {
      hasTextResult: !!outputData['text/plain'],
      hasJsonResult: !!outputData['application/json'],
      hasErrorResult: !!outputData['application/vnd.livy.statement-error+json'],
      outputSize: JSON.stringify(outputData).length
    };
  }

  return metrics;
}

/**
 * Generate optimization recommendations based on statement analysis
 */
function generateOptimizationRecommendations(statementData: StatementData, performanceMetrics: PerformanceMetrics, analysisType: string): { type: string; timestamp: string; recommendations: string[] } {
  const recommendations = {
    type: analysisType,
    timestamp: new Date().toISOString(),
    recommendations: [] as string[]
  };

  // Performance-based recommendations
  if (performanceMetrics.executionTime) {
    if (performanceMetrics.executionTime > 60000) { // > 1 minute
      recommendations.recommendations.push("⚡ Consider optimizing query - execution time exceeded 1 minute");
      recommendations.recommendations.push("💡 Try adding appropriate filters or LIMIT clauses to reduce data processing");
    }
    
    if (performanceMetrics.executionTime > 300000) { // > 5 minutes
      recommendations.recommendations.push("🚨 Long-running query detected - consider partitioning or indexing strategies");
    }
  }

  // Code analysis recommendations
  const code = statementData.code?.toLowerCase() || '';
  if (code.includes('select *') && !code.includes('limit')) {
    recommendations.recommendations.push("⚠️ Avoid SELECT * without LIMIT - specify columns and row limits for better performance");
  }

  if (code.includes('cross join') || code.includes('cartesian')) {
    recommendations.recommendations.push("🔥 Cartesian joins detected - ensure proper join conditions to avoid performance issues");
  }

  // Error-based recommendations
  if (statementData.output?.data?.['application/vnd.livy.statement-error+json']) {
    const errorData = statementData.output.data['application/vnd.livy.statement-error+json'] as { evalue?: string };
    if (errorData.evalue?.includes('memory') || errorData.evalue?.includes('OutOfMemory')) {
      recommendations.recommendations.push("💾 Memory error detected - consider increasing executor memory or optimizing data processing");
    }
    
    if (errorData.evalue?.includes('timeout') || errorData.evalue?.includes('Timeout')) {
      recommendations.recommendations.push("⏱️ Timeout error - consider breaking down the operation or increasing timeout limits");
    }
  }

  // State-based recommendations
  if (statementData.state === 'error') {
    recommendations.recommendations.push("🔍 Statement failed - review error details and validate syntax/data availability");
  }

  if (recommendations.recommendations.length === 0) {
    recommendations.recommendations.push("✅ No immediate optimization opportunities detected - statement executed successfully");
  }

  return recommendations;
}

/**
 * Filter sessions by time range
 */
function filterSessionsByTimeRange(sessions: SessionInfo[], timeRange: string): SessionInfo[] {
  const now = new Date();
  let cutoffTime: Date;

  switch (timeRange) {
    case '1h':
      cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
  }

  return sessions.filter(session => {
    if (session.appInfo?.startTime) {
      return new Date(session.appInfo.startTime as string) >= cutoffTime;
    }
    return true; // Include sessions without start time
  });
}

/**
 * Analyze individual session history
 */
function analyzeSessionHistory(session: SessionInfo, analysisType: string): Record<string, unknown> {
  const analysis = {
    sessionId: session.id,
    sessionKind: session.kind,
    state: session.state,
    analysisType,
    createdAt: session.appInfo?.startTime,
    metrics: {
      duration: null as number | null,
      applicationId: typeof session.appInfo?.sparkUiUrl === 'string' ? session.appInfo.sparkUiUrl.split('/').pop() : undefined,
      driverMemory: session.appInfo?.driverMemory,
      executorMemory: session.appInfo?.executorMemory
    },
    insights: [] as string[]
  };

  // Calculate session duration
  if (session.appInfo?.startTime && session.appInfo?.endTime) {
    const start = new Date(session.appInfo.startTime as string).getTime();
    const end = new Date(session.appInfo.endTime as string).getTime();
    analysis.metrics.duration = end - start;
  }

  // Generate insights based on analysis type
  switch (analysisType) {
    case 'performance_trends':
      if (analysis.metrics.duration && analysis.metrics.duration > 600000) { // > 10 minutes
        analysis.insights.push("⚠️ Long-running session detected - monitor for potential bottlenecks");
      }
      break;
    case 'error_patterns':
      if (session.state === 'error' || session.state === 'dead') {
        analysis.insights.push("🚨 Session failed - investigate error patterns");
      }
      break;
    case 'resource_usage':
      analysis.insights.push(`💾 Memory configuration: Driver=${session.appInfo?.driverMemory || 'unknown'}, Executor=${session.appInfo?.executorMemory || 'unknown'}`);
      break;
  }

  return analysis;
}

/**
 * Analyze multiple sessions for historical trends
 */
function analyzeMultipleSessionsHistory(sessions: SessionInfo[], analysisType: string, timeRange: string): Record<string, unknown> {
  const analysis = {
    timeRange,
    analysisType,
    totalSessions: sessions.length,
    sessionStates: {} as Record<string, number>,
    insights: [] as string[],
    recommendations: [] as string[]
  };

  // Count session states
  sessions.forEach(session => {
    const state = session.state || 'unknown';
    analysis.sessionStates[state] = (analysis.sessionStates[state] || 0) + 1;
  });

  // Generate insights
  const errorSessions = analysis.sessionStates['error'] || 0;
  const deadSessions = analysis.sessionStates['dead'] || 0;
  const successfulSessions = analysis.sessionStates['idle'] || analysis.sessionStates['running'] || 0;

  if (errorSessions > 0) {
    analysis.insights.push(`🚨 ${errorSessions} sessions failed in the last ${timeRange}`);
  }

  if (deadSessions > 0) {
    analysis.insights.push(`💀 ${deadSessions} sessions died in the last ${timeRange}`);
  }

  if (successfulSessions > 0) {
    analysis.insights.push(`✅ ${successfulSessions} sessions completed successfully`);
  }

  // Generate recommendations
  const errorRate = (errorSessions + deadSessions) / sessions.length;
  if (errorRate > 0.2) { // > 20% error rate
    analysis.recommendations.push("🔧 High error rate detected - review session configurations and resource allocation");
  }

  if (sessions.length === 0) {
    analysis.insights.push(`📊 No sessions found in the last ${timeRange}`);
  }

  return analysis;
}

/**
 * Analyze performance patterns from logs
 */
function analyzePerformanceFromLogs(logs: string[]): Record<string, string[]> {
  const performanceLog = {
    memoryIndicators: [] as string[],
    timeIndicators: [] as string[],
    resourceWarnings: [] as string[]
  };

  logs.forEach(log => {
    const lowerLog = log.toLowerCase();
    if (lowerLog.includes('memory') || lowerLog.includes('heap') || lowerLog.includes('gc')) {
      performanceLog.memoryIndicators.push(log);
    }
    if (lowerLog.includes('duration') || lowerLog.includes('elapsed') || lowerLog.includes('time')) {
      performanceLog.timeIndicators.push(log);
    }
    if (lowerLog.includes('slow') || lowerLog.includes('timeout') || lowerLog.includes('retry')) {
      performanceLog.resourceWarnings.push(log);
    }
  });

  return performanceLog;
}

/**
 * Analyze error patterns from logs
 */
function analyzeErrorsFromLogs(errorLogs: string[]): Record<string, unknown> {
  const errorAnalysis = {
    errorTypes: {} as Record<string, number>,
    criticalErrors: [] as string[],
    commonPatterns: [] as string[]
  };

  errorLogs.forEach(error => {
    // Categorize error types
    const lowerError = error.toLowerCase();
    if (lowerError.includes('memory') || lowerError.includes('outofmemory')) {
      errorAnalysis.errorTypes['memory'] = (errorAnalysis.errorTypes['memory'] || 0) + 1;
    } else if (lowerError.includes('timeout')) {
      errorAnalysis.errorTypes['timeout'] = (errorAnalysis.errorTypes['timeout'] || 0) + 1;
    } else if (lowerError.includes('connection')) {
      errorAnalysis.errorTypes['connection'] = (errorAnalysis.errorTypes['connection'] || 0) + 1;
    } else if (lowerError.includes('syntax') || lowerError.includes('parse')) {
      errorAnalysis.errorTypes['syntax'] = (errorAnalysis.errorTypes['syntax'] || 0) + 1;
    } else {
      errorAnalysis.errorTypes['other'] = (errorAnalysis.errorTypes['other'] || 0) + 1;
    }

    // Mark critical errors
    if (lowerError.includes('fatal') || lowerError.includes('critical')) {
      errorAnalysis.criticalErrors.push(error);
    }
  });

  return errorAnalysis;
}

/**
 * Generate session-level recommendations
 */
function generateSessionRecommendations(sessionInfo: SessionInfo, logs: string[]): string[] {
  const recommendations: string[] = [];

  if (sessionInfo.state === 'error') {
    recommendations.push("🔍 Session failed - review error logs and restart with corrected configuration");
  }

  if (sessionInfo.state === 'dead') {
    recommendations.push("💀 Session died unexpectedly - check resource allocation and network connectivity");
  }

  const memoryErrors = logs.filter(log => log.toLowerCase().includes('outofmemory')).length;
  if (memoryErrors > 0) {
    recommendations.push("💾 Memory issues detected - consider increasing driver/executor memory settings");
  }

  const timeoutErrors = logs.filter(log => log.toLowerCase().includes('timeout')).length;
  if (timeoutErrors > 0) {
    recommendations.push("⏱️ Timeout issues detected - review query complexity and increase timeout settings");
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ Session appears healthy - no immediate issues detected");
  }

  return recommendations;
}

// ==================== ENHANCED LIVY STATEMENT TOOLS ====================

// Enhance the existing get-livy-statement tool with log analysis
server.tool(
  "get-livy-statement-enhanced",
  "Get Livy statement status with enhanced performance analysis and recommendations",
  LivyStatementOperationSchema.extend({
    includeAnalysis: z.boolean().default(true).describe("Include performance analysis and recommendations"),
    analysisType: z.enum(["basic", "performance", "optimization"]).default("performance").describe("Type of analysis to perform")
  }).shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId, statementId, includeAnalysis, analysisType }) => {
    try {
      const result = await executeApiCall(
        bearerToken,
        workspaceId,
        "get-livy-statement-enhanced",
        (client) => client.getLivyStatement(lakehouseId, sessionId, statementId),
        { lakehouseId, sessionId, statementId, includeAnalysis, analysisType }
      );

      if (result.status === 'error') {
        return {
          content: [{ type: "text", text: `Error getting enhanced statement details: ${result.error}` }]
        };
      }

      // Add analysis if requested and data is available
      if (includeAnalysis && result.data) {
        const statementData = result.data;
        const performanceMetrics = extractPerformanceMetrics(statementData);
        const recommendations = generateOptimizationRecommendations(statementData, performanceMetrics, analysisType);
        
        const enhancedData = {
          statementData,
          performanceMetrics,
          recommendations,
          analysisTimestamp: new Date().toISOString()
        };

        return {
          content: [{ type: "text", text: JSON.stringify(enhancedData, null, 2) }]
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error in enhanced statement analysis: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.tool(
  "analyze-livy-session-logs",
  "Analyze Livy session logs with LLM-powered performance insights and recommendations",
  LivySessionLogAnalysisSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId, analysisType, useLLM }) => {
    try {
      const result = await executeApiCall(
        bearerToken,
        workspaceId,
        "analyze-livy-session-logs",
        (client) => client.getLivySession(lakehouseId, sessionId),
        { lakehouseId, sessionId, analysisType }
      );

      if (result.status === 'error') {
        return {
          content: [{ type: "text", text: `❌ Error analyzing session logs: ${result.error}` }]
        };
      }

      if (result.data) {
        const sessionData = result.data;
        const sessionInfo = {
          id: sessionData.id,
          state: sessionData.state,
          kind: sessionData.kind,
          appInfo: sessionData.appInfo,
          log: sessionData.log || []
        };

        const analysisResult = {
          sessionInfo,
          analysisType,
          timestamp: new Date().toISOString()
        } as Record<string, unknown>;

        // If LLM analysis is requested, provide intelligent insights
        if (useLLM && sessionInfo.log.length > 0) {
          const logAnalysis = analyzeSessionLogsWithLLM(sessionInfo, analysisType);
          analysisResult.logAnalysis = logAnalysis;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(analysisResult, null, 2) }]
        };
      }

      return {
        content: [{ type: "text", text: "❌ No session data available for analysis" }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error analyzing Livy session logs: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.tool(
  "analyze-livy-statement-performance",
  "Analyze Livy statement execution with detailed performance metrics and LLM-powered optimization recommendations", 
  LivyStatementLogAnalysisSchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId, statementId, analysisType, includeRecommendations }) => {
    try {
      const result = await executeApiCall(
        bearerToken,
        workspaceId,
        "analyze-livy-statement-performance",
        (client) => client.getLivyStatement(lakehouseId, sessionId, statementId),
        { lakehouseId, sessionId, statementId, analysisType }
      );

      if (result.status === 'error') {
        return {
          content: [{ type: "text", text: `❌ Error analyzing statement performance: ${result.error}` }]
        };
      }

      if (result.data) {
        const statementData = result.data;
        const performanceMetrics = extractPerformanceMetrics(statementData);
        
        const analysis = {
          statementInfo: {
            id: statementData.id,
            state: statementData.state,
            code: statementData.code,
            kind: 'unknown', // LivyStatementResult doesn't have kind field
            started: statementData.started,
            completed: statementData.completed,
            output: statementData.output
          },
          performanceMetrics,
          analysisType
        } as Record<string, unknown>;

        // Add LLM-powered recommendations if requested
        if (includeRecommendations) {
          const recommendations = generateOptimizationRecommendations(statementData, performanceMetrics, analysisType);
          analysis.recommendations = recommendations;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }]
        };
      }

      return {
        content: [{ type: "text", text: "❌ No statement data available for analysis" }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error analyzing statement performance: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.tool(
  "analyze-livy-execution-history",
  "Analyze historical Livy execution patterns with trend analysis and performance insights",
  LivyExecutionHistorySchema.shape,
  async ({ bearerToken, workspaceId, lakehouseId, sessionId, timeRange, analysisType }) => {
    try {
      const result = await executeApiCall(
        bearerToken,
        workspaceId,
        "analyze-livy-execution-history",
        (client) => client.listLivySessions(lakehouseId),
        { lakehouseId, sessionId, timeRange, analysisType }
      );

      if (result.status === 'error') {
        return {
          content: [{ type: "text", text: `❌ Error analyzing execution history: ${result.error}` }]
        };
      }

      if (result.data?.sessions) {
        const sessions = result.data.sessions;
        const filteredSessions = filterSessionsByTimeRange(sessions, timeRange);
        
        let analysisResult: Record<string, unknown>;

        if (sessionId) {
          // Focus on specific session if provided
          const targetSession = filteredSessions.find(s => s.id === sessionId);
          if (targetSession) {
            analysisResult = analyzeSessionHistory(targetSession, analysisType);
          } else {
            return {
              content: [{ type: "text", text: `❌ Session ${sessionId} not found in the specified time range` }]
            };
          }
        } else {
          // Analyze all sessions in time range
          analysisResult = analyzeMultipleSessionsHistory(filteredSessions, analysisType, timeRange);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(analysisResult, null, 2) }]
        };
      }

      return {
        content: [{ type: "text", text: "❌ No session history available for analysis" }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error analyzing execution history: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
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

    const notebooksList = notebooks.map((notebook: FabricItem, index: number) => 
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

// Interface for pipeline parts
interface PipelinePart {
  path: string;
  payloadType: string;
}

    const parts = definition.parts.map((part: PipelinePart, index: number) => 
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

// ==================== ADVANCED SPARK JOB DEFINITION TOOLS ====================

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

// ==================== LIVY SESSION TOOLS ====================

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

// Authentication Status Tool
server.tool(
  "check-fabric-auth-status",
  "Check current authentication status and configuration",
  z.object({}).shape,
  async () => {
    const _authStatus = getAuthenticationStatus();
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
);

// ==================== WORKSPACE MANAGEMENT TOOLS ====================

server.tool(
  "fabric_list_workspaces",
  "List all workspaces accessible to the user",
  ListWorkspacesSchema.shape,
  async ({ bearerToken, type, capacityId, name, state, continuationToken }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "list-workspaces", 
      (client) => client.listWorkspaces(type, capacityId, name, state, continuationToken) || 
                  client.simulateWorkspaces(type, capacityId, name, state),
      { type, capacityId, name, state, continuationToken }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error: ${result.error}` }]
      };
    }

    const workspaces = result.data?.workspaces || [];
    if (workspaces.length === 0) {
      return {
        content: [{ type: "text", text: "No workspaces found matching the specified criteria" }]
      };
    }

    const workspacesList = workspaces.map((workspace: { id: string; name: string; type: string; state: string; capacityId?: string }, index: number) => 
      `${index + 1}. ${workspace.name} (${workspace.type})\n   ID: ${workspace.id}\n   State: ${workspace.state}\n   Capacity ID: ${workspace.capacityId || "No capacity"}`
    ).join("\n\n");

    return {
      content: [{
        type: "text",
        text: `Workspaces (${workspaces.length} found):\n\n${workspacesList}${result.data?.continuationToken ? `\n\nMore results available (continuationToken: ${result.data.continuationToken})` : ""}`
      }]
    };
  }
);

server.tool(
  "fabric_find_workspace",
  "Find workspace by name and get its ID for use in other operations",
  FindWorkspaceSchema.shape,
  async ({ bearerToken, searchName }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "find-workspace", 
      (client) => client.listWorkspaces(undefined, undefined, searchName) || 
                  client.simulateWorkspaces(undefined, undefined, searchName),
      { searchName }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error: ${result.error}` }]
      };
    }

    const workspaces = result.data?.workspaces || [];
    const matchingWorkspaces = workspaces.filter((workspace: { name: string }) => 
      workspace.name.toLowerCase().includes(searchName.toLowerCase())
    );

    if (matchingWorkspaces.length === 0) {
      return {
        content: [{ 
          type: "text", 
          text: `No workspaces found matching "${searchName}"\n\nTip: Try using the fabric_list_workspaces tool to see all available workspaces.` 
        }]
      };
    }

    if (matchingWorkspaces.length === 1) {
      const workspace = matchingWorkspaces[0];
      return {
        content: [{
          type: "text",
          text: `✅ Found workspace: "${workspace.name}"\n\n📋 Details:\n• ID: ${workspace.id}\n• Type: ${workspace.type}\n• State: ${workspace.state}\n• Capacity ID: ${workspace.capacityId || "No capacity"}\n\n💡 You can now use this workspace ID (${workspace.id}) in other operations!`
        }]
      };
    }

    const workspacesList = matchingWorkspaces.map((workspace: { id: string; name: string; type: string; state: string; capacityId?: string }, index: number) => 
      `${index + 1}. "${workspace.name}"\n   ID: ${workspace.id}\n   Type: ${workspace.type}\n   State: ${workspace.state}\n   Capacity ID: ${workspace.capacityId || "No capacity"}`
    ).join("\n\n");

    return {
      content: [{
        type: "text",
        text: `Found ${matchingWorkspaces.length} workspaces matching "${searchName}":\n\n${workspacesList}\n\n💡 Copy the ID of the workspace you want to use for other operations.`
      }]
    };
  }
);

server.tool(
  "fabric_create_workspace",
  "Create a new workspace",
  {
    name: z.string().min(1).max(256).describe("Name of the workspace"),
    description: z.string().max(1024).optional().describe("Optional description of the workspace"),
    bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication")
  },
  async ({ name, description, bearerToken }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "create-workspace",
      (_client) => { throw new Error("Workspace management not yet implemented in fabric-client"); },
      { name, description }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Workspace creation simulated: ${name}\nDescription: ${description || 'None'}`
      }]
    };
  }
);

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
      // Enhanced health check with authentication status
      const authStatus = getAuthenticationStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        authentication: authStatus
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
  const enableHealthServer = process.env.ENABLE_HEALTH_SERVER === 'true'; // Default to false for MCP mode
  
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
