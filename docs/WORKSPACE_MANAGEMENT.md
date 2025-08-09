# Microsoft Fabric Workspace Management

## Overview
Enhanced workspace management tools to make it easier for users to work with Microsoft Fabric workspaces without needing to remember complex GUIDs.

## New Tools Added

### 1. `fabric_list_workspaces`
**Enhanced to support the official Microsoft Fabric Admin API**

**Description**: List all workspaces accessible to the user using the admin API endpoint.

**API Endpoint**: `GET https://api.fabric.microsoft.com/v1/admin/workspaces`

**Parameters**:
- `bearerToken` (optional): Bearer token for authentication
- `type` (optional): Filter by workspace type 
- `capacityId` (optional): Filter by capacity ID
- `name` (optional): Filter by workspace name
- `state` (optional): Filter by state (Active, Deleted, etc.)
- `continuationToken` (optional): For pagination

**Example Usage**:
```
fabric_list_workspaces
fabric_list_workspaces name="Sales" state="Active"
fabric_list_workspaces type="Workspace"
```

**Sample Response**:
```
Workspaces (5 found):

1. Sales Analytics Workspace (Workspace)
   ID: 41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e87
   State: Active
   Capacity ID: 41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e84

2. Marketing Data Hub (Workspace)
   ID: 52df17e2-e92c-5fb1-cd7e-3df4ee3f9f98
   State: Active
   Capacity ID: 52df17e2-e92c-5fb1-cd7e-3df4ee3f9f95
```

### 2. `fabric_find_workspace`
**New tool for easy workspace discovery**

**Description**: Find workspace by name and get its ID for use in other operations. This is especially useful when you know the workspace name but need the GUID for other API calls.

**Parameters**:
- `bearerToken` (optional): Bearer token for authentication
- `searchName` (required): Workspace name to search for (supports partial matching)

**Example Usage**:
```
fabric_find_workspace searchName="Sales"
fabric_find_workspace searchName="Analytics"
```

**Sample Response** (single match):
```
✅ Found workspace: "Sales Analytics Workspace"

📋 Details:
• ID: 41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e87
• Type: Workspace
• State: Active
• Capacity ID: 41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e84

💡 You can now use this workspace ID (41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e87) in other operations!
```

**Sample Response** (multiple matches):
```
Found 3 workspaces matching "Analytics":

1. "Sales Analytics Workspace"
   ID: 41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e87
   Type: Workspace
   State: Active
   Capacity ID: 41ce06d1-d81b-4ea0-bc6d-2ce3dd2f8e84

2. "HR Analytics"
   ID: 63e028f3-fa3d-6gc2-de8f-4ef5ff4a0a09
   Type: Workspace
   State: Active
   Capacity ID: 63e028f3-fa3d-6gc2-de8f-4ef5ff4a0a06

💡 Copy the ID of the workspace you want to use for other operations.
```

## Typical User Workflow

### Before (Cumbersome):
1. User needs to manually provide workspace GUID
2. Hard to remember or find the correct GUID
3. Error-prone copy/paste operations

### After (User-Friendly):
1. **Discover workspaces**: Use `fabric_list_workspaces` to see all available workspaces
2. **Find specific workspace**: Use `fabric_find_workspace searchName="MyWorkspace"` to get the GUID
3. **Use in other operations**: Copy the GUID and use it in other fabric tools

## API Implementation Details

### Enhanced FabricApiClient Methods

**`listWorkspaces(type?, capacityId?, name?, state?, continuationToken?)`**
- Uses admin API endpoint: `/admin/workspaces`
- Supports all official API parameters
- Returns properly typed `WorkspacesResponse`

**`simulateWorkspaces(type?, capacityId?, name?, state?)`**
- Provides realistic test data for development/testing
- Supports all filtering parameters
- Returns same structure as real API

### Response Format
Follows the official Microsoft Fabric API response structure:
```typescript
interface WorkspacesResponse {
  workspaces: WorkspaceInfo[];
  continuationUri?: string;
  continuationToken?: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  type: string;
  state: string;
  capacityId?: string;
}
```

## Benefits

1. **User Experience**: No more need to remember or look up workspace GUIDs
2. **Discoverability**: Easy to find available workspaces
3. **Filtering**: Support for all official API filters
4. **Pagination**: Built-in support for large workspace lists
5. **Error Handling**: Helpful error messages and suggestions
6. **Standards Compliance**: Uses official Microsoft Fabric Admin API

## Security Considerations

- Uses admin API endpoints which require appropriate permissions
- Respects bearer token authentication
- Follows Microsoft Fabric API security guidelines
- Filters sensitive information appropriately

## Testing

The implementation includes simulation data for testing without requiring live API access:
- 6 sample workspaces with various states and types
- Realistic GUIDs and capacity IDs
- Support for all filtering scenarios
- Pagination testing support
