/**
 * MCP Tools for Synapse to Fabric Migration
 * Exposes migration functionality as MCP tools
 */
import { z } from 'zod';
import { MigrationOrchestrator } from './orchestrator.js';
import { CapacityManager } from './capacity-tools.js';
import { SparkPoolManager } from './spark-pool-tools.js';
// Zod schemas for tool parameters
export const ListSynapseWorkspacesSchema = z.object({
    subscriptionId: z.string().optional().describe('Azure subscription ID (uses default if not provided)')
});
export const DiscoverSynapseWorkspaceSchema = z.object({
    subscriptionId: z.string().describe('Azure subscription ID'),
    resourceGroup: z.string().describe('Resource group name'),
    workspaceName: z.string().describe('Synapse workspace name'),
    sparkPoolName: z.string().optional().describe('Spark pool name (optional)')
});
export const TransformNotebooksSchema = z.object({
    inventoryJson: z.string().describe('JSON string of MigrationInventory from discovery phase'),
    dryRun: z.boolean().optional().default(false).describe('Preview transformation without making changes'),
    customRules: z.array(z.object({
        name: z.string(),
        pattern: z.string(),
        replacement: z.string(),
        description: z.string().optional()
    })).optional().describe('Custom transformation rules')
});
export const MigrateSynapseToFabricSchema = z.object({
    subscriptionId: z.string().describe('Azure subscription ID'),
    resourceGroup: z.string().describe('Resource group name'),
    synapseWorkspaceName: z.string().describe('Source Synapse workspace name'),
    targetWorkspaceId: z.string().describe('Target Fabric workspace ID'),
    targetLakehouseName: z.string().optional().describe('Target lakehouse name (creates if not exists)'),
    sparkPoolName: z.string().optional().describe('Spark pool name (optional)'),
    dryRun: z.boolean().optional().default(false).describe('Preview migration without making changes'),
    createShortcuts: z.boolean().optional().default(true).describe('Create OneLake shortcuts for data')
});
export const CreateFabricLakehouseSchema = z.object({
    workspaceId: z.string().describe('Fabric workspace ID'),
    lakehouseName: z.string().describe('Name for the new lakehouse'),
    description: z.string().optional().describe('Optional description for the lakehouse')
});
export const ProvisionNotebooksSchema = z.object({
    workspaceId: z.string().describe('Fabric workspace ID'),
    transformedNotebooksJson: z.string().describe('JSON array of TransformationResult objects'),
    lakehouseId: z.string().optional().describe('Optional lakehouse ID to associate with notebooks')
});
export const ListFabricCapacitiesSchema = z.object({});
export const AssignCapacityToWorkspaceSchema = z.object({
    workspaceId: z.string().describe('Fabric workspace ID'),
    capacityId: z.string().optional().describe('Capacity ID to assign (if not provided, will auto-select largest available)')
});
export const GetSynapseSparkPoolsSchema = z.object({
    subscriptionId: z.string().describe('Azure subscription ID'),
    resourceGroup: z.string().describe('Resource group name'),
    workspaceName: z.string().describe('Synapse workspace name')
});
export const CreateFabricSparkPoolsSchema = z.object({
    workspaceId: z.string().describe('Fabric workspace ID'),
    capacitySku: z.string().describe('Fabric capacity SKU (e.g., F2, F4, F64, F128)'),
    synapsePoolsJson: z.string().optional().describe('JSON array of Synapse Spark pool configurations to replicate')
});
// New: Synapse workspace details and compute spend
export const SynapseWorkspaceDetailsSchema = z.object({
    subscriptionId: z.string().describe('Azure subscription ID'),
    resourceGroup: z.string().describe('Resource group name'),
    workspaceName: z.string().describe('Synapse workspace name')
});
export const SynapseComputeSpendSchema = z.object({
    subscriptionId: z.string().describe('Azure subscription ID'),
    resourceGroup: z.string().describe('Resource group name'),
    workspaceName: z.string().describe('Synapse workspace name'),
    startDate: z.string().optional().describe('Start date for spend analysis (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date for spend analysis (YYYY-MM-DD)')
});
// New: Spark pool migration
export const ListSynapseSparkPoolsSchema = z.object({
    subscriptionId: z.string().describe('Azure subscription ID'),
    resourceGroup: z.string().describe('Resource group name'),
    workspaceName: z.string().describe('Synapse workspace name')
});
export const MigrateSparkPoolsToFabricSchema = z.object({
    synapseSparkPoolsJson: z.string().describe('JSON array of Synapse Spark pool definitions'),
    targetCapacitySku: z.string().describe('Target Fabric capacity SKU'),
    workspaceId: z.string().describe('Target Fabric workspace ID')
});
// New: Capacity sizing recommendation
export const RecommendFabricCapacitySchema = z.object({
    synapseComputeSummaryJson: z.string().describe('JSON summary of Synapse compute usage'),
    minSku: z.string().optional().describe('Minimum Fabric SKU to consider'),
    maxSku: z.string().optional().describe('Maximum Fabric SKU to consider')
});
/**
 * List available Synapse workspaces
 */
export async function listSynapseWorkspaces(params) {
    const orchestrator = new MigrationOrchestrator({});
    const workspaces = await orchestrator.listSynapseWorkspaces(params.subscriptionId);
    return {
        count: workspaces.length,
        workspaces: workspaces.map((ws) => ({
            name: ws.name,
            id: ws.id,
            location: ws.location,
            resourceGroup: ws.id?.split('/')[4], // Extract from resource ID
            managedResourceGroupName: ws.managedResourceGroupName
        }))
    };
}
/**
 * Discover assets from Synapse workspace
 */
export async function discoverSynapseWorkspace(params) {
    const source = {
        type: 'synapse',
        subscriptionId: params.subscriptionId,
        resourceGroup: params.resourceGroup,
        workspaceName: params.workspaceName,
        sparkPoolName: params.sparkPoolName
    };
    const orchestrator = new MigrationOrchestrator({});
    const inventory = await orchestrator.discoverOnly(source);
    return {
        source: {
            workspaceName: source.workspaceName,
            resourceGroup: source.resourceGroup
        },
        summary: {
            notebooks: inventory.notebooks.length,
            pipelines: inventory.pipelines.length,
            linkedServices: inventory.linkedServices.length,
            sparkJobs: inventory.sparkJobs.length
        },
        notebooks: inventory.notebooks.map(nb => ({
            name: nb.name,
            path: nb.path,
            id: nb.id
        })),
        pipelines: inventory.pipelines.map(p => ({
            name: p.name,
            id: p.id
        })),
        linkedServices: inventory.linkedServices.map(ls => ({
            name: ls.name,
            type: ls.type,
            id: ls.id
        })),
        sparkJobs: inventory.sparkJobs.map(sj => ({
            name: sj.name,
            scriptPath: sj.scriptPath,
            id: sj.id
        })),
        inventoryJson: JSON.stringify(inventory, null, 2),
        discoveredAt: inventory.discoveredAt
    };
}
/**
 * Transform notebooks (can be used standalone after discovery)
 */
export async function transformNotebooks(params) {
    const inventory = JSON.parse(params.inventoryJson);
    const config = {
        dryRun: params.dryRun
    };
    // Add custom rules if provided
    if (params.customRules) {
        config.transformRules = params.customRules.map(rule => ({
            name: rule.name,
            pattern: new RegExp(rule.pattern, 'g'),
            replacement: rule.replacement,
            description: rule.description
        }));
    }
    const orchestrator = new MigrationOrchestrator(config);
    const results = await orchestrator.transformOnly(inventory);
    // Generate report
    const report = orchestrator.generateTransformationReport(results);
    return {
        summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalChanges: results.reduce((sum, r) => sum + r.changes.length, 0)
        },
        results: results.map(r => ({
            notebookName: r.notebookName,
            success: r.success,
            changesCount: r.changes.length,
            errors: r.errors,
            warnings: r.warnings
        })),
        report,
        resultsJson: JSON.stringify(results, null, 2)
    };
}
/**
 * Execute complete migration from Synapse to Fabric
 */
export async function migrateSynapseToFabric(params) {
    const source = {
        type: 'synapse',
        subscriptionId: params.subscriptionId,
        resourceGroup: params.resourceGroup,
        workspaceName: params.synapseWorkspaceName,
        sparkPoolName: params.sparkPoolName
    };
    const config = {
        targetWorkspaceName: params.targetWorkspaceId,
        targetLakehouseName: params.targetLakehouseName,
        dryRun: params.dryRun,
        createShortcuts: params.createShortcuts
    };
    const orchestrator = new MigrationOrchestrator(config);
    const report = await orchestrator.executeMigration(source, params.targetWorkspaceId);
    return {
        status: report.summary.failed === 0 ? 'success' : 'partial_success',
        summary: report.summary,
        details: report.details.map(d => ({
            assetName: d.assetName,
            assetType: d.assetType,
            status: d.status,
            fabricItemId: d.fabricItemId,
            changesCount: d.changes?.length || 0,
            warningsCount: d.warnings?.length || 0,
            error: d.error
        })),
        recommendations: report.recommendations,
        reportMarkdown: generateMarkdownReport(report),
        generatedAt: report.generatedAt
    };
}
/**
 * Generate markdown report from migration report
 */
function generateMarkdownReport(report) {
    let md = '# Synapse to Fabric Migration Report\n\n';
    md += `**Generated:** ${new Date(report.generatedAt).toISOString()}\n\n`;
    md += '## Summary\n\n';
    md += `- **Total Assets:** ${report.summary.totalAssets}\n`;
    md += `- **Successful:** ${report.summary.successful}\n`;
    md += `- **Failed:** ${report.summary.failed}\n`;
    md += `- **Manual Review Required:** ${report.summary.requiresManualReview}\n`;
    md += `- **Duration:** ${(report.summary.duration / 1000).toFixed(2)}s\n\n`;
    if (report.recommendations.length > 0) {
        md += '## Recommendations\n\n';
        report.recommendations.forEach((rec) => {
            md += `- ${rec}\n`;
        });
        md += '\n';
    }
    md += '## Migration Results\n\n';
    md += '| Asset | Type | Status | Fabric ID | Changes | Warnings |\n';
    md += '|-------|------|--------|-----------|---------|----------|\n';
    report.details.forEach((detail) => {
        const changesCount = detail.changes?.length || 0;
        const warningsCount = detail.warnings?.length || 0;
        md += `| ${detail.assetName} | ${detail.assetType} | ${detail.status} | ${detail.fabricItemId || 'N/A'} | ${changesCount} | ${warningsCount} |\n`;
    });
    return md;
}
/**
 * Create a lakehouse in Fabric workspace
 */
export async function createFabricLakehouse(params) {
    const { FabricProvisioner } = await import('./fabric-provisioner.js');
    const provisioner = new FabricProvisioner(params.workspaceId, {});
    console.error(`🏗️ Creating lakehouse: ${params.lakehouseName}`);
    const lakehouseId = await provisioner.createLakehouse(params.lakehouseName);
    return {
        success: true,
        workspaceId: params.workspaceId,
        lakehouseName: params.lakehouseName,
        lakehouseId: lakehouseId,
        message: `Successfully created lakehouse '${params.lakehouseName}'`,
        fabricUrl: `https://app.fabric.microsoft.com/groups/${params.workspaceId}/lakehouses/${lakehouseId}`
    };
}
/**
 * Provision transformed notebooks to Fabric workspace
 */
export async function provisionNotebooks(params) {
    const { FabricProvisioner } = await import('./fabric-provisioner.js');
    const transformedNotebooks = JSON.parse(params.transformedNotebooksJson);
    const provisioner = new FabricProvisioner(params.workspaceId, {});
    console.error(`📦 Provisioning ${transformedNotebooks.length} notebooks to workspace ${params.workspaceId}`);
    const notebookIds = await provisioner.provisionNotebooks(transformedNotebooks);
    const provisionedNotebooks = Array.from(notebookIds.entries()).map(([name, id]) => ({
        name,
        fabricId: id,
        url: `https://app.fabric.microsoft.com/groups/${params.workspaceId}/notebooks/${id}`
    }));
    return {
        success: true,
        workspaceId: params.workspaceId,
        notebooksProvisioned: provisionedNotebooks.length,
        notebooks: provisionedNotebooks,
        message: `Successfully provisioned ${provisionedNotebooks.length} notebooks`
    };
}
/**
 * List all available Fabric capacities
 */
export async function listFabricCapacities(params) {
    const manager = new CapacityManager();
    const capacities = await manager.listCapacities();
    return {
        count: capacities.length,
        capacities: capacities.map((cap) => ({
            id: cap.id,
            displayName: cap.displayName,
            sku: cap.sku,
            state: cap.state,
            region: cap.region,
            sparkVCores: cap.sparkVCores,
            maxSparkVCoresWithBurst: cap.maxSparkVCoresWithBurst
        }))
    };
}
/**
 * Assign capacity to Fabric workspace
 */
export async function assignCapacityToWorkspace(params) {
    const manager = new CapacityManager();
    let capacityId = params.capacityId;
    if (!capacityId) {
        console.error('🔍 No capacity specified, finding largest available capacity...');
        const capacities = await manager.listCapacities();
        const best = manager.selectBestCapacity(capacities);
        capacityId = best.id;
        console.error(`   Selected: ${best.displayName} (${best.sku})`);
    }
    await manager.assignCapacity(params.workspaceId, capacityId);
    return {
        success: true,
        workspaceId: params.workspaceId,
        capacityId: capacityId,
        message: `Successfully assigned capacity to workspace`
    };
}
/**
 * Get Synapse Spark pool configurations
 */
export async function getSynapseSparkPools(params) {
    const manager = new SparkPoolManager();
    const pools = await manager.listSynapseSparkPools(params.subscriptionId, params.resourceGroup, params.workspaceName);
    return {
        count: pools.length,
        pools: pools.map((pool) => ({
            name: pool.name,
            nodeSize: pool.nodeSize,
            nodeCount: pool.nodeCount,
            autoScale: pool.autoScale,
            autoPause: pool.autoPause,
            sparkVersion: pool.sparkVersion
        }))
    };
}
/**
 * Create equivalent Fabric Spark pools based on capacity
 */
export async function createFabricSparkPools(params) {
    const manager = new SparkPoolManager();
    const synapsePools = params.synapsePoolsJson ? JSON.parse(params.synapsePoolsJson) : [];
    const recommendations = manager.convertSynapseToFabricPools(synapsePools, params.capacitySku);
    return {
        success: true,
        capacitySku: params.capacitySku,
        recommendations: recommendations,
        message: `Generated ${recommendations.length} Spark pool recommendations for Fabric`
    };
}
/**
 * Tool definitions for MCP server registration
 */
export const migrationTools = {
    fabric_list_synapse_workspaces: {
        schema: ListSynapseWorkspacesSchema,
        handler: listSynapseWorkspaces,
        description: 'List all Azure Synapse Analytics workspaces in subscription'
    },
    fabric_discover_synapse_workspace: {
        schema: DiscoverSynapseWorkspaceSchema,
        handler: discoverSynapseWorkspace,
        description: 'Discover and inventory assets from a Synapse workspace (notebooks, pipelines, linked services)'
    },
    fabric_transform_notebooks: {
        schema: TransformNotebooksSchema,
        handler: transformNotebooks,
        description: 'Transform Synapse notebooks to Fabric-compatible format (mssparkutils → notebookutils)'
    },
    fabric_migrate_synapse_to_fabric: {
        schema: MigrateSynapseToFabricSchema,
        handler: migrateSynapseToFabric,
        description: 'Execute complete migration from Synapse to Fabric (discover → transform → provision)'
    },
    fabric_create_lakehouse: {
        schema: CreateFabricLakehouseSchema,
        handler: createFabricLakehouse,
        description: 'Create a new lakehouse in a Fabric workspace'
    },
    fabric_provision_notebooks: {
        schema: ProvisionNotebooksSchema,
        handler: provisionNotebooks,
        description: 'Provision transformed notebooks to a Fabric workspace'
    },
    fabric_list_capacities: {
        schema: ListFabricCapacitiesSchema,
        handler: listFabricCapacities,
        description: 'List all available Fabric capacities with Spark VCore specifications'
    },
    fabric_assign_capacity: {
        schema: AssignCapacityToWorkspaceSchema,
        handler: assignCapacityToWorkspace,
        description: 'Assign a Fabric capacity to a workspace (auto-selects largest if not specified)'
    },
    fabric_get_synapse_spark_pools: {
        schema: GetSynapseSparkPoolsSchema,
        handler: getSynapseSparkPools,
        description: 'Get Synapse Spark pool configurations for migration planning'
    },
    fabric_create_fabric_spark_pools: {
        schema: CreateFabricSparkPoolsSchema,
        handler: createFabricSparkPools,
        description: 'Generate Fabric Spark pool recommendations from Synapse pools (1 Synapse VCore = 2 Fabric VCores)'
    },
    fabric_synapse_workspace_details: {
        schema: SynapseWorkspaceDetailsSchema,
        handler: async (params) => {
            const orchestrator = new MigrationOrchestrator({});
            const details = await orchestrator.getSynapseWorkspaceDetails(params.subscriptionId, params.resourceGroup, params.workspaceName);
            return details;
        },
        description: 'Get details of a Synapse workspace'
    },
    fabric_synapse_compute_spend: {
        schema: SynapseComputeSpendSchema,
        handler: async (params) => {
            const orchestrator = new MigrationOrchestrator({});
            const spend = await orchestrator.getSynapseComputeSpend(params.subscriptionId, params.resourceGroup, params.workspaceName, params.startDate, params.endDate);
            return spend;
        },
        description: 'Get compute spend data for a Synapse workspace'
    },
    fabric_migrate_spark_pools_to_fabric: {
        schema: MigrateSparkPoolsToFabricSchema,
        handler: async (params) => {
            const sparkPools = JSON.parse(params.synapseSparkPoolsJson);
            const orchestrator = new MigrationOrchestrator({});
            const results = await orchestrator.migrateSparkPoolsToFabric(sparkPools, params.targetCapacitySku, params.workspaceId);
            return results;
        },
        description: 'Migrate Synapse Spark pools to Fabric'
    },
    fabric_recommend_fabric_capacity: {
        schema: RecommendFabricCapacitySchema,
        handler: async (params) => {
            const summary = JSON.parse(params.synapseComputeSummaryJson);
            const orchestrator = new MigrationOrchestrator({});
            const recommendations = await orchestrator.recommendFabricCapacity(summary, params.minSku, params.maxSku);
            return recommendations;
        },
        description: 'Recommend Fabric capacity sizing based on Synapse compute usage'
    }
};
//# sourceMappingURL=mcp-tools.js.map