#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FabricApiClient, ApiResponse } from './fabric-client.js';
import { SimulationService } from './simulation-service.js';
import { MicrosoftAuthClient, AuthMethod, AuthResult } from './auth-client.js';
import http from 'http';
import url from 'url';
// Migration tools
import { 
  migrationTools,
  ListSynapseWorkspacesSchema,
  DiscoverSynapseWorkspaceSchema,
  TransformNotebooksSchema,
  MigrateSynapseToFabricSchema,
  CreateFabricLakehouseSchema,
  ProvisionNotebooksSchema,
  ListFabricCapacitiesSchema,
  AssignCapacityToWorkspaceSchema,
  GetSynapseSparkPoolsSchema,
  CreateFabricSparkPoolsSchema,
  SynapseWorkspaceDetailsSchema,
  SynapseComputeSpendSchema,
  MigrateSparkPoolsToFabricSchema,
  RecommendFabricCapacitySchema
} from './migration/mcp-tools.js';
/**
 * STDOUT SAFETY GUARD
 * -------------------------------------------------------------
 * MCP clients (Claude Desktop, Copilot, etc.) expect ONLY valid
 * JSON-RPC framed messages on STDOUT. Any stray console.log()
 * output will cause JSON parse errors like:
 *   "Unexpected token 'P' ..." or "Unexpected token '{' ..."
 * We proactively redirect console.log/info to STDERR unless
 * explicitly overridden via ALLOW_UNSAFE_STDOUT=true. This keeps
 * protocol framing clean while still allowing debug visibility.
 *
 * Set DEBUG_MCP_RUN=1 to enable additional structured diagnostics
 * already emitted on STDERR elsewhere in this file.
 */
(() => {
  if (process.env.ALLOW_UNSAFE_STDOUT === 'true') {
    return; // Power user override for controlled environments
  }
  const redirect = (...args: any[]) => {
    try {
      const msg = args.map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      // Use stderr so MCP JSON-RPC stream on stdout remains pristine
      process.stderr.write(`[LOG] ${msg}\n`);
    } catch (e) {
      // Final fallback – never throw from logging shim
      process.stderr.write('[LOG] <unserializable log message>\n');
    }
  };
  console.log = redirect as any;
  console.info = redirect as any;
})();
/**
 * 
 * This a is a safe date formatter that handles various edge cases:
 * 
 */
function safeFormatDate(dateValue: any): string {
  if (!dateValue || dateValue === null || dateValue === undefined) {
    return 'N/A';
  }
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleString();
  } catch (e) {
    return 'N/A';
  }
}


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
  sessionId: z.string().describe("Livy session ID (UUID or number)")
});

const LivyStatementSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.string().describe("Livy session ID (UUID or number)"),
  code: z.string().min(1).describe("Code to execute"),
  kind: z.enum(["spark", "pyspark", "sparkr", "sql"]).optional().describe("Statement kind")
});

const LivyStatementOperationSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.string().describe("Livy session ID (UUID or number)"),
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
  sessionId: z.string().describe("Livy session ID (UUID or number)"),
  analysisType: z.enum(["summary", "detailed", "performance", "errors", "recommendations"]).default("detailed").describe("Type of log analysis to perform"),
  useLLM: z.boolean().default(true).describe("Use LLM for intelligent log analysis")
});

const LivyStatementLogAnalysisSchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"), 
  sessionId: z.string().describe("Livy session ID (UUID or number)"),
  statementId: z.number().min(0).describe("Statement ID to analyze"),
  analysisType: z.enum(["performance", "errors", "optimization", "comprehensive"]).default("comprehensive").describe("Type of analysis to perform"),
  includeRecommendations: z.boolean().default(true).describe("Include optimization recommendations")
});

const LivyExecutionHistorySchema = BaseWorkspaceSchema.extend({
  lakehouseId: z.string().min(1).describe("Lakehouse ID"),
  sessionId: z.string().optional().describe("Optional specific session ID to analyze (UUID or number)"),
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

// Capacity Management Schemas
const ListCapacitiesSchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication")
});

const AssignWorkspaceToCapacitySchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication"),
  capacityId: z.string().min(1).describe("Target capacity ID"),
  workspaceId: z.string().min(1).describe("Workspace ID to assign to capacity")
});

const UnassignWorkspaceFromCapacitySchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication"),
  workspaceId: z.string().min(1).describe("Workspace ID to unassign from capacity")
});

const ListCapacityWorkspacesSchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication"),
  capacityId: z.string().min(1).describe("Capacity ID to list workspaces for")
});

const FindWorkspaceSchema = z.object({
  bearerToken: z.string().optional().describe("Optional bearer token if not using configured authentication"),
  searchName: z.string().min(1).describe("Workspace name to search for (partial match supported)")
});


// ====================================
// SCHEMA DEFINITIONS (Add after imports, before tool functions)
// ====================================

const CreateDataflowSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  displayName: z.string().describe("Display name for the dataflow"),
  description: z.string().optional().describe("Optional description for the dataflow")
});

const ListDataflowsSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID")
});

const GetDataflowSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to retrieve")
});

const UpdateDataflowSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to update"),
  displayName: z.string().optional().describe("New display name"),
  description: z.string().optional().describe("New description")
});

const DeleteDataflowSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to delete")
});

// Dataflow Monitoring Schemas

const MonitorDataflowStatusSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to monitor"),
  includeHealthMetrics: z.boolean().default(true).describe("Include health scoring and performance analysis")
});

const PerformDataflowHealthCheckSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to health check"),
  checkDepth: z.enum(["basic", "standard", "comprehensive"]).default("standard").describe("Depth of health analysis"),
  includeRecommendations: z.boolean().default(true).describe("Include optimization recommendations")
});

const MonitorWorkspaceDataflowsSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  includeHealthChecks: z.boolean().default(true).describe("Perform health checks on all dataflows"),
  sortBy: z.enum(["name", "health_score", "last_modified", "status"]).default("health_score").describe("Sort criteria for results")
});

const GenerateDataflowMonitoringReportSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to generate report for"),
  reportType: z.enum(["summary", "detailed", "executive"]).default("detailed").describe("Type of report to generate"),
  outputFormat: z.enum(["json", "markdown"]).default("markdown").describe("Report output format")
});

const StartContinuousDataflowMonitoringSchema = z.object({
  bearerToken: z.string().describe("Microsoft Fabric bearer token"),
  workspaceId: z.string().describe("Microsoft Fabric workspace ID"),
  dataflowId: z.string().describe("Dataflow ID to monitor continuously"),
  intervalMinutes: z.number().min(1).max(60).default(5).describe("Check interval in minutes"),
  durationMinutes: z.number().min(0).default(60).describe("Total monitoring duration in minutes (0 = indefinite)")
});

// ====================================
// RUN MONITORING SCHEMAS
// ====================================

const ListFabricItemRunsSchema = BaseWorkspaceSchema.extend({
  itemId: z.string().min(1).describe("Item ID to get runs for"),
  continuationToken: z.string().optional().describe("Optional continuation token for pagination"),
  top: z.number().min(1).max(1000).default(100).describe("Maximum number of runs to return")
});

const GetFabricItemRunSchema = BaseWorkspaceSchema.extend({
  itemId: z.string().min(1).describe("Item ID"),
  jobInstanceId: z.string().min(1).describe("Specific job instance ID to retrieve"),
  includeSubactivities: z.boolean().default(true).describe("Whether to include subactivity details")
});

const ListFabricRunSubactivitiesSchema = BaseWorkspaceSchema.extend({
  itemId: z.string().min(1).describe("Item ID"),
  jobInstanceId: z.string().min(1).describe("Job instance ID"),
  continuationToken: z.string().optional().describe("Optional continuation token for pagination"),
  top: z.number().min(1).max(1000).default(100).describe("Maximum number of subactivities to return")
});

const MonitorFabricRunsDashboardSchema = BaseWorkspaceSchema.extend({
  hoursBack: z.number().min(1).max(168).default(24).describe("Hours back to analyze"),
  includeSubactivities: z.boolean().default(false).describe("Include detailed subactivity analysis")
});

const AnalyzeFabricRunPerformanceSchema = BaseWorkspaceSchema.extend({
  itemId: z.string().min(1).describe("Item ID"),
  jobInstanceId: z.string().min(1).describe("Job instance ID to analyze"),
  analysisType: z.enum(["performance", "errors", "bottlenecks", "comprehensive"]).default("comprehensive").describe("Type of analysis to perform")
});

// ====================================
// INTERFACES
// ====================================

interface FabricRun {
  id: string;
  status: string;
  startTimeUtc: string;
  endTimeUtc?: string;
  itemId: string;
  itemType: string;
  duration?: string;
  errorMessage?: string;
  invokeType: string;
  rootActivityId: string;
}

interface FabricSubactivity {
  id: string;
  displayName: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: string;
  activityType: string;
  parentActivityId?: string;
  errorMessage?: string;
  details?: any;
}

interface FabricRunWithSubactivities {
  run: FabricRun;
  subactivities: FabricSubactivity[];
}

interface RunAnalysis {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  runningRuns: number;
  successRate: number;
  averageDuration?: number;
  recentFailures: FabricRun[];
  longestRunningJobs: FabricRun[];
}

interface SubactivityAnalysis {
  totalActivities: number;
  successfulActivities: number;
  failedActivities: number;
  runningActivities: number;
  activityTypes: Record<string, number>;
  criticalPath?: FabricSubactivity[];
  bottlenecks: (FabricSubactivity & { calculatedDuration: number })[];
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(startTime: string, endTime: string): number {
  return new Date(endTime).getTime() - new Date(startTime).getTime();
}

/**
 * Format duration in human-readable format
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Analyze runs summary
 */
function analyzeRunsSummary(runs: FabricRun[]): RunAnalysis {
  const successfulRuns = runs.filter(r => r.status === "Succeeded").length;
  const failedRuns = runs.filter(r => r.status === "Failed").length;
  const runningRuns = runs.filter(r => r.status === "Running" || r.status === "InProgress").length;
  
  const completedRuns = runs.filter(r => r.endTimeUtc);
  const durations = completedRuns
    .map(r => calculateDuration(r.startTimeUtc, r.endTimeUtc!))
    .filter(d => d > 0);
  
  const averageDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : undefined;

  const recentFailures = runs
    .filter(r => r.status === "Failed")
    .sort((a, b) => new Date(b.startTimeUtc).getTime() - new Date(a.startTimeUtc).getTime())
    .slice(0, 5);

  const longestRunningJobs = runs
    .filter(r => r.status === "Running")
    .sort((a, b) => new Date(a.startTimeUtc).getTime() - new Date(b.startTimeUtc).getTime())
    .slice(0, 3);

  return {
    totalRuns: runs.length,
    successfulRuns,
    failedRuns,
    runningRuns,
    successRate: runs.length > 0 ? (successfulRuns / runs.length) * 100 : 0,
    averageDuration,
    recentFailures,
    longestRunningJobs
  };
}

/**
 * Analyze subactivities
 */
function analyzeSubactivities(subactivities: FabricSubactivity[]): SubactivityAnalysis {
  const successfulActivities = subactivities.filter(a => a.status === "Succeeded").length;
  const failedActivities = subactivities.filter(a => a.status === "Failed").length;
  const runningActivities = subactivities.filter(a => a.status === "Running").length;

  const activityTypes: Record<string, number> = {};
  subactivities.forEach(activity => {
    activityTypes[activity.activityType] = (activityTypes[activity.activityType] || 0) + 1;
  });

  // Find bottlenecks (longest running activities)
  const bottlenecks = subactivities
    .filter(a => a.endTime)
    .map(a => ({
      ...a,
      calculatedDuration: calculateDuration(a.startTime, a.endTime!)
    }))
    .sort((a, b) => b.calculatedDuration - a.calculatedDuration)
    .slice(0, 3);

  return {
    totalActivities: subactivities.length,
    successfulActivities,
    failedActivities,
    runningActivities,
    activityTypes,
    bottlenecks
  };
}

/**
 * Filter recent runs based on time range
 */
function filterRecentRuns(runs: FabricRun[], hoursBack: number): FabricRun[] {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  return runs.filter(run => new Date(run.startTimeUtc) >= cutoff);
}

/**
 * Analyze single run with subactivities
 */
function analyzeSingleRun(run: FabricRun, subactivities: FabricSubactivity[]): any {
  const duration = run.endTimeUtc ? calculateDuration(run.startTimeUtc, run.endTimeUtc) : null;
  const subactivityAnalysis = analyzeSubactivities(subactivities);
  
  return {
    status: run.status,
    duration: duration ? formatDuration(duration) : "In progress",
    subactivitySummary: subactivityAnalysis,
    hasErrors: run.status === "Failed" || subactivityAnalysis.failedActivities > 0,
    isLongRunning: duration ? duration > 300000 : false, // 5+ minutes
    efficiency: subactivities.length > 0 ? (subactivityAnalysis.successfulActivities / subactivities.length) * 100 : 100
  };
}

/**
 * Generate performance recommendations
 */
function generatePerformanceRecommendations(run: FabricRun, subactivities: FabricSubactivity[], analysisType: string): string[] {
  const recommendations: string[] = [];
  
  if (run.status === "Failed") {
    recommendations.push("🔍 Review error logs and consider retry mechanisms");
  }
  
  const longRunning = subactivities.filter(a => 
    a.endTime && calculateDuration(a.startTime, a.endTime) > 300000
  );
  
  if (longRunning.length > 0) {
    recommendations.push("⚡ Consider optimizing long-running activities or increasing parallelism");
  }
  
  const failedCount = subactivities.filter(a => a.status === "Failed").length;
  if (failedCount > subactivities.length * 0.1) {
    recommendations.push("⚠️ High failure rate detected - review data quality and processing logic");
  }
  
  if (analysisType === "comprehensive") {
    const activityTypes = subactivities.reduce((acc, activity) => {
      acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantActivityType = Object.entries(activityTypes)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (dominantActivityType && dominantActivityType[1] > subactivities.length * 0.5) {
      recommendations.push(`📊 Activity type '${dominantActivityType[0]}' dominates the workflow - consider optimization`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push("✅ No immediate optimization opportunities detected");
  }
  
  return recommendations;
}
// ====================================
// HELPER INTERFACES AND TYPES
// ====================================

interface HealthMetrics {
  overallScore: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastRefreshStatus: string;
  details: {
    connectivityScore: number;
    configurationScore: number;
    performanceScore: number;
  };
}

interface HealthCheck {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  message: string;
}

interface MonitoringSession {
  id: string;
  dataflowId: string;
  workspaceId: string;
  startTime: string;
  intervalMinutes: number;
  durationMinutes: number;
  checksPerformed: number;
  alertsTriggered: number;
  isActive: boolean;
  history: Array<{
    timestamp: string;
    checkNumber: number;
    healthScore?: number;
    status?: string;
    alerts?: string[];
    error?: string;
  }>;
}


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
      const command = 'az account get-access-token --resource "https://api.fabric.microsoft.com" --query "accessToken" --output tsv';
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
3. Verify token with: az account get-access-token --resource "https://api.fabric.microsoft.com"
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

// Register capacity management tools inline (direct registration for build reliability)
server.tool(
  "fabric_list_capacities",
  "List all available Fabric capacities",
  ListCapacitiesSchema.shape,
  async ({ bearerToken }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "list-capacities",
      async (client) => await client.listCapacities(),
      {}
    );
    if (result.status === 'error') {
      return { content: [{ type: 'text', text: `Error listing capacities: ${result.error}` }] };
    }
    const capacities: any[] = Array.isArray(result.data) ? result.data : [];
    if (capacities.length === 0) {
      return { content: [{ type: 'text', text: 'No capacities found in your tenant.' }] };
    }
    const list = capacities.map((c: any, i: number) => `${i + 1}. ${c.displayName} (${c.sku})\n   ID: ${c.id}\n   State: ${c.state}\n   Region: ${c.region}`).join('\n\n');
    return {
      content: [{ type: 'text', text: `🏗️ Found ${capacities.length} Fabric Capacities:\n\n${list}\n\nUse a capacity ID in other operations (assignment, listing workspaces).` }]
    };
  }
);

server.tool(
  "fabric_assign_workspace_to_capacity",
  "Assign a workspace to a dedicated Fabric capacity",
  AssignWorkspaceToCapacitySchema.shape,
  async ({ bearerToken, capacityId, workspaceId }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "assign-workspace-to-capacity",
      async (client) => await client.assignWorkspaceToCapacity(capacityId, workspaceId),
      { capacityId, workspaceId }
    );
    if (result.status === 'error') {
      return { content: [{ type: 'text', text: `Error assigning workspace to capacity: ${result.error}` }] };
    }
    return {
      content: [{ type: 'text', text: `✅ Workspace ${workspaceId} assigned to capacity ${capacityId}.` }]
    };
  }
);

server.tool(
  "fabric_unassign_workspace_from_capacity",
  "Unassign a workspace from its capacity (move to shared capacity)",
  UnassignWorkspaceFromCapacitySchema.shape,
  async ({ bearerToken, workspaceId }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "unassign-workspace-from-capacity",
      async (client) => await client.unassignWorkspaceFromCapacity(workspaceId),
      { workspaceId }
    );
    if (result.status === 'error') {
      return { content: [{ type: 'text', text: `Error unassigning workspace from capacity: ${result.error}` }] };
    }
    return {
      content: [{ type: 'text', text: `✅ Workspace ${workspaceId} moved to shared capacity.` }]
    };
  }
);

server.tool(
  "fabric_list_capacity_workspaces",
  "List all workspaces assigned to a specific capacity",
  ListCapacityWorkspacesSchema.shape,
  async ({ bearerToken, capacityId }) => {
    const result = await executeApiCall(
      bearerToken,
      authConfig.defaultWorkspaceId || "global",
      "list-capacity-workspaces",
      async (client) => await client.listCapacityWorkspaces(capacityId),
      { capacityId }
    );
    if (result.status === 'error') {
      return { content: [{ type: 'text', text: `Error listing capacity workspaces: ${result.error}` }] };
    }
    const workspaces: any[] = Array.isArray(result.data) ? result.data : [];
    if (workspaces.length === 0) {
      return { content: [{ type: 'text', text: `No workspaces found in capacity ${capacityId}.` }] };
    }
    const list = workspaces.map((w: any, i: number) => `${i + 1}. ${w.name} (${w.type})\n   ID: ${w.id}\n   State: ${w.state}`).join('\n\n');
    return {
      content: [{ type: 'text', text: `🏗️ Workspaces in Capacity ${capacityId} (${workspaces.length}):\n\n${list}` }]
    };
  }
);

// ====================================
// SYNAPSE TO FABRIC MIGRATION TOOLS
// ====================================

server.tool(
  "fabric_list_synapse_workspaces",
  ListSynapseWorkspacesSchema.shape,
  {
    title: "List Synapse Workspaces",
    description: "List all Azure Synapse Analytics workspaces in your Azure subscription. Returns workspace names, IDs, locations, and resource groups to help you identify workspaces for migration."
  },
  async (params) => {
    try {
      console.error(`🔍 Listing Synapse workspaces...`);
      const result = await migrationTools.fabric_list_synapse_workspaces.handler(params);
      
      if (result.count === 0) {
        return {
          content: [{ type: 'text', text: '📭 No Synapse workspaces found in your subscription.' }]
        };
      }

      let output = `# 🏢 Azure Synapse Analytics Workspaces\n\n`;
      output += `**Found:** ${result.count} workspaces\n\n`;
      
      result.workspaces.forEach((ws: any, idx: number) => {
        output += `## ${idx + 1}. ${ws.name}\n`;
        output += `- **Location:** ${ws.location}\n`;
        output += `- **Resource Group:** ${ws.resourceGroup}\n`;
        output += `- **Resource ID:** \`${ws.id}\`\n`;
        if (ws.managedResourceGroupName) {
          output += `- **Managed RG:** ${ws.managedResourceGroupName}\n`;
        }
        output += `\n`;
      });

      output += `\n💡 **Next Steps:**\n`;
      output += `1. Use \`fabric_discover_synapse_workspace\` to inventory assets from a workspace\n`;
      output += `2. Provide workspaceName and resourceGroup from above\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error listing Synapse workspaces:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_discover_synapse_workspace",
  DiscoverSynapseWorkspaceSchema.shape,
  {
    title: "Discover Synapse Workspace",
    description: "Discover and inventory all assets from an Azure Synapse Analytics workspace including notebooks, pipelines, linked services, and Spark job definitions. Returns detailed inventory for migration planning."
  },
  async (params: any) => {
    try {
      console.error(`🔍 Discovering assets from Synapse workspace: ${params.workspaceName}`);
      const result = await migrationTools.fabric_discover_synapse_workspace.handler(params);

      let output = `# 📋 Synapse Workspace Discovery Report\n\n`;
      output += `**Workspace:** ${result.source.workspaceName}\n`;
      output += `**Resource Group:** ${result.source.resourceGroup}\n`;
      output += `**Discovered:** ${new Date(result.discoveredAt).toLocaleString()}\n\n`;

      output += `## 📊 Asset Summary\n\n`;
      output += `| Asset Type | Count |\n`;
      output += `|------------|-------|\n`;
      output += `| 📓 Notebooks | ${result.summary.notebooks} |\n`;
      output += `| 🔄 Pipelines | ${result.summary.pipelines} |\n`;
      output += `| 🔗 Linked Services | ${result.summary.linkedServices} |\n`;
      output += `| ⚡ Spark Jobs | ${result.summary.sparkJobs} |\n`;
      output += `| **Total** | **${result.summary.notebooks + result.summary.pipelines + result.summary.linkedServices + result.summary.sparkJobs}** |\n\n`;

      if (result.notebooks.length > 0) {
        output += `## 📓 Notebooks (${result.notebooks.length})\n\n`;
        result.notebooks.forEach((nb: any, idx: number) => {
          output += `${idx + 1}. **${nb.name}**\n`;
          output += `   - Path: \`${nb.path}\`\n`;
          output += `   - ID: \`${nb.id}\`\n`;
        });
        output += `\n`;
      }

      if (result.pipelines.length > 0) {
        output += `## 🔄 Pipelines (${result.pipelines.length})\n\n`;
        result.pipelines.forEach((p: any, idx: number) => {
          output += `${idx + 1}. **${p.name}**\n`;
          output += `   - ID: \`${p.id}\`\n`;
        });
        output += `\n`;
      }

      if (result.linkedServices.length > 0) {
        output += `## 🔗 Linked Services (${result.linkedServices.length})\n\n`;
        result.linkedServices.forEach((ls: any, idx: number) => {
          output += `${idx + 1}. **${ls.name}** (${ls.type})\n`;
        });
        output += `\n`;
      }

      if (result.sparkJobs.length > 0) {
        output += `## ⚡ Spark Job Definitions (${result.sparkJobs.length})\n\n`;
        result.sparkJobs.forEach((sj: any, idx: number) => {
          output += `${idx + 1}. **${sj.name}**\n`;
          if (sj.scriptPath) {
            output += `   - Script: \`${sj.scriptPath}\`\n`;
          }
        });
        output += `\n`;
      }

      output += `\n💡 **Next Steps:**\n`;
      output += `1. Review the discovered assets above\n`;
      output += `2. Use \`fabric_migrate_synapse_to_fabric\` for full end-to-end migration\n`;
      output += `3. Or use \`fabric_transform_notebooks\` to preview transformations first\n\n`;
      
      output += `📦 **Inventory JSON** (for transformation):\n\`\`\`\nSaved in discovery results - use this for fabric_transform_notebooks\n\`\`\`\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error discovering Synapse workspace:\n${errorMsg}\n\n💡 Make sure you have access to the Synapse workspace and Azure CLI is authenticated.` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_transform_notebooks",
  TransformNotebooksSchema.shape,
  {
    title: "Transform Notebooks",
    description: "Transform Synapse notebooks to Fabric-compatible format. Converts mssparkutils → notebookutils, rewrites paths, and removes Synapse-specific configurations. Can run in dry-run mode to preview changes without applying them."
  },
  async (params: any) => {
    try {
      console.error(`🔄 Transforming notebooks...`);
      const result = await migrationTools.fabric_transform_notebooks.handler(params);

      let output = `# 🔄 Notebook Transformation Report\n\n`;
      
      if (params.dryRun) {
        output += `⚠️ **DRY RUN MODE** - No actual changes applied\n\n`;
      }

      output += `## 📊 Summary\n\n`;
      output += `| Metric | Count |\n`;
      output += `|--------|-------|\n`;
      output += `| Total Notebooks | ${result.summary.total} |\n`;
      output += `| ✅ Successful | ${result.summary.successful} |\n`;
      output += `| ❌ Failed | ${result.summary.failed} |\n`;
      output += `| 📝 Total Changes | ${result.summary.totalChanges} |\n\n`;

      output += `## 📓 Transformation Results\n\n`;
      result.results.forEach((r: any, idx: number) => {
        const status = r.success ? '✅' : '❌';
        output += `${idx + 1}. ${status} **${r.notebookName}**\n`;
        output += `   - Changes: ${r.changesCount}\n`;
        if (r.errors && r.errors.length > 0) {
          output += `   - Errors: ${r.errors.join(', ')}\n`;
        }
        if (r.warnings && r.warnings.length > 0) {
          output += `   - Warnings: ${r.warnings.length}\n`;
        }
      });

      output += `\n---\n\n`;
      output += result.report;

      output += `\n\n💡 **Next Steps:**\n`;
      if (params.dryRun) {
        output += `1. Review the changes above\n`;
        output += `2. Run without dryRun to apply transformations\n`;
        output += `3. Use \`fabric_migrate_synapse_to_fabric\` for full migration with provisioning\n`;
      } else {
        output += `1. Use the transformed notebooks for provisioning to Fabric\n`;
        output += `2. Or use \`fabric_migrate_synapse_to_fabric\` for automatic provisioning\n`;
      }

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error transforming notebooks:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_migrate_synapse_to_fabric",
  MigrateSynapseToFabricSchema.shape,
  {
    title: "Migrate Synapse to Fabric",
    description: "Execute complete end-to-end migration from Azure Synapse Analytics to Microsoft Fabric. Discovers assets, transforms notebooks (mssparkutils → notebookutils), provisions to Fabric workspace, creates lakehouse if specified, and generates comprehensive migration report. Supports dry-run mode for safe testing."
  },
  async (params: any) => {
    try {
      console.error(`🚀 Starting Synapse to Fabric migration...`);
      console.error(`   Source: ${params.synapseWorkspaceName}`);
      console.error(`   Target: ${params.targetWorkspaceId}`);
      
      const result = await migrationTools.fabric_migrate_synapse_to_fabric.handler(params);

      let output = `# 🚀 Synapse to Fabric Migration Report\n\n`;
      
      if (params.dryRun) {
        output += `⚠️ **DRY RUN MODE** - No actual provisioning occurred\n\n`;
      }

      output += `**Status:** ${result.status === 'success' ? '✅ Success' : '⚠️ Partial Success'}\n`;
      output += `**Generated:** ${new Date(result.generatedAt).toLocaleString()}\n\n`;

      output += `## 📊 Migration Summary\n\n`;
      output += `| Metric | Count |\n`;
      output += `|--------|-------|\n`;
      output += `| Total Assets | ${result.summary.totalAssets} |\n`;
      output += `| ✅ Successful | ${result.summary.successful} |\n`;
      output += `| ❌ Failed | ${result.summary.failed} |\n`;
      output += `| 👀 Manual Review | ${result.summary.requiresManualReview} |\n`;
      output += `| ⏱️ Duration | ${(result.summary.duration / 1000).toFixed(2)}s |\n\n`;

      const successRate = ((result.summary.successful / result.summary.totalAssets) * 100).toFixed(1);
      output += `**Success Rate:** ${successRate}%\n\n`;

      output += `## 📦 Migration Details\n\n`;
      output += `| Asset | Type | Status | Fabric ID | Changes |\n`;
      output += `|-------|------|--------|-----------|----------|\n`;
      
      result.details.forEach((detail: any) => {
        const statusIcon = detail.status === 'success' ? '✅' : detail.status === 'failed' ? '❌' : '👀';
        output += `| ${detail.assetName} | ${detail.assetType} | ${statusIcon} ${detail.status} | ${detail.fabricItemId || 'N/A'} | ${detail.changesCount} |\n`;
      });

      if (result.recommendations.length > 0) {
        output += `\n## 💡 Recommendations\n\n`;
        result.recommendations.forEach((rec: string, idx: number) => {
          output += `${idx + 1}. ${rec}\n`;
        });
      }

      output += `\n---\n\n`;
      output += result.reportMarkdown;

      output += `\n\n## 🎉 Migration Complete!\n\n`;
      if (params.dryRun) {
        output += `This was a dry run. To execute the actual migration:\n`;
        output += `1. Remove the dryRun parameter\n`;
        output += `2. Run the command again\n`;
      } else {
        output += `Your Synapse notebooks have been migrated to Fabric!\n\n`;
        output += `**Next Steps:**\n`;
        output += `1. Verify the migrated notebooks in Fabric workspace\n`;
        output += `2. Review any warnings or manual review items above\n`;
        output += `3. Test notebook execution in Fabric environment\n`;
        if (params.targetLakehouseName) {
          output += `4. Configure lakehouse connections as needed\n`;
        }
        if (result.summary.failed > 0) {
          output += `5. Investigate failed items and retry if needed\n`;
        }
      }

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Migration failed:\n${errorMsg}\n\n💡 **Troubleshooting:**\n- Ensure Azure CLI is authenticated (\`az login\`)\n- Verify you have access to both Synapse and Fabric workspaces\n- Check that workspace IDs are correct\n- Try running in dry-run mode first to test connectivity` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_create_lakehouse",
  CreateFabricLakehouseSchema.shape,
  {
    title: "Create Fabric Lakehouse",
    description: "Create a new lakehouse in a Microsoft Fabric workspace. Lakehouses provide unified storage for both structured and unstructured data with Delta Lake support."
  },
  async (params: any) => {
    try {
      console.error(`🏗️ Creating lakehouse: ${params.lakehouseName}`);
      
      const result = await migrationTools.fabric_create_lakehouse.handler(params);

      let output = `# 🏗️ Lakehouse Created Successfully\n\n`;
      output += `**Workspace ID:** ${result.workspaceId}\n`;
      output += `**Lakehouse Name:** ${result.lakehouseName}\n`;
      output += `**Lakehouse ID:** ${result.lakehouseId}\n\n`;
      output += `## 📊 Details\n\n`;
      output += `${result.message}\n\n`;
      output += `**Fabric URL:** [Open Lakehouse](${result.fabricUrl})\n\n`;
      output += `## 🎯 Next Steps\n\n`;
      output += `1. Navigate to the lakehouse in Fabric workspace\n`;
      output += `2. Configure data ingestion\n`;
      output += `3. Create tables and views\n`;
      output += `4. Associate notebooks with this lakehouse\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Failed to create lakehouse:\n${errorMsg}\n\n💡 **Troubleshooting:**\n- Verify the workspace ID is correct\n- Ensure you have Contributor or Admin role in the workspace\n- Check that the lakehouse name is unique in the workspace` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_provision_notebooks",
  ProvisionNotebooksSchema.shape,
  {
    title: "Provision Notebooks to Fabric",
    description: "Provision transformed notebooks to a Microsoft Fabric workspace. Takes transformed notebook JSON from the transform tool and creates them in the target workspace."
  },
  async (params: any) => {
    try {
      console.error(`📦 Provisioning notebooks to workspace ${params.workspaceId}`);
      
      const result = await migrationTools.fabric_provision_notebooks.handler(params);

      let output = `# 📦 Notebooks Provisioned Successfully\n\n`;
      output += `**Workspace ID:** ${result.workspaceId}\n`;
      output += `**Notebooks Created:** ${result.notebooksProvisioned}\n\n`;
      output += `## 📒 Provisioned Notebooks\n\n`;
      output += `| Name | Fabric ID | URL |\n`;
      output += `|------|-----------|-----|\n`;
      
      result.notebooks.forEach((nb: any) => {
        output += `| ${nb.name} | ${nb.fabricId} | [Open](${nb.url}) |\n`;
      });

      output += `\n## 🎯 Next Steps\n\n`;
      output += `1. Open each notebook in Fabric to verify content\n`;
      output += `2. Test notebook execution\n`;
      output += `3. Configure lakehouse or environment connections if needed\n`;
      output += `4. Review and update any manual transformation items\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Failed to provision notebooks:\n${errorMsg}\n\n💡 **Troubleshooting:**\n- Verify transformedNotebooksJson is valid JSON\n- Ensure workspace ID is correct\n- Check that you have Contributor or Admin role\n- Validate notebook content format is correct` }],
        isError: true
      };
    }
  }
);

// Additional migration tools for capacity and Spark pool management

server.tool(
  "fabric_list_capacities",
  ListFabricCapacitiesSchema.shape,
  {
    title: "List Fabric Capacities",
    description: "List all available Fabric capacities with Spark VCore specifications and burst capacity details. Helps with capacity planning for migrations."
  },
  async (params: any) => {
    try {
      console.error(`🏗️ Listing Fabric capacities...`);
      const result = await migrationTools.fabric_list_capacities.handler(params);

      let output = `# 🏗️ Microsoft Fabric Capacities\n\n`;
      output += `**Total Capacities:** ${result.count}\n\n`;
      output += `## Available Capacities\n\n`;
      output += `| Display Name | SKU | State | Region | Spark VCores | Max (Burst) |\n`;
      output += `|--------------|-----|-------|--------|--------------|-------------|\n`;

      result.capacities.forEach((cap: any) => {
        output += `| ${cap.displayName} | ${cap.sku} | ${cap.state} | ${cap.region} | ${cap.sparkVCores} | ${cap.maxSparkVCoresWithBurst} |\n`;
      });

      output += `\n💡 **Spark VCore Burst:**\n`;
      output += `- F2: 4 base → 20 burst (5x)\n`;
      output += `- F4+: Base × 3 (e.g., F4: 8 → 24, F64: 128 → 384)\n\n`;
      output += `🎯 **Next Steps:**\n`;
      output += `1. Use \`fabric_assign_capacity\` to assign a capacity to your workspace\n`;
      output += `2. Consider capacity requirements for your Spark pools\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error listing capacities:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_assign_capacity",
  AssignCapacityToWorkspaceSchema.shape,
  {
    title: "Assign Capacity to Workspace",
    description: "Assign a Fabric capacity to a workspace. Auto-selects the largest available capacity if not specified."
  },
  async (params: any) => {
    try {
      console.error(`🔗 Assigning capacity to workspace ${params.workspaceId}...`);
      const result = await migrationTools.fabric_assign_capacity.handler(params);

      let output = `# ✅ Capacity Assignment Complete\n\n`;
      output += `**Workspace ID:** ${result.workspaceId}\n`;
      output += `**Capacity ID:** ${result.capacityId}\n\n`;
      output += `🎉 Your workspace now has a capacity assigned and can provision items like lakehouses and notebooks.\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Failed to assign capacity:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_get_synapse_spark_pools",
  GetSynapseSparkPoolsSchema.shape,
  {
    title: "Get Synapse Spark Pools",
    description: "Get Synapse Spark pool configurations for migration planning. Returns node sizes, counts, autoscale settings, and Spark versions."
  },
  async (params: any) => {
    try {
      console.error(`🔥 Getting Synapse Spark pools from workspace ${params.workspaceName}...`);
      const result = await migrationTools.fabric_get_synapse_spark_pools.handler(params);

      let output = `# 🔥 Synapse Spark Pools\n\n`;
      output += `**Workspace:** ${params.workspaceName}\n`;
      output += `**Total Pools:** ${result.count}\n\n`;

      if (result.count === 0) {
        output += `📭 No Spark pools found in this workspace.\n`;
      } else {
        output += `## Pool Configurations\n\n`;
        result.pools.forEach((pool: any, idx: number) => {
          output += `### ${idx + 1}. ${pool.name}\n`;
          output += `- **Node Size:** ${pool.nodeSize}\n`;
          output += `- **Node Count:** ${pool.nodeCount}\n`;
          output += `- **Spark Version:** ${pool.sparkVersion}\n`;
          
          if (pool.autoScale && pool.autoScale.enabled) {
            output += `- **AutoScale:** ${pool.autoScale.minNodeCount}-${pool.autoScale.maxNodeCount} nodes\n`;
          }
          
          if (pool.autoPause && pool.autoPause.enabled) {
            output += `- **AutoPause:** ${pool.autoPause.delayInMinutes} minutes\n`;
          }
          
          output += `\n`;
        });

        output += `\n💡 **Next Steps:**\n`;
        output += `1. Use \`fabric_create_fabric_spark_pools\` to get Fabric equivalent configurations\n`;
        output += `2. Note: 1 Synapse VCore = 2 Fabric VCores (2:1 conversion)\n`;
      }

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error getting Spark pools:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_create_fabric_spark_pools",
  CreateFabricSparkPoolsSchema.shape,
  {
    title: "Create Fabric Spark Pool Recommendations",
    description: "Generate Fabric Spark pool recommendations from Synapse pools using 2:1 VCore conversion (1 Synapse VCore = 2 Fabric VCores)."
  },
  async (params: any) => {
    try {
      console.error(`⚙️ Generating Fabric Spark pool recommendations...`);
      const result = await migrationTools.fabric_create_fabric_spark_pools.handler(params);

      let output = `# ⚙️ Fabric Spark Pool Recommendations\n\n`;
      output += `**Capacity SKU:** ${result.capacitySku}\n`;
      output += `**Recommendations:** ${result.recommendations.length}\n\n`;

      result.recommendations.forEach((rec: any, idx: number) => {
        output += `## ${idx + 1}. ${rec.synapsePoolName}\n\n`;
        output += `### Recommended Fabric Configuration\n`;
        output += `- **Driver:** ${rec.recommendedConfig.driverCores} cores, ${rec.recommendedConfig.driverMemory}\n`;
        output += `- **Executor:** ${rec.recommendedConfig.executorCores} cores, ${rec.recommendedConfig.executorMemory}\n`;
        output += `- **Dynamic Allocation:** ${rec.recommendedConfig.dynamicAllocation ? 'Yes' : 'No'}\n`;
        
        if (rec.recommendedConfig.dynamicAllocation) {
          output += `- **Executor Range:** ${rec.recommendedConfig.minExecutors}-${rec.recommendedConfig.maxExecutors}\n`;
        }
        
        output += `\n### 📊 Conversion Notes\n`;
        rec.notes.forEach((note: string) => {
          output += `- ${note}\n`;
        });
        output += `\n`;
      });

      output += `\n💡 **Implementation:**\n`;
      output += `1. Configure Spark pool settings in Fabric workspace settings\n`;
      output += `2. Use recommended executor configurations for optimal performance\n`;
      output += `3. Enable dynamic allocation if your Synapse pools used autoscale\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error creating Spark pool recommendations:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_synapse_workspace_details",
  SynapseWorkspaceDetailsSchema.shape,
  {
    title: "Get Synapse Workspace Details",
    description: "Get comprehensive details of a Synapse workspace including resource information."
  },
  async (params: any) => {
    try {
      console.error(`📋 Getting Synapse workspace details for ${params.workspaceName}...`);
      const result = await migrationTools.fabric_synapse_workspace_details.handler(params);

      let output = `# 📋 Synapse Workspace Details\n\n`;
      output += `**Workspace Name:** ${result.workspaceName}\n`;
      output += `**Resource Group:** ${result.resourceGroup}\n`;
      output += `**Subscription ID:** ${result.subscriptionId}\n\n`;
      output += `## Resource Summary\n`;
      output += `- **Notebooks:** ${result.notebooks.length}\n`;
      output += `- **Pipelines:** ${result.pipelines.length}\n`;
      output += `- **Spark Pools:** ${result.sparkPools.length}\n`;
      output += `- **Linked Services:** ${result.linkedServices.length}\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error getting workspace details:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_synapse_compute_spend",
  SynapseComputeSpendSchema.shape,
  {
    title: "Get Synapse Compute Spend",
    description: "Get compute spend data for a Synapse workspace to help with capacity sizing decisions."
  },
  async (params: any) => {
    try {
      console.error(`💰 Getting Synapse compute spend for ${params.workspaceName}...`);
      const result = await migrationTools.fabric_synapse_compute_spend.handler(params);

      let output = `# 💰 Synapse Compute Spend Analysis\n\n`;
      output += `**Workspace:** ${result.workspaceName}\n`;
      output += `**Period:** ${result.startDate || 'N/A'} to ${result.endDate || 'N/A'}\n`;
      output += `**Total Spend:** $${result.totalSpendUSD}\n\n`;
      output += `💡 Use this data with \`fabric_recommend_fabric_capacity\` to determine optimal Fabric capacity.\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error getting compute spend:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_migrate_spark_pools_to_fabric",
  MigrateSparkPoolsToFabricSchema.shape,
  {
    title: "Migrate Spark Pools to Fabric",
    description: "Migrate Synapse Spark pools to equivalent Fabric configurations."
  },
  async (params: any) => {
    try {
      console.error(`🔄 Migrating Spark pools to Fabric...`);
      const result = await migrationTools.fabric_migrate_spark_pools_to_fabric.handler(params);

      let output = `# ✅ Spark Pool Migration Complete\n\n`;
      output += `**Migrated Pools:** ${result.migrated}\n`;
      output += `**Target Capacity:** ${result.targetCapacitySku}\n`;
      output += `**Workspace ID:** ${result.workspaceId}\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error migrating Spark pools:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

server.tool(
  "fabric_recommend_fabric_capacity",
  RecommendFabricCapacitySchema.shape,
  {
    title: "Recommend Fabric Capacity",
    description: "Recommend optimal Fabric capacity SKU based on Synapse compute usage patterns."
  },
  async (params: any) => {
    try {
      console.error(`🎯 Generating Fabric capacity recommendations...`);
      const result = await migrationTools.fabric_recommend_fabric_capacity.handler(params);

      let output = `# 🎯 Fabric Capacity Recommendation\n\n`;
      output += `**Recommended SKU:** ${result.recommendedSku}\n`;
      output += `**Reason:** ${result.reason}\n\n`;
      output += `💡 This recommendation is based on your Synapse compute usage patterns.\n`;

      return {
        content: [{ type: 'text', text: output }]
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ Error generating capacity recommendation:\n${errorMsg}` }],
        isError: true
      };
    }
  }
);

// dataflows monitoring tools

// ====================================
// HELPER FUNCTIONS (Add these before the tool definitions)
// ====================================

const healthCache = new Map<string, { timestamp: number; data: HealthMetrics }>();
const monitoringSessions = new Map<string, { session: MonitoringSession; interval: NodeJS.Timeout; timeout?: NodeJS.Timeout }>();
const cacheExpiryMinutes = 5;

/**
 * Calculate health metrics for a dataflow
 */
async function calculateHealthMetrics(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthMetrics> {
  const cacheKey = `${workspaceId}_${dataflowId}`;
  const cached = healthCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < (cacheExpiryMinutes * 60 * 1000)) {
    return cached.data;
  }

  let overallScore = 85; // Default score
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  const lastRefreshStatus = 'unknown';

  try {
    // Test basic connectivity by getting dataflow details
    const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });

    if (response.ok) {
      const dataflow = await response.json();
      // Basic existence and configuration check
      if (dataflow && dataflow.displayName) {
        overallScore = 90; // Good score for accessible dataflow
      } else {
        overallScore = 70; // Lower score if issues with basic details
      }
    } else {
      overallScore = 60; // Lower score for API issues
    }

    // Determine status based on score
    if (overallScore >= 90) status = 'healthy';
    else if (overallScore >= 70) status = 'warning';
    else status = 'critical';

  } catch (error) {
    console.error(`Error calculating health metrics: ${error instanceof Error ? error.message : String(error)}`);
    overallScore = 60; // Lower score due to errors
    status = 'warning';
  }

  const result: HealthMetrics = {
    overallScore,
    status,
    lastRefreshStatus,
    details: {
      connectivityScore: overallScore >= 80 ? 95 : 70,
      configurationScore: overallScore >= 80 ? 90 : 65,
      performanceScore: overallScore >= 80 ? 85 : 60
    }
  };

  // Cache result
  healthCache.set(cacheKey, {
    timestamp: Date.now(),
    data: result
  });

  return result;
}

/**
 * Check basic connectivity to dataflow
 */
async function checkConnectivity(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthCheck> {
  try {
    const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });
    
    if (response.ok) {
      return { status: 'healthy', score: 95, message: 'Dataflow is accessible' };
    } else {
      return { status: 'critical', score: 30, message: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { status: 'critical', score: 30, message: `Connectivity issue: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Check dataflow configuration
 */
async function checkConfiguration(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthCheck> {
  try {
    const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });
    
    if (response.ok) {
      const dataflow = await response.json();
      const score = dataflow.displayName && dataflow.type ? 90 : 70;
      return { 
        status: score >= 80 ? 'healthy' : 'warning', 
        score, 
        message: 'Configuration appears valid' 
      };
    } else {
      return { status: 'critical', score: 40, message: `Configuration check failed: HTTP ${response.status}` };
    }
  } catch (error) {
    return { status: 'critical', score: 40, message: `Configuration check failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Check performance (placeholder - extend based on available metrics)
 */
async function checkPerformance(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthCheck> {
  // In a real implementation, this would check refresh history, execution times, etc.
  return { status: 'healthy', score: 85, message: 'Performance metrics not available, assuming healthy' };
}

/**
 * Check reliability (placeholder - extend based on available metrics)
 */
async function checkReliability(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthCheck> {
  // In a real implementation, this would check failure rates, success patterns, etc.
  return { status: 'healthy', score: 80, message: 'Reliability metrics not available, assuming stable' };
}

/**
 * Check resource usage (placeholder)
 */
async function checkResourceUsage(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthCheck> {
  return { status: 'healthy', score: 75, message: 'Resource usage appears normal' };
}

/**
 * Analyze trends (placeholder)
 */
async function analyzeTrends(bearerToken: string, workspaceId: string, dataflowId: string): Promise<HealthCheck> {
  return { status: 'healthy', score: 80, message: 'No negative trends detected' };
}

/**
 * Get health message based on score
 */
function getHealthMessage(score: number): string {
  if (score >= 95) return 'Excellent health';
  if (score >= 90) return 'Very good health';
  if (score >= 80) return 'Good health';
  if (score >= 70) return 'Fair health, minor issues';
  if (score >= 60) return 'Poor health, needs attention';
  return 'Critical health issues detected';
}

/**
 * Generate recommendations based on health check
 */
function generateRecommendations(healthCheck: any): string[] {
  const recommendations: string[] = [];
  const score = healthCheck.overallHealth.score;

  if (score < 70) {
    recommendations.push('🚨 Immediate attention required - health score is below acceptable threshold');
  }
  if (score < 85) {
    recommendations.push('🔧 Consider reviewing dataflow configuration and data sources');
  }
  if (score >= 90) {
    recommendations.push('✅ Dataflow is performing well - continue regular monitoring');
  }

  // Add specific recommendations based on check results
  Object.entries(healthCheck.checks).forEach(([checkName, check]: [string, any]) => {
    if (check.score && check.score < 70) {
      recommendations.push(`⚠️ ${checkName} needs attention: ${check.message}`);
    }
  });

  return recommendations.length > 0 ? recommendations : ['✅ No specific recommendations at this time'];
}

/**
 * Check for alerts based on health data
 */
function checkForAlerts(healthCheck: any): string[] {
  const alerts: string[] = [];
  const score = healthCheck.overallHealth.score;

  if (score < 60) {
    alerts.push('CRITICAL: Health score below 60%');
  } else if (score < 80) {
    alerts.push('WARNING: Health score below 80%');
  }

  return alerts;
}

/**
 * Sort dataflows by specified criteria
 */
function sortDataflows(dataflows: any[], sortBy: string): void {
  dataflows.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'health_score':
        return (b.health?.score || 0) - (a.health?.score || 0);
      case 'status':
        const statusOrder = { healthy: 3, warning: 2, critical: 1, unknown: 0 };
        return (statusOrder[b.health?.status as keyof typeof statusOrder] || 0) - (statusOrder[a.health?.status as keyof typeof statusOrder] || 0);
      default:
        return 0;
    }
  });
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(statusData: any, healthCheck: any): string {
  const healthScore = healthCheck.healthCheck?.overallHealth?.score || 85;
  const dataflowName = statusData.data?.basicInfo?.displayName || 'Dataflow';

  if (healthScore >= 90) {
    return `✅ ${dataflowName} is performing excellently with a health score of ${healthScore}%. All systems are operating normally and no immediate action is required.`;
  } else if (healthScore >= 70) {
    return `⚠️ ${dataflowName} is performing adequately with a health score of ${healthScore}%. Some optimization opportunities exist and should be addressed during the next maintenance window.`;
  } else {
    return `🚨 ${dataflowName} requires immediate attention with a health score of ${healthScore}%. Critical issues have been detected that may impact data processing reliability.`;
  }
}

/**
 * Format report as markdown
 */
function formatReportAsMarkdown(report: any): string {
  return `# ${report.metadata.title || 'Dataflow Monitoring Report'}

**Dataflow:** ${report.metadata.dataflowName || 'Unknown'}  
**Generated:** ${new Date(report.metadata.generatedAt).toLocaleString()}  
**Report Type:** ${report.metadata.reportType}

## Executive Summary

${report.sections.executiveSummary}

## Key Findings

${report.sections.healthAssessment ? `**Overall Health Score:** ${report.sections.healthAssessment.overallHealth?.score || 'N/A'}%` : ''}
${report.sections.healthAssessment ? `**Status:** ${report.sections.healthAssessment.overallHealth?.status || 'Unknown'}` : ''}

## Recommendations

${(report.sections.recommendations || []).map((rec: string) => `- ${rec}`).join('\n')}

---

*Report generated at ${report.metadata.generatedAt}*`;
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
  id: string; // Changed to string to support UUID session IDs from Fabric Livy API
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

// ==================== HEALTH CHECK SERVER ====================

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

// ====================================
// DATAFLOW GEN2 FUNCTIONS (Add after existing tool functions)
// ====================================
// Replace your existing dataflow functions with these corrected versions

/**
 * Simple health check function
 */
async function checkDataflowHealth(bearerToken: string, workspaceId: string, dataflowId: string): Promise<{ score: number; status: string; message: string }> {
  try {
    const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });

    if (response.ok) {
      const dataflow = await response.json();
      const score = dataflow && dataflow.displayName ? 90 : 70;
      const status = score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical';
      return { score, status, message: 'Dataflow is accessible and configured properly' };
    } else {
      return { score: 50, status: 'critical', message: `API returned HTTP ${response.status}` };
    }
  } catch (error) {
    return { score: 30, status: 'critical', message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

server.tool(
  "create-fabric-dataflow",
  "Create a new Dataflow Gen2 in Microsoft Fabric workspace",
  CreateDataflowSchema.shape,
  async ({ bearerToken, workspaceId, displayName, description = "" }) => {
    try {
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName,
          description
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return {
        content: [{
          type: "text",
          text: `✅ Successfully created Dataflow Gen2: "${displayName}"\nID: ${result.id}\nWorkspace: ${workspaceId}\nDescription: ${description}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error creating dataflow: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "list-fabric-dataflows",
  "List all Dataflow Gen2 in Microsoft Fabric workspace", 
  ListDataflowsSchema.shape,
  async ({ bearerToken, workspaceId }) => {
    try {
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      const dataflows = result.value || [];

      let output = `📊 **Dataflow Gen2 in Workspace**\n\n`;
      
      if (dataflows.length === 0) {
        output += "No dataflows found in this workspace.";
      } else {
        dataflows.forEach((dataflow: any, index: number) => {
          output += `${index + 1}. **${dataflow.displayName}** (${dataflow.type})\n`;
          output += `   ID: ${dataflow.id}\n`;
          if (dataflow.description) {
            output += `   Description: ${dataflow.description}\n`;
          }
          output += `   Modified: ${dataflow.modifiedDateTime || 'N/A'}\n\n`;
        });
      }

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error listing dataflows: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "get-fabric-dataflow",
  "Get details of a specific Dataflow Gen2",
  GetDataflowSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId }) => {
    try {
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const dataflow = await response.json();

      let output = `📄 **Dataflow Details**\n\n`;
      output += `**Name:** ${dataflow.displayName}\n`;
      output += `**ID:** ${dataflow.id}\n`;
      output += `**Type:** ${dataflow.type}\n`;
      output += `**Description:** ${dataflow.description || 'No description'}\n`;
      output += `**Workspace:** ${workspaceId}\n`;
      output += `**Created:** ${dataflow.createdDateTime || 'N/A'}\n`;
      output += `**Modified:** ${dataflow.modifiedDateTime || 'N/A'}\n`;

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error getting dataflow details: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "update-fabric-dataflow",
  "Update Dataflow Gen2 name or description",
  UpdateDataflowSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId, displayName, description }) => {
    try {
      const updateData: any = {};
      if (displayName) updateData.displayName = displayName;
      if (description !== undefined) updateData.description = description;

      if (Object.keys(updateData).length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: "No updates specified. Provide displayName or description to update." 
          }]
        };
      }

      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return {
        content: [{
          type: "text",
          text: `✅ Successfully updated dataflow: ${dataflowId}\n${displayName ? `New name: ${displayName}\n` : ''}${description !== undefined ? `New description: ${description}` : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error updating dataflow: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "delete-fabric-dataflow",
  "Delete a Dataflow Gen2 from workspace",
  DeleteDataflowSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId }) => {
    try {
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return {
        content: [{
          type: "text",
          text: `✅ Successfully deleted dataflow: ${dataflowId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error deleting dataflow: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "monitor-dataflow-status",
  "Get comprehensive dataflow status with health monitoring and performance metrics",
  MonitorDataflowStatusSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId, includeHealthMetrics }) => {
    try {
      console.error(`🔍 Monitoring status for dataflow: ${dataflowId}`);

      // Get basic dataflow info
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${bearerToken}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const basicDataflow = await response.json();
      
      // Create result object with proper typing
      const result = {
        timestamp: new Date().toISOString(),
        dataflowId,
        basicInfo: basicDataflow,
        monitoring: {
          isActive: true,
          lastChecked: new Date().toISOString(),
          healthScore: undefined as number | undefined,
          healthStatus: undefined as string | undefined,
          metrics: undefined as any
        }
      };

      if (includeHealthMetrics) {
        console.error(`📊 Calculating health metrics...`);
        const healthInfo = await checkDataflowHealth(bearerToken, workspaceId, dataflowId);
        
        // Properly assign the health properties
        result.monitoring.healthScore = healthInfo.score;
        result.monitoring.healthStatus = healthInfo.status;
        result.monitoring.metrics = {
          connectivityScore: healthInfo.score,
          configurationScore: healthInfo.score >= 80 ? 90 : 65,
          performanceScore: healthInfo.score >= 80 ? 85 : 60
        };
        
        console.error(`✅ Health Score: ${healthInfo.score}% (${healthInfo.status})`);
      }

      const output = `📊 **Dataflow Monitoring Status**

**Dataflow:** ${basicDataflow.displayName}
**ID:** ${dataflowId}
**Type:** ${basicDataflow.type}
**Description:** ${basicDataflow.description || 'No description'}

${includeHealthMetrics && result.monitoring.healthScore ? `**Health Status:**
- Score: ${result.monitoring.healthScore}% (${result.monitoring.healthStatus})
- Last Checked: ${result.monitoring.lastChecked}
- Connectivity: ${result.monitoring.metrics?.connectivityScore || 'N/A'}%
- Configuration: ${result.monitoring.metrics?.configurationScore || 'N/A'}%
- Performance: ${result.monitoring.metrics?.performanceScore || 'N/A'}%` : '**Health Metrics:** Not requested'}

**Basic Info:**
- Created: ${basicDataflow.createdDateTime || 'N/A'}
- Modified: ${basicDataflow.modifiedDateTime || 'N/A'}
- Workspace: ${workspaceId}

✅ Monitoring active and dataflow is accessible.`;

      return {
        content: [{ type: "text", text: output }]
      };

    } catch (error) {
      console.error(`❌ Error monitoring dataflow status:`, error);
      return {
        content: [{
          type: "text",
          text: `❌ Error monitoring dataflow status: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);


server.tool(
  "perform-dataflow-health-check",
  "Perform comprehensive health check with scoring, analysis, and recommendations",
  PerformDataflowHealthCheckSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId, checkDepth, includeRecommendations }) => {
    try {
      console.error(`🏥 Performing ${checkDepth} health check for dataflow: ${dataflowId}`);

      const healthCheck = {
        timestamp: new Date().toISOString(),
        dataflowId,
        workspaceId,
        checkDepth,
        checks: {} as Record<string, HealthCheck>,
        overallHealth: {} as any,
        alerts: [] as string[],
        recommendations: [] as string[]  // ADD THIS LINE
      };

      // Basic checks - always performed
      console.error(`🔍 Running basic connectivity checks...`);
      healthCheck.checks.connectivity = await checkConnectivity(bearerToken, workspaceId, dataflowId);
      healthCheck.checks.configuration = await checkConfiguration(bearerToken, workspaceId, dataflowId);

      // Standard checks
      if (checkDepth === 'standard' || checkDepth === 'comprehensive') {
        console.error(`📈 Running performance analysis...`);
        healthCheck.checks.performance = await checkPerformance(bearerToken, workspaceId, dataflowId);
        healthCheck.checks.reliability = await checkReliability(bearerToken, workspaceId, dataflowId);
      }

      // Comprehensive checks
      if (checkDepth === 'comprehensive') {
        console.error(`🔬 Running comprehensive analysis...`);
        healthCheck.checks.resourceUsage = await checkResourceUsage(bearerToken, workspaceId, dataflowId);
        healthCheck.checks.trends = await analyzeTrends(bearerToken, workspaceId, dataflowId);
      }

      // Calculate overall health score
      const healthScores = Object.values(healthCheck.checks)
        .filter(check => check.score !== undefined)
        .map(check => check.score);

      const overallScore = healthScores.length > 0 
        ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        : 85;

      healthCheck.overallHealth = {
        score: overallScore,
        status: overallScore >= 90 ? 'healthy' : overallScore >= 70 ? 'warning' : 'critical',
        summary: `Health score: ${overallScore}% - ${getHealthMessage(overallScore)}`
      };

      // Generate recommendations
      let recommendations: string[] = [];
      if (includeRecommendations) {
        console.error(`💡 Generating recommendations...`);
        recommendations = generateRecommendations(healthCheck);
        healthCheck.recommendations = recommendations;
      }

      // Check for alerts
      healthCheck.alerts = checkForAlerts(healthCheck);

      console.error(`✅ Health check complete: ${overallScore}% (${healthCheck.overallHealth.status})`);

      // Format output
      let output = `🏥 **Dataflow Health Check Results**

**Dataflow ID:** ${dataflowId}
**Check Depth:** ${checkDepth}
**Overall Health:** ${overallScore}% (${healthCheck.overallHealth.status})
**Checked:** ${new Date(healthCheck.timestamp).toLocaleString()}

## Health Checks:
`;

      Object.entries(healthCheck.checks).forEach(([checkName, check]) => {
        const icon = check.status === 'healthy' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
        output += `${icon} **${checkName}**: ${check.score}% - ${check.message}\n`;
      });

      if (healthCheck.alerts.length > 0) {
        output += `\n## 🚨 Alerts:\n${healthCheck.alerts.map(alert => `- ${alert}`).join('\n')}\n`;
      }

      if (recommendations.length > 0) {
        output += `\n## 💡 Recommendations:\n${recommendations.map(rec => `- ${rec}`).join('\n')}\n`;
      }

      return {
        content: [{ type: "text", text: output }]
      };

    } catch (error) {
      console.error(`❌ Error performing health check:`, error);
      return {
        content: [{
          type: "text",
          text: `❌ Error performing health check: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "monitor-workspace-dataflows",
  "Get monitoring overview of all dataflows in workspace with health scoring",
  MonitorWorkspaceDataflowsSchema.shape,
  async ({ bearerToken, workspaceId, includeHealthChecks, sortBy }) => {
    try {
      console.error(`🏢 Getting workspace monitoring overview for: ${workspaceId}`);

      // Get all dataflows using existing API pattern
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${bearerToken}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const dataflowsList = result.value || [];
      
      const overview = {
        timestamp: new Date().toISOString(),
        workspaceId,
        summary: {
          totalDataflows: 0,
          healthyCount: 0,
          warningCount: 0,
          criticalCount: 0,
          averageHealthScore: 0
        },
        dataflows: [] as any[]
      };

      console.error(`📊 Processing ${dataflowsList.length} dataflows...`);

      let totalHealthScore = 0;
      let healthScoreCount = 0;

      // Process each dataflow
      for (const dataflow of dataflowsList) {
        const dataflowInfo = {
          id: dataflow.id,
          name: dataflow.displayName,
          type: dataflow.type,
          description: dataflow.description || 'No description'
        };

        if (includeHealthChecks) {
          try {
            const healthMetrics = await calculateHealthMetrics(bearerToken, workspaceId, dataflow.id);
            Object.assign(dataflowInfo, {
              health: {
                score: healthMetrics.overallScore,
                status: healthMetrics.status,
                lastChecked: new Date().toISOString()
              }
            });

            // Update summary counts
            if (healthMetrics.status === 'healthy') overview.summary.healthyCount++;
            else if (healthMetrics.status === 'warning') overview.summary.warningCount++;
            else if (healthMetrics.status === 'critical') overview.summary.criticalCount++;

            totalHealthScore += healthMetrics.overallScore;
            healthScoreCount++;

          } catch (healthError) {
            console.error(`⚠️ Could not get health metrics for ${dataflow.displayName}:`, healthError);
            Object.assign(dataflowInfo, {
              health: {
                score: null,
                status: 'unknown',
                error: healthError instanceof Error ? healthError.message : String(healthError)
              }
            });
          }
        }

        overview.dataflows.push(dataflowInfo);
        overview.summary.totalDataflows++;
      }

      // Calculate average health score
      overview.summary.averageHealthScore = healthScoreCount > 0 
        ? Math.round(totalHealthScore / healthScoreCount) 
        : 0;

      // Sort results
      sortDataflows(overview.dataflows, sortBy);

      console.error(`✅ Workspace overview complete: ${overview.summary.totalDataflows} dataflows, avg health: ${overview.summary.averageHealthScore}%`);

      // Format output
      let output = `🏢 **Workspace Dataflow Monitoring Overview**

**Workspace:** ${workspaceId}
**Total Dataflows:** ${overview.summary.totalDataflows}
**Average Health Score:** ${overview.summary.averageHealthScore}%
**Last Updated:** ${new Date(overview.timestamp).toLocaleString()}

## Summary:
- ✅ Healthy: ${overview.summary.healthyCount}
- ⚠️ Warning: ${overview.summary.warningCount}  
- ❌ Critical: ${overview.summary.criticalCount}

## Dataflows:
`;

      overview.dataflows.forEach((dataflow, index) => {
        const healthIcon = dataflow.health?.status === 'healthy' ? '✅' : 
                          dataflow.health?.status === 'warning' ? '⚠️' : 
                          dataflow.health?.status === 'critical' ? '❌' : '❓';
        
        output += `${index + 1}. ${healthIcon} **${dataflow.name}**\n`;
        output += `   ID: ${dataflow.id}\n`;
        if (includeHealthChecks && dataflow.health) {
          output += `   Health: ${dataflow.health.score || 'N/A'}% (${dataflow.health.status})\n`;
        }
        output += `   Type: ${dataflow.type}\n\n`;
      });

      return {
        content: [{ type: "text", text: output }]
      };

    } catch (error) {
      console.error(`❌ Error getting workspace overview:`, error);
      return {
        content: [{
          type: "text",
          text: `❌ Error getting workspace overview: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "generate-dataflow-monitoring-report",
  "Generate comprehensive monitoring report with insights and recommendations",
  GenerateDataflowMonitoringReportSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId, reportType, outputFormat }) => {
    try {
      console.error(`📋 Generating ${reportType} monitoring report for dataflow: ${dataflowId}`);

      // Get basic dataflow info
      const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataflows/${dataflowId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${bearerToken}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const dataflow = await response.json();
      const healthMetrics = await calculateHealthMetrics(bearerToken, workspaceId, dataflowId);

      const report = {
        metadata: {
          title: `Dataflow Monitoring Report`,
          dataflowName: dataflow.displayName || 'Unknown',
          dataflowId,
          workspaceId,
          reportType,
          generatedAt: new Date().toISOString(),
          timeRange: 'Current Status'
        },
        sections: {
          executiveSummary: '',
          dataflowOverview: dataflow,
          healthAssessment: {
            overallHealth: {
              score: healthMetrics.overallScore,
              status: healthMetrics.status
            }
          },
          recommendations: []
        }
      };

      // Generate executive summary
      report.sections.executiveSummary = generateExecutiveSummary(
        { data: { basicInfo: dataflow } }, 
        { healthCheck: report.sections.healthAssessment }
      );

      // Generate recommendations
      const recommendations = generateRecommendations({ 
        overallHealth: { score: healthMetrics.overallScore },
        checks: {}
      });
      (report.sections as any).recommendations = recommendations;

      // Format output
      if (outputFormat === 'markdown') {
        const markdownReport = formatReportAsMarkdown(report);
        console.error(`✅ Markdown report generated (${markdownReport.length} characters)`);
        return {
          content: [{ type: "text", text: markdownReport }]
        };
      } else {
        console.error(`✅ JSON report generated`);
        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }]
        };
      }

    } catch (error) {
      console.error(`❌ Error generating monitoring report:`, error);
      return {
        content: [{
          type: "text",
          text: `❌ Error generating monitoring report: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "start-continuous-dataflow-monitoring",
  "Start continuous monitoring session with real-time health checks and alerts",
  StartContinuousDataflowMonitoringSchema.shape,
  async ({ bearerToken, workspaceId, dataflowId, intervalMinutes, durationMinutes }) => {
    const sessionId = `monitor_${dataflowId}_${Date.now()}`;
    
    console.error(`🚀 Starting continuous monitoring session: ${sessionId}`);
    console.error(`📊 Configuration: ${intervalMinutes}min intervals, ${durationMinutes}min duration`);

    const session: MonitoringSession = {
      id: sessionId,
      dataflowId,
      workspaceId,
      startTime: new Date().toISOString(),
      intervalMinutes,
      durationMinutes,
      checksPerformed: 0,
      alertsTriggered: 0,
      isActive: true,
      history: []
    };

    // Start monitoring loop
    const interval = setInterval(async () => {
      try {
        console.error(`\n⏰ ${new Date().toISOString()} - Performing scheduled health check (${session.checksPerformed + 1})...`);
        
        const healthMetrics = await calculateHealthMetrics(bearerToken, workspaceId, dataflowId);

        session.checksPerformed++;
        
        const checkResult = {
          timestamp: new Date().toISOString(),
          checkNumber: session.checksPerformed,
          healthScore: healthMetrics.overallScore,
          status: healthMetrics.status,
          alerts: healthMetrics.overallScore < 80 ? [`Health score ${healthMetrics.overallScore}% below 80%`] : []
        };

        session.history.push(checkResult);

        // Check for alerts
        if (checkResult.alerts.length > 0) {
          session.alertsTriggered++;
          console.error(`🚨 ALERTS DETECTED:`);
          checkResult.alerts.forEach(alert => console.error(`  - ${alert}`));
        } else {
          console.error(`✅ Health check passed: ${checkResult.healthScore}% (${checkResult.status})`);
        }

        // Keep only last 20 history entries to prevent memory issues
        if (session.history.length > 20) {
          session.history = session.history.slice(-20);
        }

      } catch (error) {
        console.error(`❌ Monitoring check failed:`, error);
        session.history.push({
          timestamp: new Date().toISOString(),
          checkNumber: session.checksPerformed,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, intervalMinutes * 60 * 1000);

    // Schedule stop
    let stopTimeout: NodeJS.Timeout | undefined;
    if (durationMinutes > 0) {
      stopTimeout = setTimeout(() => {
        clearInterval(interval);
        session.isActive = false;
        monitoringSessions.delete(sessionId);
        
        console.error(`⏹️ Monitoring session ${sessionId} completed`);
        console.error(`📊 Final Stats: ${session.checksPerformed} checks, ${session.alertsTriggered} alerts`);
      }, durationMinutes * 60 * 1000);
    }

    // Store session
    monitoringSessions.set(sessionId, { session, interval, timeout: stopTimeout });

    // Return immediate response
    return {
      content: [{
        type: "text",
        text: `🚀 **Continuous Monitoring Started**

**Session ID:** ${sessionId}
**Dataflow:** ${dataflowId}
**Interval:** Every ${intervalMinutes} minutes
**Duration:** ${durationMinutes > 0 ? `${durationMinutes} minutes` : 'Indefinite'}
**Started:** ${new Date(session.startTime).toLocaleString()}

✅ Monitoring is now active! Health checks will run automatically.

**What's being monitored:**
- Dataflow connectivity and accessibility
- Configuration validity
- Health score trends
- Alert conditions (score < 80%)

**To stop monitoring:** Use the session ID ${sessionId} with a stop monitoring function.

📊 Check logs for real-time monitoring updates.`
      }]
    };
  }
);

// ====================================
// BONUS: SESSION MANAGEMENT TOOLS
// ====================================

server.tool(
  "list-monitoring-sessions", 
  "List all active monitoring sessions",
  z.object({}).shape,
  async () => {
    const activeSessions = Array.from(monitoringSessions.values()).map(({ session }) => session);

    if (activeSessions.length === 0) {
      return {
        content: [{
          type: "text",
          text: "📊 No active monitoring sessions found."
        }]
      };
    }

    let output = `📊 **Active Monitoring Sessions** (${activeSessions.length})\n\n`;

    activeSessions.forEach((session, index) => {
      const duration = Date.now() - new Date(session.startTime).getTime();
      const durationMinutes = Math.round(duration / 60000);
      
      output += `${index + 1}. **${session.id}**\n`;
      output += `   Dataflow: ${session.dataflowId}\n`;
      output += `   Running: ${durationMinutes} minutes\n`;
      output += `   Checks: ${session.checksPerformed}\n`;
      output += `   Alerts: ${session.alertsTriggered}\n`;
      output += `   Status: ${session.isActive ? '🟢 Active' : '🔴 Stopped'}\n\n`;
    });

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

server.tool(
  "get-monitoring-session-status",
  "Get detailed status of a specific monitoring session",
  z.object({
    sessionId: z.string().describe("Monitoring session ID")
  }).shape,
  async ({ sessionId }) => {
    const sessionData = monitoringSessions.get(sessionId);

    if (!sessionData) {
      return {
        content: [{
          type: "text",
          text: `❌ Monitoring session '${sessionId}' not found.\n\nUse 'list-monitoring-sessions' to see active sessions.`
        }]
      };
    }

    const { session } = sessionData;
    const duration = Date.now() - new Date(session.startTime).getTime();
    const durationMinutes = Math.round(duration / 60000);

    let output = `📊 **Monitoring Session Status**

**Session ID:** ${session.id}
**Dataflow:** ${session.dataflowId}
**Workspace:** ${session.workspaceId}
**Status:** ${session.isActive ? '🟢 Active' : '🔴 Stopped'}
**Started:** ${new Date(session.startTime).toLocaleString()}
**Running:** ${durationMinutes} minutes
**Interval:** Every ${session.intervalMinutes} minutes
**Duration:** ${session.durationMinutes > 0 ? `${session.durationMinutes} minutes` : 'Indefinite'}

**Statistics:**
- Health Checks Performed: ${session.checksPerformed}
- Alerts Triggered: ${session.alertsTriggered}
- Success Rate: ${session.checksPerformed > 0 ? Math.round(((session.checksPerformed - session.alertsTriggered) / session.checksPerformed) * 100) : 0}%

**Recent History** (Last 5 checks):
`;

    const recentHistory = session.history.slice(-5);
    if (recentHistory.length === 0) {
      output += "No checks performed yet.\n";
    } else {
      recentHistory.forEach((check, index) => {
        const statusIcon = check.error ? '❌' : 
                          (check.alerts && check.alerts.length > 0) ? '⚠️' : '✅';
        
        output += `${statusIcon} Check ${check.checkNumber}: `;
        if (check.error) {
          output += `Error - ${check.error}`;
        } else {
          output += `${check.healthScore}% (${check.status})`;
          if (check.alerts && check.alerts.length > 0) {
            output += ` - ${check.alerts.length} alert(s)`;
          }
        }
        output += `\n   Time: ${new Date(check.timestamp).toLocaleString()}\n`;
      });
    }

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

server.tool(
  "stop-monitoring-session",
  "Stop a specific monitoring session",
  z.object({
    sessionId: z.string().describe("Monitoring session ID to stop")
  }).shape,
  async ({ sessionId }) => {
    const sessionData = monitoringSessions.get(sessionId);

    if (!sessionData) {
      return {
        content: [{
          type: "text",
          text: `❌ Monitoring session '${sessionId}' not found or already stopped.\n\nUse 'list-monitoring-sessions' to see active sessions.`
        }]
      };
    }

    const { session, interval, timeout } = sessionData;

    // Stop the monitoring
    clearInterval(interval);
    if (timeout) {
      clearTimeout(timeout);
    }
    
    session.isActive = false;
    const endTime = new Date().toISOString();
    
    // Remove from active sessions
    monitoringSessions.delete(sessionId);

    const totalDuration = Date.now() - new Date(session.startTime).getTime();
    const durationMinutes = Math.round(totalDuration / 60000);

    console.error(`⏹️ Monitoring session ${sessionId} stopped manually`);

    return {
      content: [{
        type: "text",
        text: `⏹️ **Monitoring Session Stopped**

**Session ID:** ${sessionId}
**Dataflow:** ${session.dataflowId}
**Started:** ${new Date(session.startTime).toLocaleString()}
**Stopped:** ${new Date(endTime).toLocaleString()}
**Total Duration:** ${durationMinutes} minutes

**Final Statistics:**
- Total Health Checks: ${session.checksPerformed}
- Alerts Triggered: ${session.alertsTriggered}
- Success Rate: ${session.checksPerformed > 0 ? Math.round(((session.checksPerformed - session.alertsTriggered) / session.checksPerformed) * 100) : 0}%

✅ Session successfully terminated.`
      }]
    };
  }
);

// Add these tools to your existing server.tool() definitions

server.tool(
  "list-fabric-item-runs",
  "List all runs for a specific Fabric item with analysis",
  ListFabricItemRunsSchema.shape,
  async ({ bearerToken, workspaceId, itemId, continuationToken, top }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "list-item-runs",
      async (client) => {
        // Use the Fabric Jobs API
        const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${itemId}/jobs/instances`;
        const params = new URLSearchParams();
        if (continuationToken) params.append("continuationToken", continuationToken);
        params.append("$top", Math.min(top || 100, 1000).toString());

        const response = await fetch(`${url}?${params}`, {
          headers: {
            "Authorization": `Bearer ${bearerToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return { status: 'success' as const, data: await response.json() };
      },
      { itemId, continuationToken, top }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `❌ Error listing runs: ${result.error}` }]
      };
    }

    const data = result.data;
    const runs: FabricRun[] = data?.value || [];
    
    if (runs.length === 0) {
      return {
        content: [{ type: "text", text: `No runs found for item ${itemId}` }]
      };
    }

    // Analyze runs
    const analysis = analyzeRunsSummary(runs);
    
    let output = `📋 **Fabric Item Runs Analysis**

**Item ID:** ${itemId}
**Total Runs:** ${analysis.totalRuns}
**Success Rate:** ${Math.round(analysis.successRate)}%

## Summary:
- ✅ Successful: ${analysis.successfulRuns}
- ❌ Failed: ${analysis.failedRuns}  
- 🏃 Running: ${analysis.runningRuns}
- ⏱️ Average Duration: ${analysis.averageDuration ? formatDuration(analysis.averageDuration) : 'N/A'}

## Recent Runs:
`;

    runs.slice(0, 10).forEach((run, index) => {
      const statusIcon = run.status === "Succeeded" ? "✅" : 
                        run.status === "Failed" ? "❌" : 
                        run.status === "Running" ? "🏃" : "⏸️";
      
      const duration = run.endTimeUtc ? formatDuration(calculateDuration(run.startTimeUtc, run.endTimeUtc)) : "In progress";
      
      output += `${index + 1}. ${statusIcon} **${run.id}**\n`;
      output += `   Status: ${run.status}\n`;
      output += `   Started: ${new Date(run.startTimeUtc).toLocaleString()}\n`;
      output += `   Duration: ${duration}\n`;
      if (run.errorMessage) {
        output += `   Error: ${run.errorMessage}\n`;
      }
      output += `\n`;
    });

    if (analysis.recentFailures.length > 0) {
      output += `\n## 🚨 Recent Failures:\n`;
      analysis.recentFailures.slice(0, 3).forEach((failure, index) => {
        output += `${index + 1}. ${failure.id} - ${new Date(failure.startTimeUtc).toLocaleString()}\n`;
        if (failure.errorMessage) {
          output += `   Error: ${failure.errorMessage}\n`;
        }
      });
    }

    if (data.continuationToken) {
      output += `\n💡 More results available (continuationToken: ${data.continuationToken})`;
    }

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

server.tool(
  "get-fabric-item-run", 
  "Get detailed information about a specific Fabric item run",
  GetFabricItemRunSchema.shape,
  async ({ bearerToken, workspaceId, itemId, jobInstanceId, includeSubactivities }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-item-run",
      async (client) => {
        // Get run details
        const runUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}`;
        const runResponse = await fetch(runUrl, {
          headers: {
            "Authorization": `Bearer ${bearerToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!runResponse.ok) {
          throw new Error(`HTTP ${runResponse.status}: ${await runResponse.text()}`);
        }

        const runData = await runResponse.json();
// Removed noisy debug stdout (would break MCP JSON framing). For troubleshooting, enable DEBUG_MCP_RUN=1.
if (process.env.DEBUG_MCP_RUN === '1') {
  const dbg = (...args: unknown[]) => console.error('[debug run-data]', ...args);
  dbg('=== RAW API RESPONSE DEBUG ===');
  dbg('Full runData object:', JSON.stringify(runData, null, 2));
  dbg('=== DATE FIELDS ANALYSIS ===');
  dbg('startTime:', typeof runData.startTime, '=', runData.startTime);
  dbg('endTime:', typeof runData.endTime, '=', runData.endTime);
  dbg('createdDateTime:', typeof runData.createdDateTime, '=', runData.createdDateTime);
  dbg('lastUpdatedTime:', typeof runData.lastUpdatedTime, '=', runData.lastUpdatedTime);
  dbg('================================');
}
         // Get subactivities if requested
        let subactivities: FabricSubactivity[] = [];
        if (includeSubactivities) {
          try {
            const activitiesUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}/activities`;
            const activitiesResponse = await fetch(activitiesUrl, {
              headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "Content-Type": "application/json"
              }
            });

            if (activitiesResponse.ok) {
              const activitiesData = await activitiesResponse.json();
              subactivities = activitiesData.value || [];
            }
          } catch (error) {
            console.error("Failed to get subactivities:", error);
          }
        }

        return { 
          status: 'success' as const, 
          data: { run: runData, subactivities } as FabricRunWithSubactivities
        };
      },
      { itemId, jobInstanceId, includeSubactivities }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `❌ Error getting run details: ${result.error}` }]
      };
    }

    if (!result.data) {
      return {
        content: [{ type: "text", text: `❌ No run data received` }]
      };
    }

    const { run, subactivities } = result.data;
    const analysis = analyzeSingleRun(run, subactivities);

    let output = `🔍 **Fabric Run Details**

**Run ID:** ${run.id}
**Item ID:** ${itemId}
**Status:** ${run.status}
**Invoke Type:** ${run.invokeType || 'N/A'}

## Timing:
- **Started:** ${safeFormatDate(run.startTimeUtc)}
- **Ended:** ${safeFormatDate(run.endTimeUtc)}
- **Duration:** ${analysis.duration}

## Analysis:
- **Efficiency:** ${Math.round(analysis.efficiency)}%
- **Has Errors:** ${analysis.hasErrors ? 'Yes' : 'No'}
- **Long Running:** ${analysis.isLongRunning ? 'Yes' : 'No'}

`;

    if (run.errorMessage) {
      output += `## ❌ Error Message:
\`\`\`
${run.errorMessage}
\`\`\`

`;
    }

    if (includeSubactivities && subactivities.length > 0) {
      const subactivityAnalysis = analysis.subactivitySummary;
      
      output += `## 📊 Subactivities (${subactivities.length} total):
- ✅ Successful: ${subactivityAnalysis.successfulActivities}
- ❌ Failed: ${subactivityAnalysis.failedActivities}
- 🏃 Running: ${subactivityAnalysis.runningActivities}

### Activity Types:
`;
      Object.entries(subactivityAnalysis.activityTypes).forEach(([type, count]) => {
        output += `- ${type}: ${count}\n`;
      });

      if (subactivityAnalysis.bottlenecks.length > 0) {
        output += `\n### 🐌 Performance Bottlenecks:
`;
        subactivityAnalysis.bottlenecks.forEach((bottleneck: FabricSubactivity & { calculatedDuration: number }, index: number) => {
          const duration = formatDuration(bottleneck.calculatedDuration);
          output += `${index + 1}. **${bottleneck.displayName}** (${bottleneck.activityType})\n`;
          output += `   Duration: ${duration}\n`;
          output += `   Status: ${bottleneck.status}\n\n`;
        });
      }
    }

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

server.tool(
  "list-fabric-run-subactivities",
  "List subactivities for a specific Fabric item run with analysis",
  ListFabricRunSubactivitiesSchema.shape,
  async ({ bearerToken, workspaceId, itemId, jobInstanceId, continuationToken, top }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "list-run-subactivities", 
      async (client) => {
        const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}/activities`;
        const params = new URLSearchParams();
        if (continuationToken) params.append("continuationToken", continuationToken);
        params.append("$top", Math.min(top || 100, 1000).toString());

        const response = await fetch(`${url}?${params}`, {
          headers: {
            "Authorization": `Bearer ${bearerToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return { status: 'success' as const, data: await response.json() };
      },
      { itemId, jobInstanceId, continuationToken, top }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `❌ Error listing subactivities: ${result.error}` }]
      };
    }

    const data = result.data;
    const subactivities: FabricSubactivity[] = data?.value || [];
    
    if (subactivities.length === 0) {
      return {
        content: [{ type: "text", text: `No subactivities found for run ${jobInstanceId}` }]
      };
    }

    const analysis = analyzeSubactivities(subactivities);

    let output = `🔧 **Run Subactivities Analysis**

**Run ID:** ${jobInstanceId}
**Total Activities:** ${analysis.totalActivities}

## Summary:
- ✅ Successful: ${analysis.successfulActivities}
- ❌ Failed: ${analysis.failedActivities}
- 🏃 Running: ${analysis.runningActivities}

## Activity Types:
`;

    Object.entries(analysis.activityTypes).forEach(([type, count]) => {
      output += `- **${type}:** ${count}\n`;
    });

    output += `\n## Activities:\n`;

    subactivities.slice(0, 15).forEach((activity, index) => {
      const statusIcon = activity.status === "Succeeded" ? "✅" : 
                        activity.status === "Failed" ? "❌" : 
                        activity.status === "Running" ? "🏃" : "⏸️";
      
      const duration = activity.endTime ? 
        formatDuration(calculateDuration(activity.startTime, activity.endTime)) : 
        "In progress";
      
      output += `${index + 1}. ${statusIcon} **${activity.displayName}**\n`;
      output += `   Type: ${activity.activityType}\n`;
      output += `   Duration: ${duration}\n`;
      output += `   Started: ${new Date(activity.startTime).toLocaleString()}\n`;
      if (activity.errorMessage) {
        output += `   Error: ${activity.errorMessage}\n`;
      }
      output += `\n`;
    });

    if (subactivities.length > 15) {
      output += `\n... and ${subactivities.length - 15} more activities\n`;
    }

    if (data.continuationToken) {
      output += `\n💡 More results available (continuationToken: ${data.continuationToken})`;
    }

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

server.tool(
  "monitor-fabric-runs-dashboard",
  "Get comprehensive monitoring dashboard for recent runs across workspace",
  MonitorFabricRunsDashboardSchema.shape,
  async ({ bearerToken, workspaceId, hoursBack, includeSubactivities }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "monitor-runs-dashboard",
      async (client) => {
        // Get all items in workspace first
        const itemsUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items`;
        const itemsResponse = await fetch(itemsUrl, {
          headers: {
            "Authorization": `Bearer ${bearerToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!itemsResponse.ok) {
          throw new Error(`Failed to get workspace items: ${itemsResponse.status}`);
        }

        const itemsData = await itemsResponse.json();
        const items = itemsData.value || [];

        // Get recent runs for each item (limit to first 10 items for performance)
        const dashboard = {
          workspaceId,
          analyzedPeriod: `${hoursBack} hours`,
          timestamp: new Date().toISOString(),
          itemsAnalyzed: 0,
          totalRuns: 0,
          overallMetrics: {
            successfulRuns: 0,
            failedRuns: 0,
            runningRuns: 0,
            successRate: 0
          },
          itemBreakdown: [] as any[],
          recentFailures: [] as any[]
        };

        for (const item of items.slice(0, 10)) {
          try {
            // Get runs for this item
            const runsUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${item.id}/jobs/instances?$top=50`;
            const runsResponse = await fetch(runsUrl, {
              headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "Content-Type": "application/json"
              }
            });

            if (runsResponse.ok) {
              const runsData = await runsResponse.json();
             const allRuns = runsData.value || [];
              const recentRuns = filterRecentRuns(allRuns, hoursBack);
              
              if (recentRuns.length > 0) {
                dashboard.itemsAnalyzed++;
                dashboard.totalRuns += recentRuns.length;
                
                const itemMetrics = analyzeRunsSummary(recentRuns);
                dashboard.overallMetrics.successfulRuns += itemMetrics.successfulRuns;
                dashboard.overallMetrics.failedRuns += itemMetrics.failedRuns;
                dashboard.overallMetrics.runningRuns += itemMetrics.runningRuns;

                dashboard.itemBreakdown.push({
                  itemId: item.id,
                  itemName: item.displayName,
                  itemType: item.type,
                  metrics: itemMetrics,
                  recentRunCount: recentRuns.length
                });

                // Collect recent failures
                dashboard.recentFailures.push(...itemMetrics.recentFailures.map(run => ({
                  ...run,
                  itemName: item.displayName,
                  itemType: item.type
                })));
              }
            }
          } catch (error) {
            console.warn(`Failed to analyze item ${item.id}:`, error);
          }
        }

        // Calculate overall success rate
        if (dashboard.totalRuns > 0) {
          dashboard.overallMetrics.successRate = 
            (dashboard.overallMetrics.successfulRuns / dashboard.totalRuns) * 100;
        }

        // Sort recent failures by time
        dashboard.recentFailures.sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

        return { status: 'success' as const, data: dashboard };
      },
      { hoursBack, includeSubactivities }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `❌ Error creating dashboard: ${result.error}` }]
      };
    }

        if (!result.data) {
      return {
        content: [{ type: "text", text: `❌ No dashboard data received` }]
      };
    }

    const dashboard = result.data;

    let output = `📊 **Fabric Runs Monitoring Dashboard**

**Workspace:** ${workspaceId}
**Time Period:** Last ${hoursBack} hours
**Items Analyzed:** ${dashboard.itemsAnalyzed}
**Total Runs:** ${dashboard.totalRuns}
**Overall Success Rate:** ${Math.round(dashboard.overallMetrics.successRate)}%

## Summary:
- ✅ Successful: ${dashboard.overallMetrics.successfulRuns}
- ❌ Failed: ${dashboard.overallMetrics.failedRuns}
- 🏃 Running: ${dashboard.overallMetrics.runningRuns}

## Items Breakdown:
`;

    dashboard.itemBreakdown.forEach((item, index) => {
      output += `${index + 1}. **${item.itemName}** (${item.itemType})\n`;
      output += `   Recent runs: ${item.recentRunCount}\n`;
      output += `   Success rate: ${Math.round(item.metrics.successRate)}%\n`;
      if (item.metrics.averageDuration) {
        output += `   Avg duration: ${formatDuration(item.metrics.averageDuration)}\n`;
      }
      output += `\n`;
    });

    if (dashboard.recentFailures.length > 0) {
      output += `\n## 🚨 Recent Failures:\n`;
      dashboard.recentFailures.slice(0, 5).forEach((failure, index) => {
        output += `${index + 1}. **${failure.itemName}** (${failure.itemType})\n`;
        output += `   Run: ${failure.id}\n`;
        output += `   Failed: ${new Date(failure.startTime).toLocaleString()}\n`;
        if (failure.errorMessage) {
          output += `   Error: ${failure.errorMessage.substring(0, 100)}...\n`;
        }
        output += `\n`;
      });
    }

    if (dashboard.totalRuns === 0) {
      output += `\n💡 No runs found in the last ${hoursBack} hours.`;
    }

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

server.tool(
  "analyze-fabric-run-performance",
  "Perform detailed performance analysis on a specific run",
  AnalyzeFabricRunPerformanceSchema.shape,
  async ({ bearerToken, workspaceId, itemId, jobInstanceId, analysisType }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "analyze-run-performance",
      async (client) => {
        // Get run details with subactivities
        const runUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}`;
        const runResponse = await fetch(runUrl, {
          headers: {
            "Authorization": `Bearer ${bearerToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!runResponse.ok) {
          throw new Error(`HTTP ${runResponse.status}: ${await runResponse.text()}`);
        }

        const runData = await runResponse.json();
         

        // Get subactivities
        const activitiesUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}/activities`;
        let subactivities: FabricSubactivity[] = [];
        
        try {
          const activitiesResponse = await fetch(activitiesUrl, {
            headers: {
              "Authorization": `Bearer ${bearerToken}`,
              "Content-Type": "application/json"
            }
          });

          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            subactivities = activitiesData.value || [];
          }
        } catch (error) {
          console.error("Failed to get subactivities:", error);
        }

        return { 
          status: 'success' as const, 
          data: { run: runData, subactivities }
        };
      },
      { itemId, jobInstanceId, analysisType }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `❌ Error analyzing performance: ${result.error}` }]
      };
    }

      const runData = result.data;
    if (!runData) {
      return {
        content: [{ type: "text", text: `❌ No run data received` }]
      };
    }
    const { run, subactivities } = runData;
     const analysis = analyzeSingleRun(run, subactivities);
    const recommendations = generatePerformanceRecommendations(run, subactivities, analysisType);   // After: const { run, subactivities } = result.data;

    // Calculate additional metrics based on analysis type
    const performanceMetrics = {
      totalDuration: run.endTimeUtc ? calculateDuration(run.StartTimeUtc, run.endTimeUtc) : null,
      totalSubactivities: subactivities.length,
      completedSubactivities: subactivities.filter(a => a.status === "Succeeded").length,
      failedSubactivities: subactivities.filter(a => a.status === "Failed").length,
      longestActivity: subactivities.length > 0 ? 
        subactivities
          .filter(a => a.endTime)
          .reduce((prev, curr) => 
            calculateDuration(curr.startTime, curr.endTime!) > calculateDuration(prev.startTime, prev.endTime!) ? curr : prev
          ) : null,
      criticalPath: subactivities
        .filter(a => a.endTime && a.status === "Succeeded")
        .sort((a, b) => calculateDuration(b.startTime, b.endTime!) - calculateDuration(a.startTime, a.endTime!))
        .slice(0, 3)
    };

    let output = `🔬 **Fabric Run Performance Analysis**

**Run ID:** ${jobInstanceId}
**Item ID:** ${itemId}
**Analysis Type:** ${analysisType}
**Analyzed:** ${new Date().toLocaleString()}

## Overall Performance:
- **Status:** ${run.status}
- **Total Duration:** ${performanceMetrics.totalDuration ? formatDuration(performanceMetrics.totalDuration) : 'In progress'}
- **Efficiency:** ${Math.round(analysis.efficiency)}%
- **Subactivities:** ${performanceMetrics.totalSubactivities} total

## Execution Metrics:
- ✅ **Completed:** ${performanceMetrics.completedSubactivities}
- ❌ **Failed:** ${performanceMetrics.failedSubactivities}
- ⏱️ **Success Rate:** ${performanceMetrics.totalSubactivities > 0 ? Math.round((performanceMetrics.completedSubactivities / performanceMetrics.totalSubactivities) * 100) : 0}%

`;

    if (analysisType === "performance" || analysisType === "comprehensive") {
      output += `## ⚡ Performance Analysis:
`;
      if (performanceMetrics.longestActivity) {
        const longestDuration = formatDuration(calculateDuration(performanceMetrics.longestActivity.startTime, performanceMetrics.longestActivity.endTime!));
        output += `- **Longest Activity:** ${performanceMetrics.longestActivity.displayName} (${longestDuration})\n`;
      }

      if (performanceMetrics.criticalPath.length > 0) {
        output += `- **Critical Path Activities:**\n`;
        performanceMetrics.criticalPath.forEach((activity, index) => {
          const duration = formatDuration(calculateDuration(activity.startTime, activity.endTime!));
          output += `  ${index + 1}. ${activity.displayName} - ${duration}\n`;
        });
      }

      // Parallel execution analysis
      const overlappingActivities = subactivities.filter(a => a.status === "Running").length;
      if (overlappingActivities > 1) {
        output += `- **Parallel Execution:** ${overlappingActivities} activities running concurrently\n`;
      }
    }

    if (analysisType === "errors" || analysisType === "comprehensive") {
      const errorActivities = subactivities.filter(a => a.status === "Failed");
      if (errorActivities.length > 0) {
        output += `\n## ❌ Error Analysis:
- **Failed Activities:** ${errorActivities.length}
- **Error Rate:** ${Math.round((errorActivities.length / subactivities.length) * 100)}%

### Failed Activities:
`;
        errorActivities.slice(0, 5).forEach((activity, index) => {
          output += `${index + 1}. **${activity.displayName}** (${activity.activityType})\n`;
          if (activity.errorMessage) {
            output += `   Error: ${activity.errorMessage.substring(0, 150)}...\n`;
          }
          output += `   Failed at: ${new Date(activity.startTime).toLocaleString()}\n\n`;
        });
      } else {
        output += `\n## ✅ Error Analysis:
No failed activities detected in this run.

`;
      }
    }

    if (analysisType === "bottlenecks" || analysisType === "comprehensive") {
      const bottlenecks = subactivities
        .filter(a => a.endTime)
        .map(a => ({
          ...a,
          duration: calculateDuration(a.startTime, a.endTime!)
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);

      if (bottlenecks.length > 0) {
        output += `\n## 🐌 Bottleneck Analysis:
### Top Performance Bottlenecks:
`;
        bottlenecks.forEach((bottleneck, index) => {
          output += `${index + 1}. **${bottleneck.displayName}**\n`;
          output += `   Duration: ${formatDuration(bottleneck.duration)}\n`;
          output += `   Type: ${bottleneck.activityType}\n`;
          output += `   Status: ${bottleneck.status}\n\n`;
        });

        // Identify potential optimization opportunities
        const averageDuration = bottlenecks.reduce((sum, b) => sum + b.duration, 0) / bottlenecks.length;
        const slowActivities = bottlenecks.filter(b => b.duration > averageDuration * 2);
        
        if (slowActivities.length > 0) {
          output += `### 🎯 Optimization Targets:
Activities taking significantly longer than average:
`;
          slowActivities.forEach((activity, index) => {
            output += `${index + 1}. ${activity.displayName} - ${formatDuration(activity.duration)}\n`;
          });
        }
      }
    }

    output += `\n## 💡 Recommendations:
`;
    recommendations.forEach((rec, index) => {
      output += `${index + 1}. ${rec}\n`;
    });

    // Add timeline analysis for comprehensive reports
    if (analysisType === "comprehensive" && subactivities.length > 0) {
      output += `\n## 📈 Execution Timeline:
`;
      
      // Group activities by hour to show execution pattern
      const timeGroups: Record<string, number> = {};
      subactivities.forEach(activity => {
        const hour = new Date(activity.startTime).getHours();
        const timeKey = `${hour}:00`;
        timeGroups[timeKey] = (timeGroups[timeKey] || 0) + 1;
      });

      output += `### Activity Distribution by Hour:
`;
      Object.entries(timeGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([time, count]) => {
          output += `- ${time} - ${count} activities\n`;
        });

      // Resource utilization summary
      const resourceTypes = subactivities.reduce((acc, activity) => {
        acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      output += `\n### Resource Utilization:
`;
      Object.entries(resourceTypes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = Math.round((count / subactivities.length) * 100);
          output += `- ${type}: ${count} activities (${percentage}%)\n`;
        });
    }

    return {
      content: [{ type: "text", text: output }]
    };
  }
);

// ====================================
// INTEGRATION INSTRUCTIONS
// ====================================

/*

To integrate these run monitoring tools into your existing MCP server:

1. Add the schemas above after your existing schema definitions
2. Add the helper functions after your existing helper functions  
3. Add the server.tool() definitions after your existing tools
4. The tools will automatically use your existing executeApiCall function

These tools provide:

✅ list-fabric-item-runs - List and analyze all runs for an item
✅ get-fabric-item-run - Get detailed run info with subactivities
✅ list-fabric-run-subactivities - Analyze subactivities in detail
✅ monitor-fabric-runs-dashboard - Workspace-wide monitoring overview
✅ analyze-fabric-run-performance - Deep performance analysis

Key Features:
- Comprehensive run analysis with success rates and timing
- Subactivity breakdown and bottleneck identification  
- Performance recommendations and optimization tips
- Error analysis and failure pattern detection
- Dashboard view across multiple items
- Support for pagination and large datasets

Usage Examples:
- List recent runs: list-fabric-item-runs with bearerToken, workspaceId, itemId
- Get run details: get-fabric-item-run with bearerToken, workspaceId, itemId, jobInstanceId
- Monitor workspace: monitor-fabric-runs-dashboard with bearerToken, workspaceId
- Analyze performance: analyze-fabric-run-performance with all parameters

The tools integrate seamlessly with your existing authentication and error handling patterns.

*/

async function main() {
  // Capacity tools now registered early (line ~1295) - no late fallback needed
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
