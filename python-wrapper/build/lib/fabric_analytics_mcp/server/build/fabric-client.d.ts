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
export interface WorkspaceInfo {
    id: string;
    name: string;
    type: string;
    state: string;
    capacityId?: string;
}
export interface WorkspacesResponse {
    workspaces: WorkspaceInfo[];
    continuationUri?: string;
    continuationToken?: string;
}
export interface FabricCapacity {
    id: string;
    displayName: string;
    sku: string;
    state: string;
    region: string;
    tenantKeyId: string;
}
export interface FabricWorkspace {
    id: string;
    name: string;
    type: string;
    state: string;
    capacityId?: string;
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
    id: string;
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
export interface NotebookDefinition {
    parts: Array<{
        path: string;
        payload: string;
        payloadType: 'InlineBase64' | 'InlineText';
    }>;
}
export interface NotebookExecutionConfig {
    conf?: Record<string, string>;
    environment?: {
        id: string;
        name?: string;
    };
    defaultLakehouse?: {
        name: string;
        id: string;
        workspaceId?: string;
    };
    useStarterPool?: boolean;
    useWorkspacePool?: string;
}
export interface NotebookParameter {
    value: unknown;
    type: 'string' | 'int' | 'float' | 'bool';
}
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
export declare const DEFAULT_CONFIG: FabricConfig;
/**
 * API Client for Microsoft Fabric Analytics operations.
 * Provides methods for CRUD operations on Fabric items and job execution.
 */
export declare class FabricApiClient {
    private bearerToken;
    private workspaceId;
    private config;
    constructor(bearerToken: string, workspaceId: string, config?: FabricConfig);
    /**
     * Make an HTTP request to the Fabric API.
     * @param endpoint - API endpoint (relative to workspace)
     * @param options - Request options
     * @returns Promise resolving to API response
     */
    makeRequest<T>(endpoint: string, options?: {
        method?: string;
        body?: any;
        headers?: Record<string, string>;
        queryParams?: Record<string, any>;
    }): Promise<ApiResponse<T>>;
    /**
     * List items in the workspace.
     * @param itemType - Optional filter by item type
     * @returns Promise resolving to list of items
     */
    listItems(itemType?: string): Promise<ApiResponse>;
    /**
     * List all workspaces accessible to the user using admin API.
     * @param type - Optional workspace type filter
     * @param capacityId - Optional capacity ID filter
     * @param name - Optional name filter
     * @param state - Optional state filter (Active, Deleted, etc.)
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to workspaces list
     */
    listWorkspaces(type?: string, capacityId?: string, name?: string, state?: string, continuationToken?: string): Promise<ApiResponse<WorkspacesResponse>>;
    /**
     * Create a new item in the workspace.
     * @param itemType - Type of item to create
     * @param displayName - Display name for the item
     * @param description - Optional description
     * @returns Promise resolving to created item
     */
    createItem(itemType: string, displayName: string, description?: string): Promise<ApiResponse>;
    /**
     * Get details of a specific item.
     * @param itemId - ID of the item to retrieve
     * @returns Promise resolving to item details
     */
    getItem(itemId: string): Promise<ApiResponse>;
    /**
     * Update an existing item.
     * @param itemId - ID of the item to update
     * @param updates - Updates to apply
     * @returns Promise resolving to updated item
     */
    updateItem(itemId: string, updates: {
        displayName?: string;
        description?: string;
    }): Promise<ApiResponse>;
    /**
     * Delete an item from the workspace.
     * @param itemId - ID of the item to delete
     * @returns Promise resolving to deletion confirmation
     */
    deleteItem(itemId: string): Promise<ApiResponse>;
    /**
     * Execute a notebook with optional parameters.
     * @param notebookId - ID of the notebook to execute
     * @param parameters - Optional parameters to pass to the notebook
     * @returns Promise resolving to job execution result
     */
    executeNotebook(notebookId: string, parameters?: Record<string, any>): Promise<ApiResponse<JobExecutionResult>>;
    /**
     * Submit a Spark job to run on a Lakehouse.
     * @param lakehouseId - ID of the lakehouse for Spark context
     * @param code - Spark code to execute
     * @param language - Programming language (python, scala, sql)
     * @param config - Optional Spark cluster configuration
     * @returns Promise resolving to job execution result
     */
    submitSparkJob(lakehouseId: string, code: string, language?: string, config?: SparkJobConfig): Promise<ApiResponse<JobExecutionResult>>;
    /**
     * Get the status of a running job.
     * @param jobId - ID of the job to check
     * @returns Promise resolving to job status
     */
    getJobStatus(jobId: string): Promise<ApiResponse<JobExecutionResult>>;
    /**
     * Create a Spark job instance from a Spark Job Definition.
     * @param sparkJobDefinitionId - ID of the Spark Job Definition
     * @param jobType - Type of job (default: "sparkjob")
     * @returns Promise resolving to job instance creation result
     */
    createSparkJobInstance(sparkJobDefinitionId: string, jobType?: string): Promise<ApiResponse>;
    /**
     * Execute a Spark Job Definition with execution data.
     * @param sparkJobDefinitionId - ID of the Spark Job Definition
     * @param jobType - Type of job (default: "sparkjob")
     * @param executionData - Execution data for the job
     * @returns Promise resolving to job execution result
     */
    executeSparkJobDefinition(sparkJobDefinitionId: string, jobType?: string, executionData?: any): Promise<ApiResponse>;
    /**
     * Get the status of a Spark job instance.
     * @param sparkJobDefinitionId - ID of the Spark Job Definition
     * @param jobInstanceId - ID of the job instance
     * @returns Promise resolving to job instance status
     */
    getSparkJobInstanceStatus(sparkJobDefinitionId: string, jobInstanceId: string): Promise<ApiResponse>;
    /**
     * Create a new Livy session for interactive Spark execution.
     * @param lakehouseId - ID of the lakehouse
     * @param config - Session configuration options
     * @returns Promise resolving to session creation result
     */
    createLivySession(lakehouseId: string, config?: LivySessionConfig): Promise<ApiResponse<LivySessionResult>>;
    /**
     * Get the status of a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @returns Promise resolving to session status
     */
    getLivySession(lakehouseId: string, sessionId: string): Promise<ApiResponse<LivySessionResult>>;
    /**
     * List all Livy sessions for a lakehouse.
     * @param lakehouseId - ID of the lakehouse
     * @returns Promise resolving to list of sessions
     */
    listLivySessions(lakehouseId: string): Promise<ApiResponse<{
        sessions: LivySessionResult[];
    }>>;
    /**
     * Delete a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session to delete (UUID string)
     * @returns Promise resolving to deletion result
     */
    deleteLivySession(lakehouseId: string, sessionId: string): Promise<ApiResponse>;
    /**
     * Execute a statement in a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @param statement - Statement configuration
     * @returns Promise resolving to statement execution result
     */
    executeLivyStatement(lakehouseId: string, sessionId: string, statement: LivyStatementConfig): Promise<ApiResponse<LivyStatementResult>>;
    /**
     * Get the result of a statement execution.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @param statementId - ID of the statement
     * @returns Promise resolving to statement result
     */
    getLivyStatement(lakehouseId: string, sessionId: string, statementId: number): Promise<ApiResponse<LivyStatementResult>>;
    /**
     * List all statements in a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @returns Promise resolving to list of statements
     */
    listLivyStatements(lakehouseId: string, sessionId: string): Promise<ApiResponse<{
        statements: LivyStatementResult[];
    }>>;
    /**
     * Create a Livy batch job.
     * @param lakehouseId - ID of the lakehouse
     * @param config - Batch job configuration
     * @returns Promise resolving to batch creation result
     */
    createLivyBatch(lakehouseId: string, config: any): Promise<ApiResponse>;
    /**
     * Get the status of a Livy batch job.
     * @param lakehouseId - ID of the lakehouse
     * @param batchId - ID of the batch job
     * @returns Promise resolving to batch status
     */
    getLivyBatch(lakehouseId: string, batchId: number): Promise<ApiResponse>;
    /**
     * List all Livy batch jobs for a lakehouse.
     * @param lakehouseId - ID of the lakehouse
     * @returns Promise resolving to list of batch jobs
     */
    listLivyBatches(lakehouseId: string): Promise<ApiResponse>;
    /**
     * Delete a Livy batch job.
     * @param lakehouseId - ID of the lakehouse
     * @param batchId - ID of the batch job to delete
     * @returns Promise resolving to deletion result
     */
    deleteLivyBatch(lakehouseId: string, batchId: number): Promise<ApiResponse>;
    /**
     * Get all Spark applications/Livy sessions in a workspace.
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to list of Spark applications
     */
    getWorkspaceSparkApplications(continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>>;
    /**
     * Get all Spark applications/Livy sessions for a specific notebook.
     * @param notebookId - ID of the notebook
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to list of Spark applications for the notebook
     */
    getNotebookSparkApplications(notebookId: string, continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>>;
    /**
     * Get all Spark applications/Livy sessions for a specific Spark job definition.
     * @param sparkJobDefinitionId - ID of the Spark job definition
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to list of Spark applications for the job definition
     */
    getSparkJobDefinitionApplications(sparkJobDefinitionId: string, continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>>;
    /**
     * Get all Spark applications/Livy sessions for a specific lakehouse.
     * @param lakehouseId - ID of the lakehouse
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to list of Spark applications for the lakehouse
     */
    getLakehouseSparkApplications(lakehouseId: string, continuationToken?: string): Promise<ApiResponse<SparkApplicationsResponse>>;
    /**
     * Get detailed information about a specific Spark application.
     * @param livyId - ID of the Livy session/application
     * @returns Promise resolving to detailed application information
     */
    getSparkApplicationDetails(livyId: string): Promise<ApiResponse<SparkApplicationInfo>>;
    /**
     * Get detailed information about a specific Spark application from a notebook session.
     * @param notebookId - ID of the notebook
     * @param livyId - ID of the Livy session
     * @param appId - Spark application ID (e.g., application_1742369571479_0001)
     * @param attemptId - Optional attempt ID
     * @returns Promise resolving to application details
     */
    getNotebookSparkApplicationDetails(notebookId: string, livyId: string, appId: string, attemptId?: string): Promise<ApiResponse<any>>;
    /**
     * Get jobs for a specific Spark application from a notebook session.
     * @param notebookId - ID of the notebook
     * @param livyId - ID of the Livy session
     * @param appId - Spark application ID
     * @param jobId - Optional specific job ID
     * @param attemptId - Optional attempt ID
     * @returns Promise resolving to job details
     */
    getNotebookSparkApplicationJobs(notebookId: string, livyId: string, appId: string, jobId?: string, attemptId?: string): Promise<ApiResponse<any>>;
    /**
     * Cancel a running Spark application.
     * @param livyId - ID of the Livy session/application to cancel
     * @returns Promise resolving to cancellation result
     */
    cancelSparkApplication(livyId: string): Promise<ApiResponse>;
    /**
     * Get comprehensive Spark monitoring dashboard for workspace.
     * @param includeCompleted - Whether to include completed jobs (default: true)
     * @param maxResults - Maximum number of results to return (default: 100)
     * @returns Promise resolving to monitoring dashboard data
     */
    getSparkMonitoringDashboard(includeCompleted?: boolean, maxResults?: number): Promise<ApiResponse>;
    /**
     * List all notebooks in the workspace.
     * @returns Promise resolving to list of notebooks
     */
    listNotebooks(): Promise<ApiResponse>;
    /**
     * Create a new notebook.
     * @param displayName - Display name for the notebook
     * @param description - Optional description
     * @returns Promise resolving to created notebook
     */
    createNotebook(displayName: string, description?: string): Promise<ApiResponse>;
    /**
     * Get details of a specific notebook.
     * @param notebookId - ID of the notebook to retrieve
     * @returns Promise resolving to notebook details
     */
    getNotebook(notebookId: string): Promise<ApiResponse>;
    /**
     * Update an existing notebook.
     * @param notebookId - ID of the notebook to update
     * @param updates - Updates to apply (displayName and/or description)
     * @returns Promise resolving to updated notebook
     */
    updateNotebook(notebookId: string, updates: {
        displayName?: string;
        description?: string;
    }): Promise<ApiResponse>;
    /**
     * Delete a notebook from the workspace.
     * @param notebookId - ID of the notebook to delete
     * @returns Promise resolving to deletion confirmation
     */
    deleteNotebook(notebookId: string): Promise<ApiResponse>;
    /**
     * Get notebook definition/content.
     * @param notebookId - ID of the notebook
     * @param format - Format to return ('ipynb' or 'fabricGitSource')
     * @returns Promise resolving to notebook definition
     */
    getNotebookDefinition(notebookId: string, format?: 'ipynb' | 'fabricGitSource'): Promise<ApiResponse>;
    /**
     * Update notebook definition/content.
     * @param notebookId - ID of the notebook
     * @param definition - Notebook definition object
     * @returns Promise resolving to update result
     */
    updateNotebookDefinition(notebookId: string, definition: NotebookDefinition): Promise<ApiResponse>;
    /**
     * Run/execute a notebook.
     * @param notebookId - ID of the notebook to run
     * @param parameters - Optional parameters to pass to the notebook
     * @param configuration - Optional execution configuration
     * @returns Promise resolving to execution result
     */
    runNotebook(notebookId: string, parameters?: Record<string, NotebookParameter>, configuration?: NotebookExecutionConfig): Promise<ApiResponse>;
    /**
     * Simulate Spark applications for a specific item type and ID
     */
    simulateSparkApplications(itemType: string, itemId: string): Promise<ApiResponse>;
    /**
     * Simulate Spark application details
     */
    simulateSparkApplicationDetails(livyId: string): Promise<ApiResponse>;
    /**
     * Simulate cancelling a Spark application
     */
    simulateCancelSparkApplication(livyId: string): Promise<ApiResponse>;
    /**
     * Simulate workspace listing data
     */
    simulateWorkspaces(type?: string, capacityId?: string, name?: string, state?: string): Promise<ApiResponse<WorkspacesResponse>>;
    /**
     * Simulate Spark monitoring dashboard data
     */
    simulateSparkDashboard(includeCompleted?: boolean, maxResults?: number): Promise<ApiResponse>;
    /**
     * List all available Fabric capacities
     * @returns Promise resolving to API response with capacities
     */
    listCapacities(): Promise<ApiResponse<FabricCapacity[]>>;
    /**
     * Assign a workspace to a capacity
     * @param capacityId - Target capacity ID
     * @param workspaceId - Workspace ID to assign
     * @returns Promise resolving to API response
     */
    assignWorkspaceToCapacity(capacityId: string, workspaceId: string): Promise<ApiResponse<any>>;
    /**
     * Unassign a workspace from its capacity (move to shared capacity)
     * @param workspaceId - Workspace ID to unassign
     * @returns Promise resolving to API response
     */
    unassignWorkspaceFromCapacity(workspaceId: string): Promise<ApiResponse<any>>;
    /**
     * List all workspaces in a specific capacity
     * @param capacityId - Capacity ID to list workspaces for
     * @returns Promise resolving to API response with workspaces
     */
    listCapacityWorkspaces(capacityId: string): Promise<ApiResponse<FabricWorkspace[]>>;
    /**
     * Simulate capacity listing for testing
     */
    private simulateCapacities;
    /**
     * Simulate capacity workspaces listing for testing
     */
    private simulateCapacityWorkspaces;
}
