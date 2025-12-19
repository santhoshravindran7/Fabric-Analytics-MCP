/**
 * Spark Pool Management Tools
 * Handles Synapse Spark pool discovery and Fabric Spark pool conversion
 */
export interface SynapseSparkPool {
    id: string;
    name: string;
    nodeSize: string;
    nodeCount: number;
    autoScale: {
        enabled: boolean;
        minNodeCount?: number;
        maxNodeCount?: number;
    };
    autoPause: {
        enabled: boolean;
        delayInMinutes?: number;
    };
    sparkVersion: string;
    dynamicExecutorAllocation?: {
        enabled: boolean;
        minExecutors?: number;
        maxExecutors?: number;
    };
}
export interface FabricSparkPoolRecommendation {
    synapsePoolName: string;
    recommendedConfig: {
        driverCores: number;
        driverMemory: string;
        executorCores: number;
        executorMemory: string;
        dynamicAllocation: boolean;
        minExecutors?: number;
        maxExecutors?: number;
    };
    notes: string[];
}
export declare class SparkPoolManager {
    private getAzureAccessToken;
    /**
     * List all Spark pools in a Synapse workspace
     */
    listSynapseSparkPools(subscriptionId: string, resourceGroup: string, workspaceName: string): Promise<SynapseSparkPool[]>;
    /**
     * Convert Synapse Spark pools to Fabric Spark recommendations
     * Formula: 1 Synapse VCore = 2 Fabric VCores per CU
     * Fabric capacities get 3X burst factor
     */
    convertSynapseToFabricPools(synapsePools: SynapseSparkPool[], capacitySku: string): FabricSparkPoolRecommendation[];
    /**
     * Validate if capacity can support the converted Spark pools
     */
    validateCapacityForPools(recommendations: FabricSparkPoolRecommendation[], capacitySparkVCores: number, capacityMaxBurst: number): {
        canSupport: boolean;
        warnings: string[];
    };
}
