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

// ==================== WORKSPACE INTERFACES ====================
export interface WorkspaceInfo {
  id: string;
  name: string;
  description?: string;
  type: 'Personal' | 'Workspace';
  state: 'Active' | 'Deleted' | 'Removing';
  capacityId?: string;
  capacityMigrationStatus?: string;
  defaultDatasetStorageFormat?: string;
  isReadOnly?: boolean;
  isOnDedicatedCapacity?: boolean;
}

export interface WorkspaceUser {
  identifier: string;
  displayName?: string;
  emailAddress?: string;
  groupUserAccessRight: 'None' | 'Viewer' | 'Contributor' | 'Member' | 'Admin';
  principalType: 'User' | 'Group' | 'ServicePrincipal';
}

export interface WorkspaceRoleAssignment {
  principal: {
    id: string;
    type: 'User' | 'Group' | 'ServicePrincipal';
    displayName?: string;
  };
  role: 'Admin' | 'Member' | 'Contributor' | 'Viewer';
}

// ==================== ONELAKE INTERFACES ====================
export interface OneLakeItem {
  id: string;
  name: string;
  type: 'Lakehouse' | 'Warehouse' | 'KQLDatabase' | 'Notebook' | 'Report' | 'Dataset' | 'Dashboard' | 'Dataflow' | 'Datamart';
  workspaceId: string;
  description?: string;
  properties?: Record<string, any>;
  createdDate?: string;
  modifiedDate?: string;
  createdBy?: string;
  modifiedBy?: string;
}

export interface OneLakeFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  contentType?: string;
  isDirectory: boolean;
  etag?: string;
}

export interface OneLakeDirectory {
  name: string;
  path: string;
  lastModified: string;
  items?: OneLakeFile[];
}

// ==================== POWER BI INTERFACES ====================
export interface PowerBIDataset {
  id: string;
  name: string;
  webUrl: string;
  addRowsAPIEnabled?: boolean;
  configuredBy?: string;
  isRefreshable?: boolean;
  isEffectiveIdentityRequired?: boolean;
  isEffectiveIdentityRolesRequired?: boolean;
  isOnPremGatewayRequired?: boolean;
  targetStorageMode?: string;
  createdDate?: string;
  contentProviderType?: string;
  createReportEmbedURL?: string;
  qnaEmbedURL?: string;
  upstreamDatasets?: any[];
  users?: any[];
  endorsementDetails?: any;
}

export interface PowerBIReport {
  id: string;
  name: string;
  webUrl: string;
  embedUrl: string;
  isFromPbix?: boolean;
  isOwnedByMe?: boolean;
  datasetId?: string;
  datasetWorkspaceId?: string;
  createdDateTime?: string;
  modifiedDateTime?: string;
  createdBy?: string;
  modifiedBy?: string;
  reportType?: string;
  users?: any[];
  subscriptions?: any[];
}

export interface PowerBIDashboard {
  id: string;
  displayName: string;
  embedUrl: string;
  isReadOnly?: boolean;
  webUrl: string;
  tiles?: PowerBIDashboardTile[];
  users?: any[];
  subscriptions?: any[];
}

export interface PowerBIDashboardTile {
  id: string;
  title: string;
  embedUrl: string;
  rowSpan: number;
  colSpan: number;
  reportId?: string;
  datasetId?: string;
}

// ==================== DATA WAREHOUSE INTERFACES ====================
export interface DataWarehouse {
  id: string;
  displayName: string;
  description?: string;
  type: 'Warehouse';
  workspaceId: string;
  properties?: {
    connectionString?: string;
    serverName?: string;
    databaseName?: string;
  };
  createdDate?: string;
  modifiedDate?: string;
}

export interface WarehouseTable {
  name: string;
  schema: string;
  type: 'TABLE' | 'VIEW' | 'EXTERNAL_TABLE';
  columns?: WarehouseColumn[];
  rowCount?: number;
  dataLength?: number;
  indexLength?: number;
}

export interface WarehouseColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  defaultValue?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface WarehouseQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime?: number;
  query?: string;
}

// ==================== ADDITIONAL FABRIC INTERFACES ====================

// Enhanced Item Management
export interface FabricItem {
  id: string;
  displayName: string;
  type: 'Lakehouse' | 'Warehouse' | 'KQLDatabase' | 'Notebook' | 'Report' | 'Dataset' | 'Dashboard' | 'Dataflow' | 'Datamart' | 'Environment' | 'SparkJobDefinition' | 'DataPipeline' | 'MLModel' | 'MLExperiment';
  workspaceId: string;
  description?: string;
  properties?: Record<string, unknown>;
  createdDate?: string;
  modifiedDate?: string;
  createdBy?: string;
  modifiedBy?: string;
}

export interface ItemDefinition {
  format: string;
  parts: Array<{
    path: string;
    payload: string;
    payloadType: 'InlineBase64' | 'InlineUtf8';
  }>;
}

// Enhanced Workspace Management
export interface WorkspaceDetails extends WorkspaceInfo {
  capacityAssignmentProgress?: string;
  defaultDatasetStorageFormat?: 'Small' | 'Large';
  identityType?: 'User' | 'ServicePrincipal';
}

export interface WorkspaceCapacityAssignment {
  capacityId: string;
  capacityObjectId?: string;
  capacityAssignmentProgress?: 'Completed' | 'InProgress' | 'Failed';
}

// Capacity Management
export interface FabricCapacity {
  id: string;
  displayName: string;
  admins: string[];
  sku: string;
  state: 'Active' | 'Paused' | 'Suspended' | 'Deleted';
  capacityUserAccessRight?: 'Admin' | 'Assign';
  region?: string;
  tenantKeyId?: string;
}

export interface CapacityWorkload {
  name: string;
  state: 'Enabled' | 'Disabled' | 'Unsupported';
  maxMemoryPercentageSetByUser?: number;
}

// Data Pipeline
export interface DataPipeline {
  id: string;
  displayName: string;
  description?: string;
  type: 'DataPipeline';
  workspaceId: string;
  objectId?: string;
  properties?: {
    description?: string;
  };
}

export interface PipelineRunResult {
  runId: string;
  status: 'InProgress' | 'Succeeded' | 'Failed' | 'Cancelled';
  runStart?: string;
  runEnd?: string;
  durationInMs?: number;
  message?: string;
  error?: any;
}

// Enhanced Power BI interfaces
export interface PowerBIDataflow {
  id: string;
  name: string;
  description?: string;
  modelUrl?: string;
  configuredBy?: string;
  modifiedBy?: string;
  modifiedDateTime?: string;
  users?: any[];
  datasourceUsages?: any[];
}

export interface PowerBIDatamart {
  id: string;
  name: string;
  description?: string;
  type: 'Datamart';
  configuredBy?: string;
  modifiedBy?: string;
  modifiedDateTime?: string;
  datasourceUsages?: any[];
  upstreamDatamarts?: any[];
  users?: any[];
}

// Environment
export interface FabricEnvironment {
  id: string;
  displayName: string;
  description?: string;
  type: 'Environment';
  workspaceId: string;
  properties?: {
    description?: string;
    runtimeVersion?: string;
    computeUnits?: number;
    driverCores?: number;
    driverMemory?: string;
    executorCores?: number;
    executorMemory?: string;
    maxExecutors?: number;
  };
}

export interface EnvironmentLibrary {
  name: string;
  version?: string;
  type: 'PyPI' | 'Conda' | 'Custom';
}

// ==================== EXISTING INTERFACES ====================
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
    private _bearerToken: string,
    private _workspaceId: string,
    private _config: FabricConfig = DEFAULT_CONFIG
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
    const url = new URL(`${this._config.apiBaseUrl}/workspaces/${this._workspaceId}/${endpoint}`);

    if (queryParams) {
      Object.keys(queryParams).forEach(key => url.searchParams.append(key, String(queryParams[key])));
    }

    const requestHeaders: Record<string, string> = {
      "Authorization": `Bearer ${this._bearerToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": this._config.userAgent,
      ...headers
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this._config.timeout);

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

  // ==================== WORKSPACE MANAGEMENT METHODS ====================

  /**
   * List all workspaces accessible to the user
   * @param filter - Optional filter for workspace properties
   * @param top - Number of workspaces to return (default: 100)
   * @returns Promise resolving to list of workspaces
   */
  async listWorkspaces(filter?: string, top: number = 100): Promise<ApiResponse<{ value: WorkspaceInfo[] }>> {
    const params = new URLSearchParams();
    if (filter) params.append('$filter', filter);
    params.append('$top', top.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `workspaces?${queryString}` : 'workspaces';
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get detailed information about a specific workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to workspace details
   */
  async getWorkspace(workspaceId: string): Promise<ApiResponse<WorkspaceInfo>> {
    return this.makeRequest(`workspaces/${workspaceId}`);
  }

  /**
   * Create a new workspace
   * @param name - Name of the workspace
   * @param description - Optional description
   * @returns Promise resolving to created workspace
   */
  async createWorkspace(name: string, description?: string): Promise<ApiResponse<WorkspaceInfo>> {
    const payload: any = { displayName: name };
    if (description) payload.description = description;
    
    return this.makeRequest('workspaces', {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Update workspace properties
   * @param workspaceId - ID of the workspace
   * @param updates - Properties to update
   * @returns Promise resolving to update result
   */
  async updateWorkspace(workspaceId: string, updates: { displayName?: string; description?: string }): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: updates
    });
  }

  /**
   * Delete a workspace
   * @param workspaceId - ID of the workspace to delete
   * @returns Promise resolving to deletion result
   */
  async deleteWorkspace(workspaceId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}`, { method: 'DELETE' });
  }

  /**
   * List users and their roles in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to workspace users
   */
  async getWorkspaceUsers(workspaceId: string): Promise<ApiResponse<{ value: WorkspaceUser[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/users`);
  }

  /**
   * Add a user to workspace with specific role
   * @param workspaceId - ID of the workspace
   * @param userEmail - Email of the user to add
   * @param role - Role to assign to the user
   * @returns Promise resolving to addition result
   */
  async addWorkspaceUser(workspaceId: string, userEmail: string, role: 'Admin' | 'Member' | 'Contributor' | 'Viewer'): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/users`, {
      method: 'POST',
      body: {
        identifier: userEmail,
        groupUserAccessRight: role,
        principalType: 'User'
      }
    });
  }

  /**
   * Update user role in workspace
   * @param workspaceId - ID of the workspace
   * @param userEmail - Email of the user
   * @param role - New role for the user
   * @returns Promise resolving to update result
   */
  async updateWorkspaceUserRole(workspaceId: string, userEmail: string, role: 'Admin' | 'Member' | 'Contributor' | 'Viewer'): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/users/${userEmail}`, {
      method: 'PUT',
      body: {
        groupUserAccessRight: role
      }
    });
  }

  /**
   * Remove user from workspace
   * @param workspaceId - ID of the workspace
   * @param userEmail - Email of the user to remove
   * @returns Promise resolving to removal result
   */
  async removeWorkspaceUser(workspaceId: string, userEmail: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/users/${userEmail}`, { method: 'DELETE' });
  }

  // ==================== ONELAKE METHODS ====================

  /**
   * List all items in OneLake across workspaces
   * @param workspaceId - Optional workspace ID to filter items
   * @param itemType - Optional item type filter
   * @returns Promise resolving to OneLake items
   */
  async listOneLakeItems(workspaceId?: string, itemType?: string): Promise<ApiResponse<{ value: OneLakeItem[] }>> {
    if (workspaceId) {
      const params = new URLSearchParams();
      if (itemType) params.append('$filter', `type eq '${itemType}'`);
      const queryString = params.toString();
      const endpoint = queryString ? `workspaces/${workspaceId}/items?${queryString}` : `workspaces/${workspaceId}/items`;
      return this.makeRequest(endpoint);
    } else {
      // List items across all workspaces
      return this.makeRequest('items');
    }
  }

  /**
   * Get OneLake file system paths for a lakehouse
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @param path - Optional path within the lakehouse (default: root)
   * @returns Promise resolving to file system structure
   */
  async getOneLakeFileSystem(workspaceId: string, lakehouseId: string, path: string = '/'): Promise<ApiResponse<OneLakeDirectory>> {
    const encodedPath = encodeURIComponent(path);
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/filesystem/${encodedPath}`);
  }

  /**
   * Upload file to OneLake
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @param filePath - Path where to upload the file
   * @param fileContent - Content of the file (base64 encoded)
   * @returns Promise resolving to upload result
   */
  async uploadToOneLake(workspaceId: string, lakehouseId: string, filePath: string, fileContent: string): Promise<ApiResponse> {
    const encodedPath = encodeURIComponent(filePath);
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/filesystem/${encodedPath}`, {
      method: 'PUT',
      body: fileContent,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
  }

  /**
   * Download file from OneLake
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @param filePath - Path of the file to download
   * @returns Promise resolving to file content
   */
  async downloadFromOneLake(workspaceId: string, lakehouseId: string, filePath: string): Promise<ApiResponse<string>> {
    const encodedPath = encodeURIComponent(filePath);
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/filesystem/${encodedPath}`);
  }

  /**
   * Delete file or directory from OneLake
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @param path - Path of the file/directory to delete
   * @returns Promise resolving to deletion result
   */
  async deleteFromOneLake(workspaceId: string, lakehouseId: string, path: string): Promise<ApiResponse> {
    const encodedPath = encodeURIComponent(path);
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/filesystem/${encodedPath}`, {
      method: 'DELETE'
    });
  }

  /**
   * Create directory in OneLake
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @param directoryPath - Path of the directory to create
   * @returns Promise resolving to creation result
   */
  async createOneLakeDirectory(workspaceId: string, lakehouseId: string, directoryPath: string): Promise<ApiResponse> {
    const encodedPath = encodeURIComponent(directoryPath);
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/filesystem/${encodedPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { resource: 'directory' }
    });
  }

  // ==================== POWER BI METHODS ====================

  /**
   * List Power BI datasets in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to datasets
   */
  async listPowerBIDatasets(workspaceId: string): Promise<ApiResponse<{ value: PowerBIDataset[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/datasets`);
  }

  /**
   * Get specific Power BI dataset
   * @param workspaceId - ID of the workspace
   * @param datasetId - ID of the dataset
   * @returns Promise resolving to dataset details
   */
  async getPowerBIDataset(workspaceId: string, datasetId: string): Promise<ApiResponse<PowerBIDataset>> {
    return this.makeRequest(`workspaces/${workspaceId}/datasets/${datasetId}`);
  }

  /**
   * Refresh a Power BI dataset
   * @param workspaceId - ID of the workspace
   * @param datasetId - ID of the dataset
   * @param notifyOption - Notification option for refresh completion
   * @returns Promise resolving to refresh result
   */
  async refreshPowerBIDataset(workspaceId: string, datasetId: string, notifyOption?: 'MailOnCompletion' | 'MailOnFailure' | 'NoNotification'): Promise<ApiResponse> {
    const body: any = {};
    if (notifyOption) body.notifyOption = notifyOption;
    
    return this.makeRequest(`workspaces/${workspaceId}/datasets/${datasetId}/refreshes`, {
      method: 'POST',
      body
    });
  }

  /**
   * Get refresh history for a dataset
   * @param workspaceId - ID of the workspace
   * @param datasetId - ID of the dataset
   * @param top - Number of refresh records to return
   * @returns Promise resolving to refresh history
   */
  async getPowerBIDatasetRefreshHistory(workspaceId: string, datasetId: string, top: number = 10): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/datasets/${datasetId}/refreshes?$top=${top}`);
  }

  /**
   * List Power BI reports in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to reports
   */
  async listPowerBIReports(workspaceId: string): Promise<ApiResponse<{ value: PowerBIReport[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/reports`);
  }

  /**
   * Get specific Power BI report
   * @param workspaceId - ID of the workspace
   * @param reportId - ID of the report
   * @returns Promise resolving to report details
   */
  async getPowerBIReport(workspaceId: string, reportId: string): Promise<ApiResponse<PowerBIReport>> {
    return this.makeRequest(`workspaces/${workspaceId}/reports/${reportId}`);
  }

  /**
   * Clone a Power BI report
   * @param workspaceId - ID of the source workspace
   * @param reportId - ID of the report to clone
   * @param name - Name for the cloned report
   * @param targetWorkspaceId - Optional target workspace ID
   * @returns Promise resolving to cloned report
   */
  async clonePowerBIReport(workspaceId: string, reportId: string, name: string, targetWorkspaceId?: string): Promise<ApiResponse<PowerBIReport>> {
    const body: any = { name };
    if (targetWorkspaceId) body.targetWorkspaceId = targetWorkspaceId;
    
    return this.makeRequest(`workspaces/${workspaceId}/reports/${reportId}/Clone`, {
      method: 'POST',
      body
    });
  }

  /**
   * Export Power BI report to file
   * @param workspaceId - ID of the workspace
   * @param reportId - ID of the report
   * @param format - Export format (PDF, PNG, PPTX, etc.)
   * @param pages - Optional specific pages to export
   * @returns Promise resolving to export result
   */
  async exportPowerBIReport(workspaceId: string, reportId: string, format: 'PDF' | 'PNG' | 'PPTX' | 'XLSX', pages?: string[]): Promise<ApiResponse> {
    const body: any = { format };
    if (pages && pages.length > 0) {
      body.powerBIReportConfiguration = {
        pages: pages.map(page => ({ pageName: page }))
      };
    }
    
    return this.makeRequest(`workspaces/${workspaceId}/reports/${reportId}/ExportTo`, {
      method: 'POST',
      body
    });
  }

  /**
   * List Power BI dashboards in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to dashboards
   */
  async listPowerBIDashboards(workspaceId: string): Promise<ApiResponse<{ value: PowerBIDashboard[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/dashboards`);
  }

  /**
   * Get specific Power BI dashboard
   * @param workspaceId - ID of the workspace
   * @param dashboardId - ID of the dashboard
   * @returns Promise resolving to dashboard details
   */
  async getPowerBIDashboard(workspaceId: string, dashboardId: string): Promise<ApiResponse<PowerBIDashboard>> {
    return this.makeRequest(`workspaces/${workspaceId}/dashboards/${dashboardId}`);
  }

  /**
   * Get tiles from a Power BI dashboard
   * @param workspaceId - ID of the workspace
   * @param dashboardId - ID of the dashboard
   * @returns Promise resolving to dashboard tiles
   */
  async getPowerBIDashboardTiles(workspaceId: string, dashboardId: string): Promise<ApiResponse<{ value: PowerBIDashboardTile[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/dashboards/${dashboardId}/tiles`);
  }

  // ==================== DATA WAREHOUSE METHODS ====================

  /**
   * List data warehouses in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to data warehouses
   */
  async listDataWarehouses(workspaceId: string): Promise<ApiResponse<{ value: DataWarehouse[] }>> {
    const params = new URLSearchParams();
    params.append('$filter', "type eq 'Warehouse'");
    return this.makeRequest(`workspaces/${workspaceId}/items?${params.toString()}`);
  }

  /**
   * Get specific data warehouse
   * @param workspaceId - ID of the workspace
   * @param warehouseId - ID of the warehouse
   * @returns Promise resolving to warehouse details
   */
  async getDataWarehouse(workspaceId: string, warehouseId: string): Promise<ApiResponse<DataWarehouse>> {
    return this.makeRequest(`workspaces/${workspaceId}/warehouses/${warehouseId}`);
  }

  /**
   * Create a new data warehouse
   * @param workspaceId - ID of the workspace
   * @param displayName - Name of the warehouse
   * @param description - Optional description
   * @returns Promise resolving to created warehouse
   */
  async createDataWarehouse(workspaceId: string, displayName: string, description?: string): Promise<ApiResponse<DataWarehouse>> {
    const payload: any = {
      displayName,
      type: 'Warehouse'
    };
    if (description) payload.description = description;
    
    return this.makeRequest(`workspaces/${workspaceId}/items`, {
      method: 'POST',
      body: payload
    });
  }

  /**
   * List tables in a data warehouse
   * @param workspaceId - ID of the workspace
   * @param warehouseId - ID of the warehouse
   * @param schema - Optional schema filter
   * @returns Promise resolving to warehouse tables
   */
  async listWarehouseTables(workspaceId: string, warehouseId: string, schema?: string): Promise<ApiResponse<{ value: WarehouseTable[] }>> {
    const endpoint = schema 
      ? `workspaces/${workspaceId}/warehouses/${warehouseId}/tables?$filter=schema eq '${schema}'`
      : `workspaces/${workspaceId}/warehouses/${warehouseId}/tables`;
    return this.makeRequest(endpoint);
  }

  /**
   * Get table schema and metadata
   * @param workspaceId - ID of the workspace
   * @param warehouseId - ID of the warehouse
   * @param schemaName - Name of the schema
   * @param tableName - Name of the table
   * @returns Promise resolving to table details
   */
  async getWarehouseTable(workspaceId: string, warehouseId: string, schemaName: string, tableName: string): Promise<ApiResponse<WarehouseTable>> {
    return this.makeRequest(`workspaces/${workspaceId}/warehouses/${warehouseId}/tables/${schemaName}.${tableName}`);
  }

  /**
   * Execute SQL query on data warehouse
   * @param workspaceId - ID of the workspace
   * @param warehouseId - ID of the warehouse
   * @param query - SQL query to execute
   * @param maxRows - Maximum number of rows to return (default: 1000)
   * @returns Promise resolving to query results
   */
  async executeWarehouseQuery(workspaceId: string, warehouseId: string, query: string, maxRows: number = 1000): Promise<ApiResponse<WarehouseQueryResult>> {
    return this.makeRequest(`workspaces/${workspaceId}/warehouses/${warehouseId}/executeQuery`, {
      method: 'POST',
      body: {
        query,
        maxRows
      }
    });
  }

  /**
   * Get data warehouse connection string
   * @param workspaceId - ID of the workspace
   * @param warehouseId - ID of the warehouse
   * @returns Promise resolving to connection details
   */
  async getWarehouseConnectionString(workspaceId: string, warehouseId: string): Promise<ApiResponse<{ connectionString: string; serverName: string; databaseName: string }>> {
    return this.makeRequest(`workspaces/${workspaceId}/warehouses/${warehouseId}/connectionString`);
  }

  /**
   * Load data into warehouse table
   * @param workspaceId - ID of the workspace
   * @param warehouseId - ID of the warehouse
   * @param tableName - Name of the target table
   * @param data - Data to load (array of objects)
   * @param schema - Optional schema name
   * @returns Promise resolving to load result
   */
  async loadDataToWarehouse(workspaceId: string, warehouseId: string, tableName: string, data: Record<string, any>[], schema: string = 'dbo'): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/warehouses/${warehouseId}/tables/${schema}.${tableName}/load`, {
      method: 'POST',
      body: { data }
    });
  }

  // ==================== FABRIC CAPACITY AND MONITORING METHODS ====================

  /**
   * List Fabric capacities
   * @returns Promise resolving to capacities
   */
  async listCapacities(): Promise<ApiResponse> {
    return this.makeRequest('capacities');
  }

  /**
   * Get capacity usage and metrics
   * @param capacityId - ID of the capacity
   * @returns Promise resolving to capacity metrics
   */
  async getCapacityMetrics(capacityId: string): Promise<ApiResponse> {
    return this.makeRequest(`capacities/${capacityId}/metrics`);
  }

  /**
   * Get Fabric admin information
   * @returns Promise resolving to admin info
   */
  async getFabricAdminInfo(): Promise<ApiResponse> {
    return this.makeRequest('admin/tenantSettings');
  }

  /**
   * Get activity events for monitoring
   * @param startDateTime - Start date for activity logs
   * @param endDateTime - End date for activity logs
   * @returns Promise resolving to activity events
   */
  async getActivityEvents(startDateTime: string, endDateTime: string): Promise<ApiResponse> {
    const params = new URLSearchParams();
    params.append('startDateTime', startDateTime);
    params.append('endDateTime', endDateTime);
    
    return this.makeRequest(`admin/activityevents?${params.toString()}`);
  }

  // ==================== ENHANCED ITEM MANAGEMENT METHODS ====================

  /**
   * Get item definition/content for any item type (enhanced version)
   * @param workspaceId - ID of the workspace
   * @param itemId - ID of the item
   * @param format - Format to return (default: original format)
   * @returns Promise resolving to item definition
   */
  async getItemDefinitionEnhanced(workspaceId: string, itemId: string, format?: string): Promise<ApiResponse<ItemDefinition>> {
    const params = format ? `?format=${format}` : '';
    return this.makeRequest(`workspaces/${workspaceId}/items/${itemId}/getDefinition${params}`, {
      method: 'POST'
    });
  }

  /**
   * Update item definition/content for any item type (enhanced version)
   * @param workspaceId - ID of the workspace
   * @param itemId - ID of the item
   * @param definition - New item definition
   * @returns Promise resolving to update result
   */
  async updateItemDefinitionEnhanced(workspaceId: string, itemId: string, definition: ItemDefinition): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/items/${itemId}/updateDefinition`, {
      method: 'POST',
      body: { definition }
    });
  }

  /**
   * List all item types in a workspace with enhanced filtering
   * @param workspaceId - ID of the workspace
   * @param type - Optional item type filter
   * @param continuationToken - Optional continuation token for pagination
   * @returns Promise resolving to filtered items
   */
  async listWorkspaceItems(workspaceId: string, type?: string, continuationToken?: string): Promise<ApiResponse<{ value: FabricItem[]; continuationUri?: string }>> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (continuationToken) params.append('continuationToken', continuationToken);
    
    const queryString = params.toString();
    const endpoint = queryString ? `workspaces/${workspaceId}/items?${queryString}` : `workspaces/${workspaceId}/items`;
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get detailed item metadata
   * @param workspaceId - ID of the workspace
   * @param itemId - ID of the item
   * @returns Promise resolving to item details
   */
  async getItemDetails(workspaceId: string, itemId: string): Promise<ApiResponse<FabricItem>> {
    return this.makeRequest(`workspaces/${workspaceId}/items/${itemId}`);
  }

  /**
   * Create item with specific type and definition
   * @param workspaceId - ID of the workspace
   * @param itemType - Type of item to create
   * @param displayName - Display name for the item
   * @param description - Optional description
   * @param definition - Optional item definition
   * @returns Promise resolving to created item
   */
  async createItemWithDefinition(
    workspaceId: string, 
    itemType: string, 
    displayName: string, 
    description?: string,
    definition?: ItemDefinition
  ): Promise<ApiResponse<FabricItem>> {
    const payload: { type: string; displayName: string; description?: string; definition?: ItemDefinition } = {
      type: itemType,
      displayName
    };
    
    if (description) payload.description = description;
    if (definition) payload.definition = definition;
    
    return this.makeRequest(`workspaces/${workspaceId}/items`, {
      method: 'POST',
      body: payload
    });
  }

  // ==================== ENHANCED WORKSPACE MANAGEMENT METHODS ====================

  /**
   * Assign workspace to capacity
   * @param workspaceId - ID of the workspace
   * @param capacityId - ID of the capacity
   * @returns Promise resolving to assignment result
   */
  async assignWorkspaceToCapacity(workspaceId: string, capacityId: string): Promise<ApiResponse<WorkspaceCapacityAssignment>> {
    return this.makeRequest(`workspaces/${workspaceId}/assignToCapacity`, {
      method: 'POST',
      body: { capacityId }
    });
  }

  /**
   * Unassign workspace from capacity
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to unassignment result
   */
  async unassignWorkspaceFromCapacity(workspaceId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/unassignFromCapacity`, {
      method: 'POST'
    });
  }

  /**
   * Get workspace capacity assignment details
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to capacity assignment details
   */
  async getWorkspaceCapacityAssignment(workspaceId: string): Promise<ApiResponse<WorkspaceCapacityAssignment>> {
    return this.makeRequest(`workspaces/${workspaceId}/capacityAssignment`);
  }

  /**
   * Provision workspace identity (for data sources and external connections)
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to identity provisioning result
   */
  async provisionWorkspaceIdentity(workspaceId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/provisionIdentity`, {
      method: 'POST'
    });
  }

  // ==================== FABRIC CAPACITY MANAGEMENT METHODS ====================

  /**
   * Get specific capacity details
   * @param capacityId - ID of the capacity
   * @returns Promise resolving to capacity details
   */
  async getCapacity(capacityId: string): Promise<ApiResponse<FabricCapacity>> {
    return this.makeRequest(`capacities/${capacityId}`);
  }

  /**
   * Get capacity workloads configuration
   * @param capacityId - ID of the capacity
   * @returns Promise resolving to workloads configuration
   */
  async getCapacityWorkloads(capacityId: string): Promise<ApiResponse<{ value: CapacityWorkload[] }>> {
    return this.makeRequest(`capacities/${capacityId}/workloads`);
  }

  /**
   * Update capacity workloads configuration
   * @param capacityId - ID of the capacity
   * @param workloads - Workloads configuration to update
   * @returns Promise resolving to update result
   */
  async updateCapacityWorkloads(capacityId: string, workloads: CapacityWorkload[]): Promise<ApiResponse> {
    return this.makeRequest(`capacities/${capacityId}/workloads`, {
      method: 'PATCH',
      body: { workloads }
    });
  }

  /**
   * List workspaces assigned to a capacity
   * @param capacityId - ID of the capacity
   * @returns Promise resolving to assigned workspaces
   */
  async getCapacityWorkspaces(capacityId: string): Promise<ApiResponse<{ value: WorkspaceInfo[] }>> {
    return this.makeRequest(`capacities/${capacityId}/workspaces`);
  }

  // ==================== DATA PIPELINE METHODS ====================

  /**
   * List data pipelines in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to data pipelines
   */
  async listDataPipelines(workspaceId: string): Promise<ApiResponse<{ value: DataPipeline[] }>> {
    const params = new URLSearchParams();
    params.append('$filter', "type eq 'DataPipeline'");
    return this.makeRequest(`workspaces/${workspaceId}/items?${params.toString()}`);
  }

  /**
   * Get specific data pipeline
   * @param workspaceId - ID of the workspace
   * @param pipelineId - ID of the pipeline
   * @returns Promise resolving to pipeline details
   */
  async getDataPipeline(workspaceId: string, pipelineId: string): Promise<ApiResponse<DataPipeline>> {
    return this.makeRequest(`workspaces/${workspaceId}/dataPipelines/${pipelineId}`);
  }

  /**
   * Create a new data pipeline
   * @param workspaceId - ID of the workspace
   * @param displayName - Name of the pipeline
   * @param description - Optional description
   * @param definition - Pipeline definition
   * @returns Promise resolving to created pipeline
   */
  async createDataPipeline(workspaceId: string, displayName: string, description?: string, definition?: ItemDefinition): Promise<ApiResponse<DataPipeline>> {
    const payload: { type: string; displayName: string; description?: string; definition?: ItemDefinition } = {
      type: 'DataPipeline',
      displayName
    };
    
    if (description) payload.description = description;
    if (definition) payload.definition = definition;
    
    return this.makeRequest(`workspaces/${workspaceId}/items`, {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Run/trigger a data pipeline
   * @param workspaceId - ID of the workspace
   * @param pipelineId - ID of the pipeline
   * @param jobType - Type of job to run (default: Pipeline)
   * @param executionData - Optional execution parameters
   * @returns Promise resolving to run result
   */
  async runDataPipeline(workspaceId: string, pipelineId: string, jobType: string = 'Pipeline', executionData?: Record<string, unknown>): Promise<ApiResponse<PipelineRunResult>> {
    const payload: { jobType: string; executionData?: Record<string, unknown> } = { jobType };
    if (executionData) payload.executionData = executionData;
    
    return this.makeRequest(`workspaces/${workspaceId}/items/${pipelineId}/jobs/instances`, {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Get pipeline run status
   * @param workspaceId - ID of the workspace
   * @param pipelineId - ID of the pipeline
   * @param runId - ID of the run
   * @returns Promise resolving to run status
   */
  async getPipelineRunStatus(workspaceId: string, pipelineId: string, runId: string): Promise<ApiResponse<PipelineRunResult>> {
    return this.makeRequest(`workspaces/${workspaceId}/items/${pipelineId}/jobs/instances/${runId}`);
  }

  /**
   * Cancel a pipeline run
   * @param workspaceId - ID of the workspace
   * @param pipelineId - ID of the pipeline
   * @param runId - ID of the run to cancel
   * @returns Promise resolving to cancellation result
   */
  async cancelPipelineRun(workspaceId: string, pipelineId: string, runId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/items/${pipelineId}/jobs/instances/${runId}/cancel`, {
      method: 'POST'
    });
  }

  // ==================== ENVIRONMENT MANAGEMENT METHODS ====================

  /**
   * List environments in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to environments
   */
  async listEnvironments(workspaceId: string): Promise<ApiResponse<{ value: FabricEnvironment[] }>> {
    const params = new URLSearchParams();
    params.append('$filter', "type eq 'Environment'");
    return this.makeRequest(`workspaces/${workspaceId}/items?${params.toString()}`);
  }

  /**
   * Get specific environment
   * @param workspaceId - ID of the workspace
   * @param environmentId - ID of the environment
   * @returns Promise resolving to environment details
   */
  async getEnvironment(workspaceId: string, environmentId: string): Promise<ApiResponse<FabricEnvironment>> {
    return this.makeRequest(`workspaces/${workspaceId}/environments/${environmentId}`);
  }

  /**
   * Create a new environment
   * @param workspaceId - ID of the workspace
   * @param displayName - Name of the environment
   * @param description - Optional description
   * @returns Promise resolving to created environment
   */
  async createEnvironment(workspaceId: string, displayName: string, description?: string): Promise<ApiResponse<FabricEnvironment>> {
    const payload: { type: string; displayName: string; description?: string } = {
      type: 'Environment',
      displayName
    };
    
    if (description) payload.description = description;
    
    return this.makeRequest(`workspaces/${workspaceId}/items`, {
      method: 'POST',
      body: payload
    });
  }

  /**
   * Publish an environment
   * @param workspaceId - ID of the workspace
   * @param environmentId - ID of the environment
   * @returns Promise resolving to publish result
   */
  async publishEnvironment(workspaceId: string, environmentId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/environments/${environmentId}/staging/publish`, {
      method: 'POST'
    });
  }

  // ==================== ENHANCED POWER BI METHODS ====================

  /**
   * List Power BI dataflows in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to dataflows
   */
  async listPowerBIDataflows(workspaceId: string): Promise<ApiResponse<{ value: PowerBIDataflow[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/dataflows`);
  }

  /**
   * Get specific Power BI dataflow
   * @param workspaceId - ID of the workspace
   * @param dataflowId - ID of the dataflow
   * @returns Promise resolving to dataflow details
   */
  async getPowerBIDataflow(workspaceId: string, dataflowId: string): Promise<ApiResponse<PowerBIDataflow>> {
    return this.makeRequest(`workspaces/${workspaceId}/dataflows/${dataflowId}`);
  }

  /**
   * Refresh a Power BI dataflow
   * @param workspaceId - ID of the workspace
   * @param dataflowId - ID of the dataflow
   * @param refreshRequest - Refresh configuration
   * @returns Promise resolving to refresh result
   */
  async refreshPowerBIDataflow(workspaceId: string, dataflowId: string, refreshRequest?: { notifyOption?: string }): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/dataflows/${dataflowId}/refreshes`, {
      method: 'POST',
      body: refreshRequest || {}
    });
  }

  /**
   * List Power BI datamarts in a workspace
   * @param workspaceId - ID of the workspace
   * @returns Promise resolving to datamarts
   */
  async listPowerBIDatamarts(workspaceId: string): Promise<ApiResponse<{ value: PowerBIDatamart[] }>> {
    return this.makeRequest(`workspaces/${workspaceId}/datamarts`);
  }

  /**
   * Get specific Power BI datamart
   * @param workspaceId - ID of the workspace
   * @param datamartId - ID of the datamart
   * @returns Promise resolving to datamart details
   */
  async getPowerBIDatamart(workspaceId: string, datamartId: string): Promise<ApiResponse<PowerBIDatamart>> {
    return this.makeRequest(`workspaces/${workspaceId}/datamarts/${datamartId}`);
  }

  /**
   * Update datamart data source
   * @param workspaceId - ID of the workspace
   * @param datamartId - ID of the datamart
   * @param updateRequest - Update request details
   * @returns Promise resolving to update result
   */
  async updateDatamartDatasource(workspaceId: string, datamartId: string, updateRequest: Record<string, unknown>): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/datamarts/${datamartId}/updateDatasources`, {
      method: 'POST',
      body: updateRequest
    });
  }

  // ==================== LAKEHOUSE ENHANCED METHODS ====================

  /**
   * Get lakehouse SQL endpoint connection details
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @returns Promise resolving to SQL endpoint details
   */
  async getLakehouseSQLEndpoint(workspaceId: string, lakehouseId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/sqlEndpoint`);
  }

  /**
   * Get lakehouse tables information
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @returns Promise resolving to tables information
   */
  async getLakehouseTables(workspaceId: string, lakehouseId: string): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/tables`);
  }

  /**
   * Load data to lakehouse table
   * @param workspaceId - ID of the workspace
   * @param lakehouseId - ID of the lakehouse
   * @param tableName - Name of the table
   * @param relativePath - Relative path to data file
   * @param pathType - Type of path (File or Folder)
   * @param mode - Load mode (Append or Overwrite)
   * @returns Promise resolving to load result
   */
  async loadDataToLakehouse(
    workspaceId: string, 
    lakehouseId: string, 
    tableName: string, 
    relativePath: string,
    pathType: 'File' | 'Folder' = 'File',
    mode: 'Append' | 'Overwrite' = 'Overwrite'
  ): Promise<ApiResponse> {
    return this.makeRequest(`workspaces/${workspaceId}/lakehouses/${lakehouseId}/tables/${tableName}/load`, {
      method: 'POST',
      body: {
        relativePath,
        pathType,
        mode
      }
    });
  }
}
