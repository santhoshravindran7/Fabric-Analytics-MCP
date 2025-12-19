/**
 * Fabric Capacity Management Tools
 * Handles capacity listing, assignment, and SKU calculations
 */
export interface FabricCapacity {
    id: string;
    displayName: string;
    sku: string;
    state: string;
    region: string;
    sparkVCores: number;
    maxSparkVCoresWithBurst: number;
    queueLimit?: number;
}
export declare class CapacityManager {
    private getAccessToken;
    /**
     * Get Spark VCore specifications for a capacity SKU
     */
    getCapacitySpecs(sku: string): {
        sparkVCores: number;
        maxSparkVCoresWithBurst: number;
        queueLimit: number;
    };
    /**
     * List all available Fabric capacities
     */
    listCapacities(): Promise<FabricCapacity[]>;
    /**
     * Select the best (largest) capacity from available list
     */
    selectBestCapacity(capacities: FabricCapacity[]): FabricCapacity;
    /**
     * Assign capacity to a workspace
     */
    assignCapacity(workspaceId: string, capacityId: string): Promise<void>;
    /**
     * Get workspace capacity assignment
     */
    getWorkspaceCapacity(workspaceId: string): Promise<string | null>;
}
