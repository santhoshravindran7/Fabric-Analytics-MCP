/**
 * Synapse Discovery Module
 * Discovers and inventories Synapse workspace assets for migration
 */
import { MigrationInventory, SynapseSource } from './types.js';
export declare class SynapseDiscovery {
    private accessToken;
    /**
     * Get Azure access token for Synapse REST API
     */
    private getAccessToken;
    /**
     * List all Synapse workspaces in subscription
     */
    listWorkspaces(subscriptionId?: string): Promise<any[]>;
    /**
     * Get current Azure subscription
     */
    private getCurrentSubscription;
    /**
     * Discover all assets from a Synapse workspace
     */
    discoverWorkspace(source: SynapseSource): Promise<MigrationInventory>;
    /**
     * Discover notebooks from Synapse workspace
     */
    private discoverNotebooks;
    /**
     * Discover pipelines from Synapse workspace
     */
    private discoverPipelines;
    /**
     * Discover linked services from Synapse workspace
     */
    private discoverLinkedServices;
    /**
     * Discover Spark job definitions from Synapse workspace
     */
    private discoverSparkJobs;
    /**
     * Export inventory to JSON file
     */
    exportInventory(inventory: MigrationInventory, outputPath: string): Promise<void>;
}
