import { z } from 'zod';
// Reuse executeApiCall via injection to avoid circular imports
export function registerCapacityTools(server, authConfig, executeApiCall) {
    // Schemas local (keep lightweight – mirrors definitions in index.ts but isolated)
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
    // Register tools (idempotent guard to prevent duplicate registration if index.ts already has them) 
    const existingTools = server.listTools ? server.listTools() : [];
    const existing = new Set(existingTools.map((t) => t.name));
    if (existing.has("fabric_list_capacities")) {
        return; // Already registered in main file
    }
    server.tool("fabric_list_capacities", "List all available Fabric capacities", ListCapacitiesSchema.shape, async ({ bearerToken }) => {
        const result = await executeApiCall(bearerToken, authConfig.defaultWorkspaceId || "global", "list-capacities", (client) => client.listCapacities(), {});
        if (result.status === 'error') {
            return { content: [{ type: 'text', text: `Error listing capacities: ${result.error}` }] };
        }
        const capacities = Array.isArray(result.data) ? result.data : [];
        if (capacities.length === 0) {
            return { content: [{ type: 'text', text: 'No capacities found in your tenant.' }] };
        }
        const list = capacities.map((c, i) => `${i + 1}. ${c.displayName} (${c.sku})\n   ID: ${c.id}\n   State: ${c.state}\n   Region: ${c.region}`).join('\n\n');
        return {
            content: [{ type: 'text', text: `🏗️ Found ${capacities.length} Fabric Capacities:\n\n${list}\n\nUse a capacity ID in other operations (assignment, listing workspaces).` }]
        };
    });
    server.tool("fabric_assign_workspace_to_capacity", "Assign a workspace to a dedicated Fabric capacity", AssignWorkspaceToCapacitySchema.shape, async ({ bearerToken, capacityId, workspaceId }) => {
        const result = await executeApiCall(bearerToken, authConfig.defaultWorkspaceId || "global", "assign-workspace-to-capacity", (client) => client.assignWorkspaceToCapacity(capacityId, workspaceId), { capacityId, workspaceId });
        if (result.status === 'error') {
            return { content: [{ type: 'text', text: `Error assigning workspace to capacity: ${result.error}` }] };
        }
        return {
            content: [{ type: 'text', text: `✅ Workspace ${workspaceId} assigned to capacity ${capacityId}.` }]
        };
    });
    server.tool("fabric_unassign_workspace_from_capacity", "Unassign a workspace from its capacity (move to shared capacity)", UnassignWorkspaceFromCapacitySchema.shape, async ({ bearerToken, workspaceId }) => {
        const result = await executeApiCall(bearerToken, authConfig.defaultWorkspaceId || "global", "unassign-workspace-from-capacity", (client) => client.unassignWorkspaceFromCapacity(workspaceId), { workspaceId });
        if (result.status === 'error') {
            return { content: [{ type: 'text', text: `Error unassigning workspace from capacity: ${result.error}` }] };
        }
        return {
            content: [{ type: 'text', text: `✅ Workspace ${workspaceId} moved to shared capacity.` }]
        };
    });
    server.tool("fabric_list_capacity_workspaces", "List all workspaces assigned to a specific capacity", ListCapacityWorkspacesSchema.shape, async ({ bearerToken, capacityId }) => {
        const result = await executeApiCall(bearerToken, authConfig.defaultWorkspaceId || "global", "list-capacity-workspaces", (client) => client.listCapacityWorkspaces(capacityId), { capacityId });
        if (result.status === 'error') {
            return { content: [{ type: 'text', text: `Error listing capacity workspaces: ${result.error}` }] };
        }
        const workspaces = Array.isArray(result.data) ? result.data : [];
        if (workspaces.length === 0) {
            return { content: [{ type: 'text', text: `No workspaces found in capacity ${capacityId}.` }] };
        }
        const list = workspaces.map((w, i) => `${i + 1}. ${w.name} (${w.type})\n   ID: ${w.id}\n   State: ${w.state}`).join('\n\n');
        return {
            content: [{ type: 'text', text: `🏗️ Workspaces in Capacity ${capacityId} (${workspaces.length}):\n\n${list}` }]
        };
    });
}
//# sourceMappingURL=capacity-tools.js.map