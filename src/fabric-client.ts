import { z } from "zod";

// Configuration and types
export interface FabricConfig {
  apiBaseUrl: string;
  version: string;
  userAgent: string;
  timeout: number;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  error?: string;
}

export interface JobExecutionResult {
  id: string;
  status: string;
  createdDateTime: string;
  completedDateTime?: string;
  error?: string;
}

export interface SparkJobConfig {
  driverCores: number;
  driverMemory: string;
  executorCores: number;
  executorMemory: string;
  numExecutors: number;
}

export interface LivySessionConfig {
  kind?: 'spark' | 'pyspark' | 'sparkr' | 'sql';
  driverMemory?: string;
  driverCores?: number;
  executorMemory?: string;
  executorCores?: number;
  numExecutors?: number;
  archives?: string[];
  queue?: string;
  name?: string;
  conf?: Record<string, string>;
}

export interface LivyStatementConfig {
  code: string;
  kind?: 'spark' | 'pyspark' | 'sparkr' | 'sql';
}

export interface LivySessionResult {
  id: number;
  name?: string;
  appId?: string;
  owner?: string;
  proxyUser?: string;
  state: 'not_started' | 'starting' | 'idle' | 'busy' | 'shutting_down' | 'error' | 'dead' | 'killed' | 'success';
  kind: string;
  appInfo?: Record<string, any>;
  log?: string[];
}

export interface LivyStatementResult {
  id: number;
  code: string;
  state: 'waiting' | 'running' | 'available' | 'error' | 'cancelling' | 'cancelled';
  output?: {
    status: 'ok' | 'error';
    execution_count: number;
    data?: Record<string, any>;
    ename?: string;
    evalue?: string;
    traceback?: string[];
  };
  progress?: number;
  started?: string;
  completed?: string;
}

// Spark Monitoring interfaces
export interface SparkApplicationInfo {
  sparkApplicationId: string;
  state: string;
  livyId: string;
  origin: string;
  attemptNumber: number;
  maxNumberOfAttempts: number;
  livyName: string;
  submitter: {
    id: string;
    type: string;
  };
  item: {
    workspaceId: string;
    itemId: string;
    referenceType: string;
  };
  itemName: string;
  itemType: string;
  jobType: string;
  submittedDateTime: string;
  startDateTime?: string;
  endDateTime?: string;
  queuedDuration?: {
    value: number;
    timeUnit: string;
  };
  runningDuration?: {
    value: number;
    timeUnit: string;
  };
  totalDuration?: {
    value: number;
    timeUnit: string;
  };
  jobInstanceId: string;
  creatorItem: {
    workspaceId: string;
    itemId: string;
    referenceType: string;
  };
  cancellationReason?: string;
  capacityId: string;
  operationName: string;
  runtimeVersion: string;
  livySessionItemResourceUri: string;
}

export interface SparkApplicationsResponse {
  continuationToken?: string;
  continuationUri?: string;
  value: SparkApplicationInfo[];
}

// Default configuration
export const DEFAULT_CONFIG: FabricConfig = {
  apiBaseUrl: "https://api.fabric.microsoft.com/v1",
  version: "1.0.0",
  userAgent: "Fabric-Analytics-MCP-Server/1.0.0",
  timeout: 30000
};

/**
 * API Client for Microsoft Fabric Analytics operations.
 * Provides methods for CRUD operations on Fabric items and job execution.
 */
export class FabricApiClient {
  constructor(
    private bearerToken: string,
    private workspaceId: string,
    private config: FabricConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Make an HTTP request to the Fabric API.
   * @param endpoint - API endpoint (relative to workspace)
   * @param options - Request options
   * @returns Promise resolving to API response
   */
  async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      queryParams?: Record<string, any>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = "GET", body, headers = {}, queryParams } = options;
    const url = new URL(`${this.config.apiBaseUrl}/workspaces/${this.workspaceId}/${endpoint}`);

    if (queryParams) {
      Object.keys(queryParams).forEach(key => url.searchParams.append(key, String(queryParams[key])));
    }

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

      const response = await fetch(url.toString(), {
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

  /**
   * List items in the workspace.
   * @param itemType - Optional filter by item type
   * @returns Promise resolving to list of items
   */
  async listItems(itemType?: string): Promise<ApiResponse> {
    const endpoint = itemType ? `items?type=${itemType}` : "items";
    return this.makeRequest(endpoint);
  }

  /**
   * Create a new item in the workspace.
   * @param itemType - Type of item to create
   * @param displayName - Display name for the item
   * @param description - Optional description
   * @returns Promise resolving to created item
   */
  async createItem(itemType: string, displayName: string, description?: string): Promise<ApiResponse> {
    const body = {
      displayName,
      type: itemType,
      ...(description && { description })
    };
    return this.makeRequest("items", { method: "POST", body });
  }

  /**
   * Get details of a specific item.
   * @param itemId - ID of the item to retrieve
   * @returns Promise resolving to item details
   */
  async getItem(itemId: string): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}`);
  }

  /**
   * Update an existing item.
   * @param itemId - ID of the item to update
   * @param updates - Updates to apply
   * @returns Promise resolving to updated item
   */
  async updateItem(itemId: string, updates: { displayName?: string; description?: string }): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}`, { method: "PATCH", body: updates });
  }

  /**
   * Delete an item from the workspace.
   * @param itemId - ID of the item to delete
   * @returns Promise resolving to deletion confirmation
   */
  async deleteItem(itemId: string): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}`, { method: "DELETE" });
  }

  /**
   * Execute a notebook with optional parameters.
   * @param notebookId - ID of the notebook to execute
   * @param parameters - Optional parameters to pass to the notebook
   * @returns Promise resolving to job execution result
   */
  async executeNotebook(notebookId: string, parameters?: Record<string, any>): Promise<ApiResponse<JobExecutionResult>> {
    const body = parameters ? { parameters } : {};
    return this.makeRequest(`items/${notebookId}/jobs/instances`, { method: "POST", body });
  }

  /**
   * Submit a Spark job to run on a Lakehouse.
   * @param lakehouseId - ID of the lakehouse for Spark context
   * @param code - Spark code to execute
   * @param language - Programming language (python, scala, sql)
   * @param config - Optional Spark cluster configuration
   * @returns Promise resolving to job execution result
   */
  async submitSparkJob(lakehouseId: string, code: string, language: string = "python", config?: SparkJobConfig): Promise<ApiResponse<JobExecutionResult>> {
    const body = {
      code,
      language,
      lakehouseId,
      ...(config && { clusterConfig: config })
    };
    return this.makeRequest(`items/${lakehouseId}/jobs/spark`, { method: "POST", body });
  }

  /**
   * Get the status of a running job.
   * @param jobId - ID of the job to check
   * @returns Promise resolving to job status
   */
  async getJobStatus(jobId: string): Promise<ApiResponse<JobExecutionResult>> {
    return this.makeRequest(`jobs/${jobId}`);
  }

  /**
   * Create a Spark job instance from a Spark Job Definition.
   * @param sparkJobDefinitionId - ID of the Spark Job Definition
   * @param jobType - Type of job (default: "sparkjob")
   * @returns Promise resolving to job instance creation result
   */
  async createSparkJobInstance(sparkJobDefinitionId: string, jobType: string = "sparkjob"): Promise<ApiResponse> {
    const url = `sparkJobDefinitions/${sparkJobDefinitionId}/jobs/instances`;
    return this.makeRequest(url, { 
      method: "POST",
      queryParams: { jobType }
    });
  }

  /**
   * Execute a Spark Job Definition with execution data.
   * @param sparkJobDefinitionId - ID of the Spark Job Definition
   * @param jobType - Type of job (default: "sparkjob")
   * @param executionData - Execution data for the job
   * @returns Promise resolving to job execution result
   */
  async executeSparkJobDefinition(
    sparkJobDefinitionId: string, 
    jobType: string = "sparkjob", 
    executionData?: any
  ): Promise<ApiResponse> {
    const url = `sparkJobDefinitions/${sparkJobDefinitionId}/jobs/instances`;
    return this.makeRequest(url, {
      method: "POST",
      queryParams: { jobType },
      body: executionData
    });
  }

  /**
   * Get the status of a Spark job instance.
   * @param sparkJobDefinitionId - ID of the Spark Job Definition
   * @param jobInstanceId - ID of the job instance
   * @returns Promise resolving to job instance status
   */
  async getSparkJobInstanceStatus(sparkJobDefinitionId: string, jobInstanceId: string): Promise<ApiResponse> {
    const url = `items/${sparkJobDefinitionId}/jobs/instances/${jobInstanceId}`;
    return this.makeRequest(url);
  }

  /**
   * Create a new Livy session for interactive Spark execution.
   * @param lakehouseId - ID of the lakehouse
   * @param config - Session configuration options
   * @returns Promise resolving to session creation result
   */
  async createLivySession(lakehouseId: string, config?: LivySessionConfig): Promise<ApiResponse<LivySessionResult>> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions`;
    return this.makeRequest(url, {
      method: "POST",
      body: config || {}
    });
  }

  /**
   * Get the status of a Livy session.
   * @param lakehouseId - ID of the lakehouse
   * @param sessionId - ID of the Livy session
   * @returns Promise resolving to session status
   */
  async getLivySession(lakehouseId: string, sessionId: number): Promise<ApiResponse<LivySessionResult>> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}`;
    return this.makeRequest(url);
  }

  /**
   * List all Livy sessions for a lakehouse.
   * @param lakehouseId - ID of the lakehouse
   * @returns Promise resolving to list of sessions
   */
  async listLivySessions(lakehouseId: string): Promise<ApiResponse<{ sessions: LivySessionResult[] }>> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions`;
    return this.makeRequest(url);
  }

  /**
   * Delete a Livy session.
   * @param lakehouseId - ID of the lakehouse
   * @param sessionId - ID of the Livy session to delete
   * @returns Promise resolving to deletion result
   */
  async deleteLivySession(lakehouseId: string, sessionId: number): Promise<ApiResponse> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}`;
    return this.makeRequest(url, { method: "DELETE" });
  }

  /**
   * Execute a statement in a Livy session.
   * @param lakehouseId - ID of the lakehouse
   * @param sessionId - ID of the Livy session
   * @param statement - Statement configuration
   * @returns Promise resolving to statement execution result
   */
  async executeLivyStatement(
    lakehouseId: string, 
    sessionId: number, 
    statement: LivyStatementConfig
  ): Promise<ApiResponse<LivyStatementResult>> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}/statements`;
    return this.makeRequest(url, {
      method: "POST",
      body: statement
    });
  }

  /**
   * Get the result of a statement execution.
   * @param lakehouseId - ID of the lakehouse
   * @param sessionId - ID of the Livy session
   * @param statementId - ID of the statement
   * @returns Promise resolving to statement result
   */
  async getLivyStatement(
    lakehouseId: string, 
    sessionId: number, 
    statementId: number
  ): Promise<ApiResponse<LivyStatementResult>> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}/statements/${statementId}`;
    return this.makeRequest(url);
  }

  /**
   * List all statements in a Livy session.
   * @param lakehouseId - ID of the lakehouse
   * @param sessionId - ID of the Livy session
   * @returns Promise resolving to list of statements
   */
  async listLivyStatements(lakehouseId: string, sessionId: number): Promise<ApiResponse<{ statements: LivyStatementResult[] }>> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}/statements`;
    return this.makeRequest(url);
  }

  /**
   * Create a Livy batch job.
   * @param lakehouseId - ID of the lakehouse
   * @param config - Batch job configuration
   * @returns Promise resolving to batch creation result
   */
  async createLivyBatch(lakehouseId: string, config: any): Promise<ApiResponse> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches`;
    return this.makeRequest(url, {
      method: "POST",
      body: config
    });
  }

  /**
   * Get the status of a Livy batch job.
   * @param lakehouseId - ID of the lakehouse
   * @param batchId - ID of the batch job
   * @returns Promise resolving to batch status
   */
  async getLivyBatch(lakehouseId: string, batchId: number): Promise<ApiResponse> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches/${batchId}`;
    return this.makeRequest(url);
  }

  /**
   * List all Livy batch jobs for a lakehouse.
   * @param lakehouseId - ID of the lakehouse
   * @returns Promise resolving to list of batch jobs
   */
  async listLivyBatches(lakehouseId: string): Promise<ApiResponse> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches`;
    return this.makeRequest(url);
  }

  /**
   * Delete a Livy batch job.
   * @param lakehouseId - ID of the lakehouse
   * @param batchId - ID of the batch job to delete
   * @returns Promise resolving to deletion result
   */
  async deleteLivyBatch(lakehouseId: string, batchId: number): Promise<ApiResponse> {
    const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches/${batchId}`;
    return this.makeRequest(url, { method: "DELETE" });
  }

  // ==================== SPARK MONITORING METHODS ====================

  /**
   * Get all Spark applications/Livy sessions in a workspace.
   * @param continuationToken - Optional continuation token for pagination
   * @returns Promise resolving to list of Spark applications
   */
  async getWorkspaceSparkApplications(continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>> {
    let url = `spark/livySessions`;
    if (continuationToken) {
      url += `?continuationToken=${encodeURIComponent(continuationToken)}`;
    }
    return this.makeRequest(url);
  }

  /**
   * Get all Spark applications/Livy sessions for a specific notebook.
   * @param notebookId - ID of the notebook
   * @param continuationToken - Optional continuation token for pagination
   * @returns Promise resolving to list of Spark applications for the notebook
   */
  async getNotebookSparkApplications(notebookId: string, continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>> {
    let url = `notebooks/${notebookId}/livySessions`;
    if (continuationToken) {
      url += `?continuationToken=${encodeURIComponent(continuationToken)}`;
    }
    return this.makeRequest(url);
  }

  /**
   * Get all Spark applications/Livy sessions for a specific Spark job definition.
   * @param sparkJobDefinitionId - ID of the Spark job definition
   * @param continuationToken - Optional continuation token for pagination
   * @returns Promise resolving to list of Spark applications for the job definition
   */
  async getSparkJobDefinitionApplications(sparkJobDefinitionId: string, continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>> {
    let url = `sparkJobDefinitions/${sparkJobDefinitionId}/livySessions`;
    if (continuationToken) {
      url += `?continuationToken=${encodeURIComponent(continuationToken)}`;
    }
    return this.makeRequest(url);
  }

  /**
   * Get all Spark applications/Livy sessions for a specific lakehouse.
   * @param lakehouseId - ID of the lakehouse
   * @param continuationToken - Optional continuation token for pagination
   * @returns Promise resolving to list of Spark applications for the lakehouse
   */
  async getLakehouseSparkApplications(lakehouseId: string, continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>> {
    let url = `lakehouses/${lakehouseId}/livySessions`;
    if (continuationToken) {
      url += `?continuationToken=${encodeURIComponent(continuationToken)}`;
    }
    return this.makeRequest(url);
  }

  /**
   * Get detailed information about a specific Spark application.
   * @param livyId - ID of the Livy session/application
   * @returns Promise resolving to detailed application information
   */
  async getSparkApplicationDetails(livyId: string): Promise<ApiResponse<SparkApplicationInfo>> {
    const url = `spark/livySessions/${livyId}`;
    return this.makeRequest(url);
  }

  /**
   * Cancel a running Spark application.
   * @param livyId - ID of the Livy session/application to cancel
   * @returns Promise resolving to cancellation result
   */
  async cancelSparkApplication(livyId: string): Promise<ApiResponse> {
    const url = `spark/livySessions/${livyId}/cancel`;
    return this.makeRequest(url, { method: "POST" });
  }

  /**
   * Get comprehensive Spark monitoring dashboard for workspace.
   * @param includeCompleted - Whether to include completed jobs (default: true)
   * @param maxResults - Maximum number of results to return (default: 100)
   * @returns Promise resolving to monitoring dashboard data
   */
  async getSparkMonitoringDashboard(includeCompleted: boolean = true, maxResults: number = 100): Promise<ApiResponse> {
    const applications = await this.getWorkspaceSparkApplications();
    
    if (applications.status === 'error') {
      return applications;
    }

    const apps = applications.data?.value || [];
    
    // Filter and organize the data
    const dashboard = {
      summary: {
        total: apps.length,
        running: apps.filter(app => app.state === 'Running').length,
        completed: apps.filter(app => app.state === 'Succeeded').length,
        failed: apps.filter(app => ['Failed', 'Cancelled', 'Error'].includes(app.state)).length,
        pending: apps.filter(app => ['Waiting', 'Starting', 'Pending'].includes(app.state)).length
      },
      applications: includeCompleted ? apps.slice(0, maxResults) : apps.filter(app => !['Succeeded', 'Failed', 'Cancelled'].includes(app.state)).slice(0, maxResults),
      byItemType: apps.reduce((acc, app) => {
        acc[app.itemType] = (acc[app.itemType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byState: apps.reduce((acc, app) => {
        acc[app.state] = (acc[app.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentActivity: apps
        .sort((a, b) => new Date(b.submittedDateTime).getTime() - new Date(a.submittedDateTime).getTime())
        .slice(0, 10)
    };

    return {
      status: 'success',
      data: dashboard
    };
  }

  // ==================== NOTEBOOK MANAGEMENT METHODS ====================

  /**
   * Create a notebook with definition
   * @param payload - Notebook creation payload with definition
   * @returns Promise resolving to creation result
   */
  async createNotebook(payload: {
    displayName: string;
    type: string;
    definition?: {
      format: string;
      parts: Array<{
        path: string;
        payload: string;
        payloadType: string;
      }>;
    };
  }): Promise<ApiResponse> {
    return this.makeRequest("items", { method: "POST", body: payload });
  }

  /**
   * Get the definition of a notebook item
   * @param itemId - ID of the notebook item
   * @param format - Format to return (ipynb or fabricGitSource)
   * @returns Promise resolving to notebook definition
   */
  async getItemDefinition(itemId: string, format: string = "ipynb"): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}/getDefinition?format=${format}`, { method: "POST" });
  }

  /**
   * Update the definition of a notebook item
   * @param itemId - ID of the notebook item
   * @param definition - Updated notebook definition
   * @returns Promise resolving to update result
   */
  async updateItemDefinition(itemId: string, definition: {
    format: string;
    parts: Array<{
      path: string;
      payload: string;
      payloadType: string;
    }>;
  }): Promise<ApiResponse> {
    return this.makeRequest(`items/${itemId}/updateDefinition`, { 
      method: "POST", 
      body: { definition } 
    });
  }

  /**
   * Execute a notebook with parameters and configuration
   * @param notebookId - ID of the notebook to run
   * @param payload - Execution configuration
   * @returns Promise resolving to execution result
   */
  async runNotebook(notebookId: string, payload: any): Promise<ApiResponse> {
    return this.makeRequest(`items/${notebookId}/jobs/instances?jobType=RunNotebook`, { 
      method: "POST", 
      body: payload 
    });
  }
}
