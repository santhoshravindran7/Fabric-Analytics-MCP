# Fabric Analytics MCP Data Integration and Performance Monitoring Features

This documentation covers the comprehensive set of functions available in the Fabric Analytics MCP server for Microsoft Fabric Dataflows, monitoring, and run management.

## Table of Contents

- [Dataflow Management](#dataflow-management)
- [Monitoring & Analytics](#monitoring--analytics)
- [Run Management](#run-management)

## Dataflow Management

### Create Dataflow

#### `create-fabric-dataflow`

Create a new Dataflow Gen2 in Microsoft Fabric workspace.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `displayName` (string, required): Display name for the dataflow
- `description` (string, optional): Description for the dataflow

**Returns:**
- Created dataflow details

**Example:**
```javascript
// Create dataflow
const dataflow = await createFabricDataflow({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    displayName: "Sales ETL Pipeline",
    description: "ETL pipeline for sales data processing"
});
```

### List Dataflows

#### `list-fabric-dataflows`

List all Dataflow Gen2 in Microsoft Fabric workspace.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID

**Returns:**
- List of dataflows in the workspace

**Example:**
```javascript
// List dataflows
const dataflows = await listFabricDataflows({
    bearerToken: "your-token",
    workspaceId: "workspace-id"
});
```

### Monitor Dataflow Status

#### `monitor-dataflow-status`

Get comprehensive dataflow status with health monitoring and performance metrics.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `dataflowId` (string, required): Dataflow ID to monitor
- `includeHealthMetrics` (boolean, optional): Include health scoring and performance analysis - default: true

**Returns:**
- Comprehensive dataflow status
- Health metrics and performance data

**Example:**
```javascript
// Monitor dataflow status
const status = await monitorDataflowStatus({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    dataflowId: "dataflow-id",
    includeHealthMetrics: true
});
```

### Health Check

#### `perform-dataflow-health-check`

Perform comprehensive health check with scoring, analysis, and recommendations.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `dataflowId` (string, required): Dataflow ID to health check
- `checkDepth` (string, optional): Depth of health analysis (basic, standard, comprehensive) - default: standard
- `includeRecommendations` (boolean, optional): Include optimization recommendations - default: true

**Returns:**
- Health check results with scoring
- Optimization recommendations

**Example:**
```javascript
// Perform comprehensive health check
const healthCheck = await performDataflowHealthCheck({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    dataflowId: "dataflow-id",
    checkDepth: "comprehensive",
    includeRecommendations: true
});
```


### Continuous Monitoring

#### `start-continuous-dataflow-monitoring`

Start continuous monitoring session with real-time health checks and alerts.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `dataflowId` (string, required): Dataflow ID to monitor continuously
- `intervalMinutes` (number, optional): Check interval in minutes (1-60) - default: 5
- `durationMinutes` (number, optional): Total monitoring duration (0 = indefinite) - default: 60

**Returns:**
- Monitoring session details
- Session ID for management

**Example:**
```javascript
// Start continuous monitoring
const monitoring = await startContinuousDataflowMonitoring({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    dataflowId: "dataflow-id",
    intervalMinutes: 5,
    durationMinutes: 120
});
```

### List Monitoring Sessions

#### `list-monitoring-sessions`

List all active monitoring sessions.

**Parameters:**
- None

**Returns:**
- List of active monitoring sessions
- Session status and configuration

**Example:**
```javascript
// List monitoring sessions
const sessions = await listMonitoringSessions();
```

### Stop Monitoring Session

#### `stop-monitoring-session`

Stop a specific monitoring session.

**Parameters:**
- `sessionId` (string, required): Monitoring session ID to stop

**Returns:**
- Session termination confirmation

**Example:**
```javascript
// Stop monitoring session
await stopMonitoringSession({
    sessionId: "session-id"
});
```

## Run Management

### List Item Runs

#### `list-fabric-item-runs`

List all runs for a specific Fabric item with analysis.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `itemId` (string, required): Item ID to get runs for
- `top` (number, optional): Maximum number of runs to return (1-1000) - default: 100
- `continuationToken` (string, optional): Pagination token

**Returns:**
- List of runs with analysis
- Performance metrics and status

**Example:**
```javascript
// List item runs
const runs = await listFabricItemRuns({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    itemId: "item-id",
    top: 50
});
```

### Get Item Run Details

#### `get-fabric-item-run`

Get detailed information about a specific Fabric item run.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `itemId` (string, required): Item ID
- `jobInstanceId` (string, required): Specific job instance ID to retrieve
- `includeSubactivities` (boolean, optional): Include subactivity details - default: true

**Returns:**
- Detailed run information
- Subactivity breakdown and metrics

**Example:**
```javascript
// Get run details
const runDetails = await getFabricItemRun({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    itemId: "item-id",
    jobInstanceId: "job-instance-id",
    includeSubactivities: true
});
```

### Analyze Run Performance

#### `analyze-fabric-run-performance`

Perform detailed performance analysis on a specific run.

**Parameters:**
- `bearerToken` (string, required): Microsoft Fabric bearer token
- `workspaceId` (string, required): Microsoft Fabric workspace ID
- `itemId` (string, required): Item ID
- `jobInstanceId` (string, required): Job instance ID to analyze
- `analysisType` (string, optional): Type of analysis (performance, errors, bottlenecks, comprehensive) - default: comprehensive

**Returns:**
- Detailed performance analysis
- Bottleneck identification and recommendations

**Example:**
```javascript
// Analyze run performance
const analysis = await analyzeFabricRunPerformance({
    bearerToken: "your-token",
    workspaceId: "workspace-id",
    itemId: "item-id",
    jobInstanceId: "job-instance-id",
    analysisType: "comprehensive"
});
```

## Best Practices


### Monitoring
- Set up continuous monitoring for critical dataflows
- Review health check recommendations regularly


### Performance
- Monitor resource utilization through dashboards
- Implement proper error handling and retries

### Error Handling
- Always check return values for error conditions
- Implement proper logging for debugging
- Use try-catch blocks for API calls

### Resource Management
- Monitor workspace capacity utilization
- Implement proper lifecycle management for resources

## Support and Troubleshooting

For additional support:
- Check the authentication status using `check-fabric-auth-status`
- Review monitoring dashboards for system health
- Use health check functions for proactive issue detection


---

*For the latest updates and additional features, please refer to the project repository.*