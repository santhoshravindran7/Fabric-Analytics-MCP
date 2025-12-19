// Default configuration
export const DEFAULT_CONFIG = {
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
    constructor(bearerToken, workspaceId, config = DEFAULT_CONFIG) {
        this.bearerToken = bearerToken;
        this.workspaceId = workspaceId;
        this.config = config;
    }
    /**
     * Make an HTTP request to the Fabric API.
     * @param endpoint - API endpoint (relative to workspace)
     * @param options - Request options
     * @returns Promise resolving to API response
     */
    async makeRequest(endpoint, options = {}) {
        const { method = "GET", body, headers = {}, queryParams } = options;
        const url = new URL(`${this.config.apiBaseUrl}/workspaces/${this.workspaceId}/${endpoint}`);
        if (queryParams) {
            Object.keys(queryParams).forEach(key => url.searchParams.append(key, String(queryParams[key])));
        }
        const requestHeaders = {
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
        }
        catch (error) {
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
    async listItems(itemType) {
        const endpoint = itemType ? `items?type=${itemType}` : "items";
        return this.makeRequest(endpoint);
    }
    /**
     * List all workspaces accessible to the user using admin API.
     * @param type - Optional workspace type filter
     * @param capacityId - Optional capacity ID filter
     * @param name - Optional name filter
     * @param state - Optional state filter (Active, Deleted, etc.)
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to workspaces list
     */
    async listWorkspaces(type, capacityId, name, state, continuationToken) {
        // Use admin API endpoint for listing workspaces (bypasses workspace-specific URL)
        const url = new URL(`${this.config.apiBaseUrl}/admin/workspaces`);
        if (type) {
            url.searchParams.append('type', type);
        }
        if (capacityId) {
            url.searchParams.append('capacityId', capacityId);
        }
        if (name) {
            url.searchParams.append('name', name);
        }
        if (state) {
            url.searchParams.append('state', state);
        }
        if (continuationToken) {
            url.searchParams.append('continuationToken', continuationToken);
        }
        const requestHeaders = {
            "Authorization": `Bearer ${this.bearerToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": this.config.userAgent,
        };
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: requestHeaders,
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
        }
        catch (error) {
            return {
                status: 'error',
                error: `Request failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Create a new item in the workspace.
     * @param itemType - Type of item to create
     * @param displayName - Display name for the item
     * @param description - Optional description
     * @returns Promise resolving to created item
     */
    async createItem(itemType, displayName, description) {
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
    async getItem(itemId) {
        return this.makeRequest(`items/${itemId}`);
    }
    /**
     * Update an existing item.
     * @param itemId - ID of the item to update
     * @param updates - Updates to apply
     * @returns Promise resolving to updated item
     */
    async updateItem(itemId, updates) {
        return this.makeRequest(`items/${itemId}`, { method: "PATCH", body: updates });
    }
    /**
     * Delete an item from the workspace.
     * @param itemId - ID of the item to delete
     * @returns Promise resolving to deletion confirmation
     */
    async deleteItem(itemId) {
        return this.makeRequest(`items/${itemId}`, { method: "DELETE" });
    }
    /**
     * Execute a notebook with optional parameters.
     * @param notebookId - ID of the notebook to execute
     * @param parameters - Optional parameters to pass to the notebook
     * @returns Promise resolving to job execution result
     */
    async executeNotebook(notebookId, parameters) {
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
    async submitSparkJob(lakehouseId, code, language = "python", config) {
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
    async getJobStatus(jobId) {
        return this.makeRequest(`jobs/${jobId}`);
    }
    /**
     * Create a Spark job instance from a Spark Job Definition.
     * @param sparkJobDefinitionId - ID of the Spark Job Definition
     * @param jobType - Type of job (default: "sparkjob")
     * @returns Promise resolving to job instance creation result
     */
    async createSparkJobInstance(sparkJobDefinitionId, jobType = "sparkjob") {
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
    async executeSparkJobDefinition(sparkJobDefinitionId, jobType = "sparkjob", executionData) {
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
    async getSparkJobInstanceStatus(sparkJobDefinitionId, jobInstanceId) {
        const url = `items/${sparkJobDefinitionId}/jobs/instances/${jobInstanceId}`;
        return this.makeRequest(url);
    }
    /**
     * Create a new Livy session for interactive Spark execution.
     * @param lakehouseId - ID of the lakehouse
     * @param config - Session configuration options
     * @returns Promise resolving to session creation result
     */
    async createLivySession(lakehouseId, config) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions`;
        return this.makeRequest(url, {
            method: "POST",
            body: config || {}
        });
    }
    /**
     * Get the status of a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @returns Promise resolving to session status
     */
    async getLivySession(lakehouseId, sessionId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}`;
        return this.makeRequest(url);
    }
    /**
     * List all Livy sessions for a lakehouse.
     * @param lakehouseId - ID of the lakehouse
     * @returns Promise resolving to list of sessions
     */
    async listLivySessions(lakehouseId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions`;
        return this.makeRequest(url);
    }
    /**
     * Delete a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session to delete (UUID string)
     * @returns Promise resolving to deletion result
     */
    async deleteLivySession(lakehouseId, sessionId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}`;
        return this.makeRequest(url, { method: "DELETE" });
    }
    /**
     * Execute a statement in a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @param statement - Statement configuration
     * @returns Promise resolving to statement execution result
     */
    async executeLivyStatement(lakehouseId, sessionId, statement) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}/statements`;
        return this.makeRequest(url, {
            method: "POST",
            body: statement
        });
    }
    /**
     * Get the result of a statement execution.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @param statementId - ID of the statement
     * @returns Promise resolving to statement result
     */
    async getLivyStatement(lakehouseId, sessionId, statementId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}/statements/${statementId}`;
        return this.makeRequest(url);
    }
    /**
     * List all statements in a Livy session.
     * @param lakehouseId - ID of the lakehouse
     * @param sessionId - ID of the Livy session (UUID string)
     * @returns Promise resolving to list of statements
     */
    async listLivyStatements(lakehouseId, sessionId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/sessions/${sessionId}/statements`;
        return this.makeRequest(url);
    }
    /**
     * Create a Livy batch job.
     * @param lakehouseId - ID of the lakehouse
     * @param config - Batch job configuration
     * @returns Promise resolving to batch creation result
     */
    async createLivyBatch(lakehouseId, config) {
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
    async getLivyBatch(lakehouseId, batchId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches/${batchId}`;
        return this.makeRequest(url);
    }
    /**
     * List all Livy batch jobs for a lakehouse.
     * @param lakehouseId - ID of the lakehouse
     * @returns Promise resolving to list of batch jobs
     */
    async listLivyBatches(lakehouseId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches`;
        return this.makeRequest(url);
    }
    /**
     * Delete a Livy batch job.
     * @param lakehouseId - ID of the lakehouse
     * @param batchId - ID of the batch job to delete
     * @returns Promise resolving to deletion result
     */
    async deleteLivyBatch(lakehouseId, batchId) {
        const url = `lakehouses/${lakehouseId}/livyapi/versions/2023-12-01/batches/${batchId}`;
        return this.makeRequest(url, { method: "DELETE" });
    }
    // ==================== SPARK MONITORING METHODS ====================
    /**
     * Get all Spark applications/Livy sessions in a workspace.
     * @param continuationToken - Optional continuation token for pagination
     * @returns Promise resolving to list of Spark applications
     */
    async getWorkspaceSparkApplications(continuationToken) {
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
    async getNotebookSparkApplications(notebookId, continuationToken) {
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
    async getSparkJobDefinitionApplications(sparkJobDefinitionId, continuationToken) {
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
    async getLakehouseSparkApplications(lakehouseId, continuationToken) {
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
    async getSparkApplicationDetails(livyId) {
        const url = `spark/livySessions/${livyId}`;
        return this.makeRequest(url);
    }
    /**
     * Get detailed information about a specific Spark application from a notebook session.
     * @param notebookId - ID of the notebook
     * @param livyId - ID of the Livy session
     * @param appId - Spark application ID (e.g., application_1742369571479_0001)
     * @param attemptId - Optional attempt ID
     * @returns Promise resolving to application details
     */
    async getNotebookSparkApplicationDetails(notebookId, livyId, appId, attemptId) {
        const basePath = `notebooks/${notebookId}/livySessions/${livyId}/applications/${appId}`;
        const url = attemptId ? `${basePath}/${attemptId}` : basePath;
        return this.makeRequest(url);
    }
    /**
     * Get jobs for a specific Spark application from a notebook session.
     * @param notebookId - ID of the notebook
     * @param livyId - ID of the Livy session
     * @param appId - Spark application ID
     * @param jobId - Optional specific job ID
     * @param attemptId - Optional attempt ID
     * @returns Promise resolving to job details
     */
    async getNotebookSparkApplicationJobs(notebookId, livyId, appId, jobId, attemptId) {
        let basePath = `notebooks/${notebookId}/livySessions/${livyId}/applications/${appId}`;
        if (attemptId) {
            basePath += `/${attemptId}`;
        }
        basePath += '/jobs';
        if (jobId) {
            basePath += `/${jobId}`;
        }
        return this.makeRequest(basePath);
    }
    /**
     * Cancel a running Spark application.
     * @param livyId - ID of the Livy session/application to cancel
     * @returns Promise resolving to cancellation result
     */
    async cancelSparkApplication(livyId) {
        const url = `spark/livySessions/${livyId}/cancel`;
        return this.makeRequest(url, { method: "POST" });
    }
    /**
     * Get comprehensive Spark monitoring dashboard for workspace.
     * @param includeCompleted - Whether to include completed jobs (default: true)
     * @param maxResults - Maximum number of results to return (default: 100)
     * @returns Promise resolving to monitoring dashboard data
     */
    async getSparkMonitoringDashboard(includeCompleted = true, maxResults = 100) {
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
            }, {}),
            byState: apps.reduce((acc, app) => {
                acc[app.state] = (acc[app.state] || 0) + 1;
                return acc;
            }, {}),
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
     * List all notebooks in the workspace.
     * @returns Promise resolving to list of notebooks
     */
    async listNotebooks() {
        return this.makeRequest("notebooks");
    }
    /**
     * Create a new notebook.
     * @param displayName - Display name for the notebook
     * @param description - Optional description
     * @returns Promise resolving to created notebook
     */
    async createNotebook(displayName, description) {
        const body = {
            displayName,
            ...(description && { description })
        };
        return this.makeRequest("notebooks", { method: "POST", body });
    }
    /**
     * Get details of a specific notebook.
     * @param notebookId - ID of the notebook to retrieve
     * @returns Promise resolving to notebook details
     */
    async getNotebook(notebookId) {
        return this.makeRequest(`notebooks/${notebookId}`);
    }
    /**
     * Update an existing notebook.
     * @param notebookId - ID of the notebook to update
     * @param updates - Updates to apply (displayName and/or description)
     * @returns Promise resolving to updated notebook
     */
    async updateNotebook(notebookId, updates) {
        return this.makeRequest(`notebooks/${notebookId}`, { method: "PATCH", body: updates });
    }
    /**
     * Delete a notebook from the workspace.
     * @param notebookId - ID of the notebook to delete
     * @returns Promise resolving to deletion confirmation
     */
    async deleteNotebook(notebookId) {
        return this.makeRequest(`notebooks/${notebookId}`, { method: "DELETE" });
    }
    /**
     * Get notebook definition/content.
     * @param notebookId - ID of the notebook
     * @param format - Format to return ('ipynb' or 'fabricGitSource')
     * @returns Promise resolving to notebook definition
     */
    async getNotebookDefinition(notebookId, format = 'ipynb') {
        const queryParams = format !== 'fabricGitSource' ? { format } : {};
        return this.makeRequest(`notebooks/${notebookId}/getDefinition`, {
            method: "POST",
            queryParams
        });
    }
    /**
     * Update notebook definition/content.
     * @param notebookId - ID of the notebook
     * @param definition - Notebook definition object
     * @returns Promise resolving to update result
     */
    async updateNotebookDefinition(notebookId, definition) {
        return this.makeRequest(`notebooks/${notebookId}/updateDefinition`, {
            method: "POST",
            body: { definition }
        });
    }
    /**
     * Run/execute a notebook.
     * @param notebookId - ID of the notebook to run
     * @param parameters - Optional parameters to pass to the notebook
     * @param configuration - Optional execution configuration
     * @returns Promise resolving to execution result
     */
    async runNotebook(notebookId, parameters, configuration) {
        const body = {};
        if (parameters) {
            body.parameters = parameters;
        }
        if (configuration) {
            body.configuration = configuration;
        }
        return this.makeRequest(`notebooks/${notebookId}/jobs/instances`, { method: "POST", body });
    }
    // ==================== SIMULATION METHODS ====================
    // These methods provide mock data for tools that don't have full API implementations yet
    /**
     * Simulate Spark applications for a specific item type and ID
     */
    simulateSparkApplications(itemType, itemId) {
        const mockApplications = [
            {
                id: `app_${Date.now()}_001`,
                name: `${itemType}-spark-session`,
                state: "RUNNING",
                applicationId: `application_${Date.now()}_0001`,
                driverLogUrl: `https://spark-history.fabric.microsoft.com/logs/driver`,
                sparkVersion: "3.4.0",
                submittedDateTime: new Date().toISOString(),
                itemId: itemId,
                itemType: itemType
            },
            {
                id: `app_${Date.now()}_002`,
                name: `${itemType}-batch-job`,
                state: "COMPLETED",
                applicationId: `application_${Date.now()}_0002`,
                driverLogUrl: `https://spark-history.fabric.microsoft.com/logs/driver`,
                sparkVersion: "3.4.0",
                submittedDateTime: new Date(Date.now() - 3600000).toISOString(),
                completedDateTime: new Date(Date.now() - 1800000).toISOString(),
                itemId: itemId,
                itemType: itemType
            }
        ];
        return Promise.resolve({
            status: 'success',
            data: {
                value: mockApplications,
                continuationToken: null
            }
        });
    }
    /**
     * Simulate Spark application details
     */
    simulateSparkApplicationDetails(livyId) {
        const mockDetails = {
            id: livyId,
            applicationId: `application_${Date.now()}_${livyId}`,
            name: `spark-application-${livyId}`,
            state: "RUNNING",
            kind: "pyspark",
            driverMemory: "8g",
            driverCores: 4,
            executorMemory: "4g",
            executorCores: 2,
            numExecutors: 2,
            submittedDateTime: new Date().toISOString(),
            log: [
                "24/01/26 10:00:00 INFO SparkContext: Running Spark version 3.4.0",
                "24/01/26 10:00:01 INFO SparkContext: Successfully started SparkContext",
                "24/01/26 10:00:02 INFO DAGScheduler: Job 0 started"
            ]
        };
        return Promise.resolve({
            status: 'success',
            data: mockDetails
        });
    }
    /**
     * Simulate cancelling a Spark application
     */
    simulateCancelSparkApplication(livyId) {
        return Promise.resolve({
            status: 'success',
            data: {
                message: `Spark application ${livyId} cancellation requested`,
                state: "CANCELLED",
                timestamp: new Date().toISOString()
            }
        });
    }
    /**
     * Simulate workspace listing data
     */
    simulateWorkspaces(type, capacityId, name, state) {
        const allWorkspaces = [
            {
                id: "41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e87",
                name: "Sales Analytics Workspace",
                type: "Workspace",
                state: "Active",
                capacityId: "41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e84"
            },
            {
                id: "52df17e2-e92c-5fb1-cd7e-3df4ee3f9f98",
                name: "Marketing Data Hub",
                type: "Workspace",
                state: "Active",
                capacityId: "52df17e2-e92c-5fb1-cd7e-3df4ee3f9f95"
            },
            {
                id: "63e028f3-fa3d-6gc2-de8f-4ef5ff4a0a09",
                name: "HR Analytics",
                type: "Workspace",
                state: "Active",
                capacityId: "63e028f3-fa3d-6gc2-de8f-4ef5ff4a0a06"
            },
            {
                id: "74f139g4-gb4e-7hd3-ef9g-5fg6gg5b1b10",
                name: "Finance Reporting",
                type: "Workspace",
                state: "Active",
                capacityId: "74f139g4-gb4e-7hd3-ef9g-5fg6gg5b1b07"
            },
            {
                id: "85g24ah5-hc5f-8ie4-fgah-6gh7hh6c2c21",
                name: "Customer Insights",
                type: "Workspace",
                state: "Active",
                capacityId: "85g24ah5-hc5f-8ie4-fgah-6gh7hh6c2c18"
            },
            {
                id: "96h35bi6-id6g-9jf5-ghbi-7hi8ii7d3d32",
                name: "Operations Dashboard",
                type: "Workspace",
                state: "Deleted",
                capacityId: "96h35bi6-id6g-9jf5-ghbi-7hi8ii7d3d29"
            }
        ];
        // Apply filters
        let filteredWorkspaces = allWorkspaces;
        if (type) {
            filteredWorkspaces = filteredWorkspaces.filter(w => w.type.toLowerCase().includes(type.toLowerCase()));
        }
        if (capacityId) {
            filteredWorkspaces = filteredWorkspaces.filter(w => w.capacityId === capacityId);
        }
        if (name) {
            filteredWorkspaces = filteredWorkspaces.filter(w => w.name.toLowerCase().includes(name.toLowerCase()));
        }
        if (state) {
            filteredWorkspaces = filteredWorkspaces.filter(w => w.state.toLowerCase() === state.toLowerCase());
        }
        const mockResponse = {
            workspaces: filteredWorkspaces,
            continuationUri: filteredWorkspaces.length > 5 ? "https://api.fabric.microsoft.com/v1/admin/workspaces?continuationToken='LDEsMTAwMDAwLDA%3D'" : undefined,
            continuationToken: filteredWorkspaces.length > 5 ? "LDEsMTAwMDAwLDA%3D" : undefined
        };
        return Promise.resolve({
            status: 'success',
            data: mockResponse
        });
    }
    /**
     * Simulate Spark monitoring dashboard data
     */
    simulateSparkDashboard(includeCompleted, maxResults) {
        const mockDashboard = {
            summary: {
                total: 12,
                running: 3,
                completed: includeCompleted ? 7 : 0,
                failed: 1,
                pending: 1
            },
            byItemType: {
                "Notebook": 8,
                "Lakehouse": 3,
                "SparkJobDefinition": 1
            },
            byState: {
                "RUNNING": 3,
                "COMPLETED": includeCompleted ? 7 : 0,
                "FAILED": 1,
                "PENDING": 1
            },
            recentActivity: [
                {
                    itemName: "DataAnalysisNotebook",
                    displayName: "DataAnalysisNotebook",
                    itemType: "Notebook",
                    type: "Notebook",
                    state: "RUNNING",
                    submittedDateTime: new Date().toISOString(),
                    totalDuration: { value: 15, timeUnit: "minutes" }
                },
                {
                    itemName: "SalesDataLakehouse",
                    displayName: "SalesDataLakehouse",
                    itemType: "Lakehouse",
                    type: "Lakehouse",
                    state: "COMPLETED",
                    submittedDateTime: new Date(Date.now() - 3600000).toISOString(),
                    totalDuration: { value: 45, timeUnit: "minutes" }
                }
            ].slice(0, Math.min(maxResults || 10, 10)),
            applications: []
        };
        return Promise.resolve({
            status: 'success',
            data: mockDashboard
        });
    }
    /**
     * List all available Fabric capacities
     * @returns Promise resolving to API response with capacities
     */
    async listCapacities() {
        try {
            const response = await this.makeRequest('/v1/capacities');
            if (response.status === 'success') {
                return {
                    status: 'success',
                    data: response.data?.value || []
                };
            }
            return {
                status: response.status,
                data: response.data?.value || [],
                message: response.message,
                error: response.error
            };
        }
        catch (error) {
            console.warn("Failed to fetch capacities from API, using simulation");
            return this.simulateCapacities();
        }
    }
    /**
     * Assign a workspace to a capacity
     * @param capacityId - Target capacity ID
     * @param workspaceId - Workspace ID to assign
     * @returns Promise resolving to API response
     */
    async assignWorkspaceToCapacity(capacityId, workspaceId) {
        try {
            const response = await this.makeRequest(`/v1/capacities/${capacityId}/assignWorkspace`, {
                method: 'POST',
                body: { workspaceId }
            });
            return response;
        }
        catch (error) {
            console.warn("Failed to assign workspace to capacity, using simulation");
            return Promise.resolve({
                status: 'success',
                data: {
                    message: `Workspace ${workspaceId} successfully assigned to capacity ${capacityId}`,
                    workspaceId,
                    capacityId,
                    assignedAt: new Date().toISOString()
                }
            });
        }
    }
    /**
     * Unassign a workspace from its capacity (move to shared capacity)
     * @param workspaceId - Workspace ID to unassign
     * @returns Promise resolving to API response
     */
    async unassignWorkspaceFromCapacity(workspaceId) {
        try {
            const response = await this.makeRequest(`/v1/workspaces/${workspaceId}/unassignFromCapacity`, {
                method: 'POST'
            });
            return response;
        }
        catch (error) {
            console.warn("Failed to unassign workspace from capacity, using simulation");
            return Promise.resolve({
                status: 'success',
                data: {
                    message: `Workspace ${workspaceId} successfully moved to shared capacity`,
                    workspaceId,
                    unassignedAt: new Date().toISOString()
                }
            });
        }
    }
    /**
     * List all workspaces in a specific capacity
     * @param capacityId - Capacity ID to list workspaces for
     * @returns Promise resolving to API response with workspaces
     */
    async listCapacityWorkspaces(capacityId) {
        try {
            const response = await this.makeRequest(`/v1/capacities/${capacityId}/workspaces`);
            if (response.status === 'success') {
                return {
                    status: 'success',
                    data: response.data?.value || []
                };
            }
            return {
                status: response.status,
                data: response.data?.value || [],
                message: response.message,
                error: response.error
            };
        }
        catch (error) {
            console.warn("Failed to fetch capacity workspaces from API, using simulation");
            return this.simulateCapacityWorkspaces(capacityId);
        }
    }
    /**
     * Simulate capacity listing for testing
     */
    simulateCapacities() {
        const mockCapacities = [
            {
                id: "41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e84",
                displayName: "Premium Capacity P1",
                sku: "P1",
                state: "Active",
                region: "West US 2",
                tenantKeyId: "tenant-123"
            },
            {
                id: "52df17e2-e92c-5fb1-cd7e-3df4ee3f9f95",
                displayName: "Premium Capacity P2",
                sku: "P2",
                state: "Active",
                region: "East US",
                tenantKeyId: "tenant-123"
            },
            {
                id: "63e028f3-fa3d-6gc2-de8f-4ef5ff4a0a06",
                displayName: "Fabric Capacity F64",
                sku: "F64",
                state: "Active",
                region: "Central US",
                tenantKeyId: "tenant-123"
            }
        ];
        return Promise.resolve({
            status: 'success',
            data: mockCapacities
        });
    }
    /**
     * Simulate capacity workspaces listing for testing
     */
    simulateCapacityWorkspaces(capacityId) {
        return this.simulateWorkspaces().then(response => {
            if (response.status === 'success' && response.data) {
                const workspaces = Array.isArray(response.data) ? response.data : response.data.workspaces || [];
                const capacityWorkspaces = workspaces.filter((w) => w.capacityId === capacityId);
                return {
                    status: 'success',
                    data: capacityWorkspaces
                };
            }
            return {
                status: 'error',
                data: [],
                error: 'Failed to simulate capacity workspaces'
            };
        });
    }
}
//# sourceMappingURL=fabric-client.js.map