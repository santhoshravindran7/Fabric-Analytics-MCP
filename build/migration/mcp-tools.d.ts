/**
 * MCP Tools for Synapse to Fabric Migration
 * Exposes migration functionality as MCP tools
 */
import { z } from 'zod';
export declare const ListSynapseWorkspacesSchema: z.ZodObject<{
    subscriptionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    subscriptionId?: string | undefined;
}, {
    subscriptionId?: string | undefined;
}>;
export declare const DiscoverSynapseWorkspaceSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    resourceGroup: z.ZodString;
    workspaceName: z.ZodString;
    sparkPoolName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
    sparkPoolName?: string | undefined;
}, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
    sparkPoolName?: string | undefined;
}>;
export declare const TransformNotebooksSchema: z.ZodObject<{
    inventoryJson: z.ZodString;
    dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    customRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        pattern: z.ZodString;
        replacement: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        replacement: string;
        pattern: string;
        description?: string | undefined;
    }, {
        name: string;
        replacement: string;
        pattern: string;
        description?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    dryRun: boolean;
    inventoryJson: string;
    customRules?: {
        name: string;
        replacement: string;
        pattern: string;
        description?: string | undefined;
    }[] | undefined;
}, {
    inventoryJson: string;
    dryRun?: boolean | undefined;
    customRules?: {
        name: string;
        replacement: string;
        pattern: string;
        description?: string | undefined;
    }[] | undefined;
}>;
export declare const MigrateSynapseToFabricSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    resourceGroup: z.ZodString;
    synapseWorkspaceName: z.ZodString;
    targetWorkspaceId: z.ZodString;
    targetLakehouseName: z.ZodOptional<z.ZodString>;
    sparkPoolName: z.ZodOptional<z.ZodString>;
    dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    createShortcuts: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    createShortcuts: boolean;
    dryRun: boolean;
    subscriptionId: string;
    resourceGroup: string;
    synapseWorkspaceName: string;
    targetWorkspaceId: string;
    targetLakehouseName?: string | undefined;
    sparkPoolName?: string | undefined;
}, {
    subscriptionId: string;
    resourceGroup: string;
    synapseWorkspaceName: string;
    targetWorkspaceId: string;
    targetLakehouseName?: string | undefined;
    createShortcuts?: boolean | undefined;
    dryRun?: boolean | undefined;
    sparkPoolName?: string | undefined;
}>;
export declare const CreateFabricLakehouseSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    lakehouseName: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    lakehouseName: string;
    description?: string | undefined;
}, {
    workspaceId: string;
    lakehouseName: string;
    description?: string | undefined;
}>;
export declare const ProvisionNotebooksSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    transformedNotebooksJson: z.ZodString;
    lakehouseId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    transformedNotebooksJson: string;
    lakehouseId?: string | undefined;
}, {
    workspaceId: string;
    transformedNotebooksJson: string;
    lakehouseId?: string | undefined;
}>;
export declare const ListFabricCapacitiesSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const AssignCapacityToWorkspaceSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    capacityId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    capacityId?: string | undefined;
}, {
    workspaceId: string;
    capacityId?: string | undefined;
}>;
export declare const GetSynapseSparkPoolsSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    resourceGroup: z.ZodString;
    workspaceName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
}, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
}>;
export declare const CreateFabricSparkPoolsSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    capacitySku: z.ZodString;
    synapsePoolsJson: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    capacitySku: string;
    synapsePoolsJson?: string | undefined;
}, {
    workspaceId: string;
    capacitySku: string;
    synapsePoolsJson?: string | undefined;
}>;
export declare const SynapseWorkspaceDetailsSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    resourceGroup: z.ZodString;
    workspaceName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
}, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
}>;
export declare const SynapseComputeSpendSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    resourceGroup: z.ZodString;
    workspaceName: z.ZodString;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
export declare const ListSynapseSparkPoolsSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    resourceGroup: z.ZodString;
    workspaceName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
}, {
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
}>;
export declare const MigrateSparkPoolsToFabricSchema: z.ZodObject<{
    synapseSparkPoolsJson: z.ZodString;
    targetCapacitySku: z.ZodString;
    workspaceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    synapseSparkPoolsJson: string;
    targetCapacitySku: string;
}, {
    workspaceId: string;
    synapseSparkPoolsJson: string;
    targetCapacitySku: string;
}>;
export declare const RecommendFabricCapacitySchema: z.ZodObject<{
    synapseComputeSummaryJson: z.ZodString;
    minSku: z.ZodOptional<z.ZodString>;
    maxSku: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    synapseComputeSummaryJson: string;
    minSku?: string | undefined;
    maxSku?: string | undefined;
}, {
    synapseComputeSummaryJson: string;
    minSku?: string | undefined;
    maxSku?: string | undefined;
}>;
/**
 * List available Synapse workspaces
 */
export declare function listSynapseWorkspaces(params: z.infer<typeof ListSynapseWorkspacesSchema>): Promise<{
    count: number;
    workspaces: {
        name: any;
        id: any;
        location: any;
        resourceGroup: any;
        managedResourceGroupName: any;
    }[];
}>;
/**
 * Discover assets from Synapse workspace
 */
export declare function discoverSynapseWorkspace(params: z.infer<typeof DiscoverSynapseWorkspaceSchema>): Promise<{
    source: {
        workspaceName: string;
        resourceGroup: string;
    };
    summary: {
        notebooks: number;
        pipelines: number;
        linkedServices: number;
        sparkJobs: number;
    };
    notebooks: {
        name: string;
        path: string;
        id: string;
    }[];
    pipelines: {
        name: string;
        id: string;
    }[];
    linkedServices: {
        name: string;
        type: string;
        id: string;
    }[];
    sparkJobs: {
        name: string;
        scriptPath: string | undefined;
        id: string;
    }[];
    inventoryJson: string;
    discoveredAt: Date;
}>;
/**
 * Transform notebooks (can be used standalone after discovery)
 */
export declare function transformNotebooks(params: z.infer<typeof TransformNotebooksSchema>): Promise<{
    summary: {
        total: number;
        successful: number;
        failed: number;
        totalChanges: number;
    };
    results: {
        notebookName: string;
        success: boolean;
        changesCount: number;
        errors: string[] | undefined;
        warnings: string[] | undefined;
    }[];
    report: string;
    resultsJson: string;
}>;
/**
 * Execute complete migration from Synapse to Fabric
 */
export declare function migrateSynapseToFabric(params: z.infer<typeof MigrateSynapseToFabricSchema>): Promise<{
    status: string;
    summary: {
        totalAssets: number;
        successful: number;
        failed: number;
        requiresManualReview: number;
        duration: number;
    };
    details: {
        assetName: string;
        assetType: string;
        status: "success" | "failed" | "manual_review";
        fabricItemId: string | undefined;
        changesCount: number;
        warningsCount: number;
        error: string | undefined;
    }[];
    recommendations: string[];
    reportMarkdown: string;
    generatedAt: Date;
}>;
/**
 * Create a lakehouse in Fabric workspace
 */
export declare function createFabricLakehouse(params: z.infer<typeof CreateFabricLakehouseSchema>): Promise<{
    success: boolean;
    workspaceId: string;
    lakehouseName: string;
    lakehouseId: string;
    message: string;
    fabricUrl: string;
}>;
/**
 * Provision transformed notebooks to Fabric workspace
 */
export declare function provisionNotebooks(params: z.infer<typeof ProvisionNotebooksSchema>): Promise<{
    success: boolean;
    workspaceId: string;
    notebooksProvisioned: number;
    notebooks: {
        name: string;
        fabricId: string;
        url: string;
    }[];
    message: string;
}>;
/**
 * List all available Fabric capacities
 */
export declare function listFabricCapacities(params: z.infer<typeof ListFabricCapacitiesSchema>): Promise<{
    count: number;
    capacities: {
        id: any;
        displayName: any;
        sku: any;
        state: any;
        region: any;
        sparkVCores: any;
        maxSparkVCoresWithBurst: any;
    }[];
}>;
/**
 * Assign capacity to Fabric workspace
 */
export declare function assignCapacityToWorkspace(params: z.infer<typeof AssignCapacityToWorkspaceSchema>): Promise<{
    success: boolean;
    workspaceId: string;
    capacityId: string;
    message: string;
}>;
/**
 * Get Synapse Spark pool configurations
 */
export declare function getSynapseSparkPools(params: z.infer<typeof GetSynapseSparkPoolsSchema>): Promise<{
    count: number;
    pools: {
        name: any;
        nodeSize: any;
        nodeCount: any;
        autoScale: any;
        autoPause: any;
        sparkVersion: any;
    }[];
}>;
/**
 * Create equivalent Fabric Spark pools based on capacity
 */
export declare function createFabricSparkPools(params: z.infer<typeof CreateFabricSparkPoolsSchema>): Promise<{
    success: boolean;
    capacitySku: string;
    recommendations: import("./spark-pool-tools.js").FabricSparkPoolRecommendation[];
    message: string;
}>;
/**
 * Tool definitions for MCP server registration
 */
export declare const migrationTools: {
    fabric_list_synapse_workspaces: {
        schema: z.ZodObject<{
            subscriptionId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            subscriptionId?: string | undefined;
        }, {
            subscriptionId?: string | undefined;
        }>;
        handler: typeof listSynapseWorkspaces;
        description: string;
    };
    fabric_discover_synapse_workspace: {
        schema: z.ZodObject<{
            subscriptionId: z.ZodString;
            resourceGroup: z.ZodString;
            workspaceName: z.ZodString;
            sparkPoolName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
            sparkPoolName?: string | undefined;
        }, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
            sparkPoolName?: string | undefined;
        }>;
        handler: typeof discoverSynapseWorkspace;
        description: string;
    };
    fabric_transform_notebooks: {
        schema: z.ZodObject<{
            inventoryJson: z.ZodString;
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            customRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                pattern: z.ZodString;
                replacement: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                replacement: string;
                pattern: string;
                description?: string | undefined;
            }, {
                name: string;
                replacement: string;
                pattern: string;
                description?: string | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            dryRun: boolean;
            inventoryJson: string;
            customRules?: {
                name: string;
                replacement: string;
                pattern: string;
                description?: string | undefined;
            }[] | undefined;
        }, {
            inventoryJson: string;
            dryRun?: boolean | undefined;
            customRules?: {
                name: string;
                replacement: string;
                pattern: string;
                description?: string | undefined;
            }[] | undefined;
        }>;
        handler: typeof transformNotebooks;
        description: string;
    };
    fabric_migrate_synapse_to_fabric: {
        schema: z.ZodObject<{
            subscriptionId: z.ZodString;
            resourceGroup: z.ZodString;
            synapseWorkspaceName: z.ZodString;
            targetWorkspaceId: z.ZodString;
            targetLakehouseName: z.ZodOptional<z.ZodString>;
            sparkPoolName: z.ZodOptional<z.ZodString>;
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            createShortcuts: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            createShortcuts: boolean;
            dryRun: boolean;
            subscriptionId: string;
            resourceGroup: string;
            synapseWorkspaceName: string;
            targetWorkspaceId: string;
            targetLakehouseName?: string | undefined;
            sparkPoolName?: string | undefined;
        }, {
            subscriptionId: string;
            resourceGroup: string;
            synapseWorkspaceName: string;
            targetWorkspaceId: string;
            targetLakehouseName?: string | undefined;
            createShortcuts?: boolean | undefined;
            dryRun?: boolean | undefined;
            sparkPoolName?: string | undefined;
        }>;
        handler: typeof migrateSynapseToFabric;
        description: string;
    };
    fabric_create_lakehouse: {
        schema: z.ZodObject<{
            workspaceId: z.ZodString;
            lakehouseName: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            lakehouseName: string;
            description?: string | undefined;
        }, {
            workspaceId: string;
            lakehouseName: string;
            description?: string | undefined;
        }>;
        handler: typeof createFabricLakehouse;
        description: string;
    };
    fabric_provision_notebooks: {
        schema: z.ZodObject<{
            workspaceId: z.ZodString;
            transformedNotebooksJson: z.ZodString;
            lakehouseId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            transformedNotebooksJson: string;
            lakehouseId?: string | undefined;
        }, {
            workspaceId: string;
            transformedNotebooksJson: string;
            lakehouseId?: string | undefined;
        }>;
        handler: typeof provisionNotebooks;
        description: string;
    };
    fabric_list_capacities: {
        schema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        handler: typeof listFabricCapacities;
        description: string;
    };
    fabric_assign_capacity: {
        schema: z.ZodObject<{
            workspaceId: z.ZodString;
            capacityId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            capacityId?: string | undefined;
        }, {
            workspaceId: string;
            capacityId?: string | undefined;
        }>;
        handler: typeof assignCapacityToWorkspace;
        description: string;
    };
    fabric_get_synapse_spark_pools: {
        schema: z.ZodObject<{
            subscriptionId: z.ZodString;
            resourceGroup: z.ZodString;
            workspaceName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
        }, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
        }>;
        handler: typeof getSynapseSparkPools;
        description: string;
    };
    fabric_create_fabric_spark_pools: {
        schema: z.ZodObject<{
            workspaceId: z.ZodString;
            capacitySku: z.ZodString;
            synapsePoolsJson: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            capacitySku: string;
            synapsePoolsJson?: string | undefined;
        }, {
            workspaceId: string;
            capacitySku: string;
            synapsePoolsJson?: string | undefined;
        }>;
        handler: typeof createFabricSparkPools;
        description: string;
    };
    fabric_synapse_workspace_details: {
        schema: z.ZodObject<{
            subscriptionId: z.ZodString;
            resourceGroup: z.ZodString;
            workspaceName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
        }, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
        }>;
        handler: (params: z.infer<typeof SynapseWorkspaceDetailsSchema>) => Promise<any>;
        description: string;
    };
    fabric_synapse_compute_spend: {
        schema: z.ZodObject<{
            subscriptionId: z.ZodString;
            resourceGroup: z.ZodString;
            workspaceName: z.ZodString;
            startDate: z.ZodOptional<z.ZodString>;
            endDate: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
            startDate?: string | undefined;
            endDate?: string | undefined;
        }, {
            subscriptionId: string;
            resourceGroup: string;
            workspaceName: string;
            startDate?: string | undefined;
            endDate?: string | undefined;
        }>;
        handler: (params: z.infer<typeof SynapseComputeSpendSchema>) => Promise<any>;
        description: string;
    };
    fabric_migrate_spark_pools_to_fabric: {
        schema: z.ZodObject<{
            synapseSparkPoolsJson: z.ZodString;
            targetCapacitySku: z.ZodString;
            workspaceId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            synapseSparkPoolsJson: string;
            targetCapacitySku: string;
        }, {
            workspaceId: string;
            synapseSparkPoolsJson: string;
            targetCapacitySku: string;
        }>;
        handler: (params: z.infer<typeof MigrateSparkPoolsToFabricSchema>) => Promise<any>;
        description: string;
    };
    fabric_recommend_fabric_capacity: {
        schema: z.ZodObject<{
            synapseComputeSummaryJson: z.ZodString;
            minSku: z.ZodOptional<z.ZodString>;
            maxSku: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            synapseComputeSummaryJson: string;
            minSku?: string | undefined;
            maxSku?: string | undefined;
        }, {
            synapseComputeSummaryJson: string;
            minSku?: string | undefined;
            maxSku?: string | undefined;
        }>;
        handler: (params: z.infer<typeof RecommendFabricCapacitySchema>) => Promise<any>;
        description: string;
    };
};
