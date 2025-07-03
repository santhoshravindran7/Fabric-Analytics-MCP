#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FabricApiClient, ApiResponse } from './fabric-client.js';
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
 * Get or refresh authentication token with timeout protection for Claude Desktop
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
    },
    
    sales_analysis: {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: "markdown",
          source: [
            "# Sales Data Analysis\n\n",
            "This notebook provides a comprehensive analysis of sales data including:\n",
            "- Data loading and exploration\n",
            "- Sales trend analysis\n",
            "- Customer segmentation\n",
            "- Revenue forecasting\n"
          ],
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
            "from datetime import datetime, timedelta\n",
            "import warnings\n",
            "warnings.filterwarnings('ignore')\n\n",
            "# Set plotting style\n",
            "plt.style.use('seaborn-v0_8')\n",
            "sns.set_palette('husl')"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Generate sample sales data\n",
            "np.random.seed(42)\n",
            "start_date = datetime(2023, 1, 1)\n",
            "end_date = datetime(2024, 12, 31)\n",
            "date_range = pd.date_range(start=start_date, end=end_date, freq='D')\n\n",
            "# Create sample data\n",
            "sales_data = pd.DataFrame({\n",
            "    'date': np.random.choice(date_range, 10000),\n",
            "    'customer_id': np.random.randint(1000, 9999, 10000),\n",
            "    'product_category': np.random.choice(['Electronics', 'Clothing', 'Home', 'Sports', 'Books'], 10000),\n",
            "    'sales_amount': np.random.exponential(100, 10000),\n",
            "    'quantity': np.random.randint(1, 10, 10000),\n",
            "    'region': np.random.choice(['North', 'South', 'East', 'West'], 10000)\n",
            "})\n\n",
            "print(f\"Generated {len(sales_data)} sales records\")\n",
            "print(sales_data.head())"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Data exploration\n",
            "print(\"Sales Data Summary:\")\n",
            "print(sales_data.describe())\n",
            "print(\"\\nData Types:\")\n",
            "print(sales_data.dtypes)\n",
            "print(\"\\nMissing Values:\")\n",
            "print(sales_data.isnull().sum())"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Sales trend analysis\n",
            "daily_sales = sales_data.groupby('date')['sales_amount'].sum().reset_index()\n",
            "daily_sales = daily_sales.sort_values('date')\n\n",
            "plt.figure(figsize=(15, 6))\n",
            "plt.plot(daily_sales['date'], daily_sales['sales_amount'], alpha=0.7)\n",
            "plt.title('Daily Sales Trend')\n",
            "plt.xlabel('Date')\n",
            "plt.ylabel('Sales Amount')\n",
            "plt.xticks(rotation=45)\n",
            "plt.tight_layout()\n",
            "plt.show()"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Category analysis\n",
            "category_sales = sales_data.groupby('product_category')['sales_amount'].agg(['sum', 'mean', 'count'])\n",
            "category_sales.columns = ['Total_Sales', 'Avg_Sales', 'Transaction_Count']\n",
            "category_sales = category_sales.sort_values('Total_Sales', ascending=False)\n\n",
            "fig, axes = plt.subplots(1, 2, figsize=(15, 6))\n",
            "category_sales['Total_Sales'].plot(kind='bar', ax=axes[0], title='Total Sales by Category')\n",
            "category_sales['Avg_Sales'].plot(kind='bar', ax=axes[1], title='Average Sales by Category')\n",
            "plt.tight_layout()\n",
            "plt.show()\n\n",
            "print(category_sales)"
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
    
    nyc_taxi_analysis: {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: "markdown",
          source: [
            "# NYC Taxi Data Analysis\n\n",
            "This notebook analyzes NYC taxi trip data including:\n",
            "- Trip patterns and trends\n",
            "- Fare analysis\n",
            "- Geographic distribution\n",
            "- Time-based patterns\n"
          ],
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
            "from datetime import datetime, timedelta\n",
            "import warnings\n",
            "warnings.filterwarnings('ignore')\n\n",
            "# Set plotting style\n",
            "plt.style.use('seaborn-v0_8')\n",
            "sns.set_palette('viridis')"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Generate sample NYC taxi data\n",
            "np.random.seed(42)\n",
            "n_trips = 50000\n\n",
            "# NYC coordinates (approximately)\n",
            "nyc_lat_min, nyc_lat_max = 40.4774, 40.9176\n",
            "nyc_lon_min, nyc_lon_max = -74.2591, -73.7004\n\n",
            "taxi_data = pd.DataFrame({\n",
            "    'trip_id': range(1, n_trips + 1),\n",
            "    'pickup_datetime': pd.date_range('2024-01-01', periods=n_trips, freq='5min'),\n",
            "    'pickup_latitude': np.random.uniform(nyc_lat_min, nyc_lat_max, n_trips),\n",
            "    'pickup_longitude': np.random.uniform(nyc_lon_min, nyc_lon_max, n_trips),\n",
            "    'dropoff_latitude': np.random.uniform(nyc_lat_min, nyc_lat_max, n_trips),\n",
            "    'dropoff_longitude': np.random.uniform(nyc_lon_min, nyc_lon_max, n_trips),\n",
            "    'passenger_count': np.random.choice([1, 2, 3, 4, 5], n_trips, p=[0.5, 0.25, 0.15, 0.08, 0.02]),\n",
            "    'trip_distance': np.random.exponential(3, n_trips),\n",
            "    'fare_amount': np.random.exponential(15, n_trips) + 2.5,\n",
            "    'tip_amount': np.random.exponential(3, n_trips),\n",
            "    'payment_type': np.random.choice(['Credit', 'Cash'], n_trips, p=[0.7, 0.3])\n",
            "})\n\n",
            "# Add dropoff datetime based on trip distance\n",
            "trip_duration_minutes = taxi_data['trip_distance'] * 3 + np.random.normal(5, 2, n_trips)\n",
            "taxi_data['dropoff_datetime'] = taxi_data['pickup_datetime'] + pd.to_timedelta(trip_duration_minutes, unit='min')\n\n",
            "print(f\"Generated {len(taxi_data)} taxi trip records\")\n",
            "print(taxi_data.head())"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Data exploration\n",
            "print(\"Taxi Data Summary:\")\n",
            "print(taxi_data.describe())\n",
            "print(\"\\nTrip Statistics:\")\n",
            "print(f\"Average trip distance: {taxi_data['trip_distance'].mean():.2f} miles\")\n",
            "print(f\"Average fare: ${taxi_data['fare_amount'].mean():.2f}\")\n",
            "print(f\"Average tip: ${taxi_data['tip_amount'].mean():.2f}\")"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Time-based analysis\n",
            "taxi_data['pickup_hour'] = taxi_data['pickup_datetime'].dt.hour\n",
            "taxi_data['pickup_day'] = taxi_data['pickup_datetime'].dt.day_name()\n\n",
            "fig, axes = plt.subplots(2, 2, figsize=(15, 12))\n\n",
            "# Trips by hour\n",
            "hourly_trips = taxi_data.groupby('pickup_hour').size()\n",
            "hourly_trips.plot(kind='bar', ax=axes[0,0], title='Trips by Hour of Day')\n",
            "axes[0,0].set_xlabel('Hour')\n",
            "axes[0,0].set_ylabel('Number of Trips')\n\n",
            "# Trips by day of week\n",
            "daily_trips = taxi_data.groupby('pickup_day').size()\n",
            "daily_trips.plot(kind='bar', ax=axes[0,1], title='Trips by Day of Week')\n",
            "axes[0,1].set_xlabel('Day')\n",
            "axes[0,1].set_ylabel('Number of Trips')\n\n",
            "# Fare distribution\n",
            "axes[1,0].hist(taxi_data['fare_amount'], bins=50, alpha=0.7)\n",
            "axes[1,0].set_title('Fare Amount Distribution')\n",
            "axes[1,0].set_xlabel('Fare Amount ($)')\n",
            "axes[1,0].set_ylabel('Frequency')\n\n",
            "# Distance vs Fare scatter\n",
            "sample_data = taxi_data.sample(5000)  # Sample for better visualization\n",
            "axes[1,1].scatter(sample_data['trip_distance'], sample_data['fare_amount'], alpha=0.5)\n",
            "axes[1,1].set_title('Trip Distance vs Fare Amount')\n",
            "axes[1,1].set_xlabel('Trip Distance (miles)')\n",
            "axes[1,1].set_ylabel('Fare Amount ($)')\n\n",
            "plt.tight_layout()\n",
            "plt.show()"
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
          source: [
            "# Data Exploration Template\n\n",
            "This notebook provides a structured approach to data exploration:\n",
            "- Data loading and basic inspection\n",
            "- Statistical summaries\n",
            "- Data quality assessment\n",
            "- Visualization and patterns\n"
          ],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Import essential libraries for data exploration\n",
            "import pandas as pd\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n",
            "from scipy import stats\n",
            "import warnings\n",
            "warnings.filterwarnings('ignore')\n\n",
            "# Configure display options\n",
            "pd.set_option('display.max_columns', None)\n",
            "pd.set_option('display.max_rows', 100)\n",
            "plt.style.use('seaborn-v0_8')"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Load your dataset here\n",
            "# df = pd.read_csv('your_data.csv')\n",
            "# For demonstration, we'll create a sample dataset\n\n",
            "np.random.seed(42)\n",
            "df = pd.DataFrame({\n",
            "    'feature_A': np.random.normal(100, 15, 1000),\n",
            "    'feature_B': np.random.exponential(2, 1000),\n",
            "    'feature_C': np.random.choice(['Category_1', 'Category_2', 'Category_3'], 1000),\n",
            "    'feature_D': np.random.uniform(0, 100, 1000),\n",
            "    'target': np.random.choice([0, 1], 1000, p=[0.7, 0.3])\n",
            "})\n\n",
            "print(f\"Dataset shape: {df.shape}\")\n",
            "print(f\"\\nFirst 5 rows:\")\n",
            "display(df.head())"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Basic data inspection\n",
            "print(\"Dataset Info:\")\n",
            "print(df.info())\n",
            "print(\"\\nStatistical Summary:\")\n",
            "display(df.describe())\n",
            "print(\"\\nMissing Values:\")\n",
            "print(df.isnull().sum())\n",
            "print(\"\\nDuplicate Rows:\")\n",
            "print(f\"Number of duplicates: {df.duplicated().sum()}\")"
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
    
    machine_learning: {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: "markdown",
          source: [
            "# Machine Learning Template\n\n",
            "This notebook provides a complete ML workflow:\n",
            "- Data preprocessing\n",
            "- Feature engineering\n",
            "- Model training and evaluation\n",
            "- Hyperparameter tuning\n",
            "- Model interpretation\n"
          ],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Import ML libraries\n",
            "import pandas as pd\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n\n",
            "from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV\n",
            "from sklearn.preprocessing import StandardScaler, LabelEncoder\n",
            "from sklearn.ensemble import RandomForestClassifier\n",
            "from sklearn.linear_model import LogisticRegression\n",
            "from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score\n",
            "from sklearn.pipeline import Pipeline\n\n",
            "import warnings\n",
            "warnings.filterwarnings('ignore')"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Create sample dataset for ML demonstration\n",
            "np.random.seed(42)\n",
            "n_samples = 2000\n\n",
            "# Generate features\n",
            "df = pd.DataFrame({\n",
            "    'feature_1': np.random.normal(0, 1, n_samples),\n",
            "    'feature_2': np.random.normal(0, 1, n_samples),\n",
            "    'feature_3': np.random.exponential(1, n_samples),\n",
            "    'feature_4': np.random.uniform(-2, 2, n_samples),\n",
            "    'category': np.random.choice(['A', 'B', 'C'], n_samples)\n",
            "})\n\n",
            "# Create target variable with some relationship to features\n",
            "df['target'] = ((df['feature_1'] + df['feature_2'] > 0) & \n",
            "               (df['feature_3'] < 2)).astype(int)\n\n",
            "print(f\"Dataset shape: {df.shape}\")\n",
            "print(f\"Target distribution: {df['target'].value_counts()}\")\n",
            "display(df.head())"
          ],
          execution_count: null,
          outputs: [],
          metadata: {}
        },
        {
          cell_type: "code",
          source: [
            "# Exploratory Data Analysis\n",
            "fig, axes = plt.subplots(2, 3, figsize=(18, 12))\n",
            "axes = axes.ravel()\n\n",
            "# Feature distributions\n",
            "numerical_features = ['feature_1', 'feature_2', 'feature_3', 'feature_4']\n",
            "for i, feature in enumerate(numerical_features):\n",
            "    axes[i].hist(df[feature], bins=30, alpha=0.7)\n",
            "    axes[i].set_title(f'Distribution of {feature}')\n",
            "    axes[i].set_xlabel(feature)\n",
            "    axes[i].set_ylabel('Frequency')\n\n",
            "# Category distribution\n",
            "df['category'].value_counts().plot(kind='bar', ax=axes[4], title='Category Distribution')\n",
            "axes[4].set_xlabel('Category')\n",
            "axes[4].set_ylabel('Count')\n\n",
            "# Target distribution\n",
            "df['target'].value_counts().plot(kind='bar', ax=axes[5], title='Target Distribution')\n",
            "axes[5].set_xlabel('Target')\n",
            "axes[5].set_ylabel('Count')\n\n",
            "plt.tight_layout()\n",
            "plt.show()"
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
 * Helper function to handle API calls with enhanced authentication support.
 * @param bearerToken - Bearer token for authentication (optional if using env auth)
 * @param workspaceId - Workspace ID  
 * @param operation - Operation name for simulation
 * @param apiCall - Function to call the actual API
 * @param simulationParams - Parameters for simulation
 * @returns Promise resolving to API response
 */
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
  simulationParams?: any
): Promise<ApiResponse<T>> {
  let tokenToUse = bearerToken;

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
4. Alternative: Use simulation mode by setting bearerToken to "simulation"`
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

// ==================== NOTEBOOK MANAGEMENT TOOLS ====================

server.tool(
  "create-fabric-notebook",
  "Create a new Fabric notebook from template or custom definition",
  CreateNotebookFromTemplateSchema.shape,
  async ({ bearerToken, workspaceId, displayName, template, customNotebook, environmentId, lakehouseId, lakehouseName }) => {
    // Get the notebook definition from template or custom
    let notebookDefinition;
    if (template === "custom") {
      if (!customNotebook) {
        return {
          content: [{ type: "text", text: "Error: customNotebook is required when template is 'custom'" }]
        };
      }
      notebookDefinition = customNotebook;
    } else {
      notebookDefinition = getNotebookTemplate(template);
    }

    // Enhance metadata with dependencies if provided
    if (environmentId || lakehouseId) {
      if (!notebookDefinition.metadata) {
        notebookDefinition.metadata = {};
      }
      if (!notebookDefinition.metadata.dependencies) {
        notebookDefinition.metadata.dependencies = {};
      }
      
      if (environmentId) {
        notebookDefinition.metadata.dependencies.environment = {
          environmentId,
          workspaceId
        };
      }
      
      if (lakehouseId) {
        notebookDefinition.metadata.dependencies.lakehouse = {
          default_lakehouse: lakehouseId,
          default_lakehouse_name: lakehouseName || "Default Lakehouse",
          default_lakehouse_workspace_id: workspaceId
        };
      }
    }

    // Encode notebook definition as base64
    const notebookContent = JSON.stringify(notebookDefinition);
    const base64Content = Buffer.from(notebookContent).toString('base64');

    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "create-notebook",
      (client) => client.createNotebook({
        displayName,
        type: "Notebook",
        definition: {
          format: "ipynb",
          parts: [
            {
              path: "notebook-content.ipynb",
              payload: base64Content,
              payloadType: "InlineBase64"
            }
          ]
        }
      }),
      { displayName, template, notebookDefinition }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error creating notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully created notebook: "${displayName}"\nID: ${result.data?.id}\nTemplate: ${template}\nCreated: ${result.data?.createdDate}`

      }]
    };
  }
);

server.tool(
  "get-fabric-notebook-definition",
  "Get the notebook definition (cells, metadata) from an existing Fabric notebook",
  GetNotebookDefinitionSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, format }) => {
    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "get-notebook-definition",
      (client) => client.getItemDefinition(notebookId, format),
      { notebookId, format }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error getting notebook definition: ${result.error}` }]
      };
    }

    try {
      // Parse the notebook content
      let notebookContent = "";
      const responseData = result.data as any;
      if (responseData?.definition?.parts && responseData.definition.parts.length > 0) {
        const part = responseData.definition.parts[0];
        if (part.payloadType === "InlineBase64" && part.payload) {
          notebookContent = Buffer.from(part.payload, 'base64').toString('utf-8');
        } else {
          notebookContent = part.payload || "{}";
        }
      }

      const notebookDef = JSON.parse(notebookContent || "{}");
      
      return {
        content: [{
          type: "text",
          text: `Notebook Definition Retrieved:\n\nName: ${responseData?.displayName || 'Unknown'}\nFormat: ${format}\nCells: ${notebookDef.cells?.length || 0}\n\nDefinition:\n${JSON.stringify(notebookDef, null, 2)}`
        }]
      };
    } catch (parseError) {
      return {
        content: [{ type: "text", text: `Error parsing notebook definition: ${parseError}` }]
      };
    }
  }
);

server.tool(
  "update-fabric-notebook-definition",
  "Update the notebook definition (cells, metadata) of an existing Fabric notebook",
  UpdateNotebookDefinitionSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, notebookDefinition }) => {
    // Encode updated notebook definition as base64
    const notebookContent = JSON.stringify(notebookDefinition);
    const base64Content = Buffer.from(notebookContent).toString('base64');

    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "update-notebook-definition",
      (client) => client.updateItemDefinition(notebookId, {
        format: "ipynb",
        parts: [
          {
            path: "notebook-content.ipynb",
            payload: base64Content,
            payloadType: "InlineBase64"
          }
        ]
      }),
      { notebookId, notebookDefinition }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error updating notebook definition: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully updated notebook definition for notebook ID: ${notebookId}\nCells: ${notebookDefinition.cells?.length || 0}\nUpdated: ${new Date().toISOString()}`
      }]
    };
  }
);

server.tool(
  "run-fabric-notebook",
  "Execute a Fabric notebook on-demand with optional parameters and configuration",
  RunNotebookSchema.shape,
  async ({ bearerToken, workspaceId, notebookId, parameters, configuration }) => {
    const executionPayload: any = {
      notebookId
    };

    // Add parameters if provided
    if (parameters && Object.keys(parameters).length > 0) {
      executionPayload.parameters = {};
      for (const [key, param] of Object.entries(parameters)) {
        executionPayload.parameters[key] = {
          value: param.value,
          type: param.type
        };
      }
    }

    // Add configuration if provided
    if (configuration) {
      executionPayload.executionData = {};
      
      if (configuration.conf) {
        executionPayload.executionData.conf = configuration.conf;
      }
      
      if (configuration.environment) {
        executionPayload.executionData.environmentId = {
          environmentId: configuration.environment.id,
          workspaceId
        };
      }
      
      if (configuration.defaultLakehouse) {
        executionPayload.executionData.defaultLakehouseId = {
          lakehouseId: configuration.defaultLakehouse.id,
          workspaceId: configuration.defaultLakehouse.workspaceId || workspaceId
        };
      }
      
      if (configuration.useStarterPool) {
        executionPayload.executionData.useStarterPool = true;
      }
      
      if (configuration.useWorkspacePool) {
        executionPayload.executionData.useWorkspacePool = configuration.useWorkspacePool;
      }
    }

    const result = await executeApiCall(
      bearerToken,
      workspaceId,
      "run-notebook",
      (client) => client.runNotebook(notebookId, executionPayload),
      { notebookId, executionPayload }
    );

    if (result.status === 'error') {
      return {
        content: [{ type: "text", text: `Error running notebook: ${result.error}` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Successfully started notebook execution:\nNotebook ID: ${notebookId}\nJob ID: ${(result.data as any)?.id || 'N/A'}\nStatus: ${(result.data as any)?.status || 'Started'}\nStarted: ${new Date().toISOString()}`
      }]
    };
  }
);

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
