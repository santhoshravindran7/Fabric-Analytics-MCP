/**
 * Migration Orchestrator
 * Coordinates the end-to-end migration process
 */
import { SynapseSource, MigrationInventory, TransformationResult, MigrationReport, MigrationConfig } from './types.js';
export declare class MigrationOrchestrator {
    /**
     * Fetch Fabric pricing from Azure Retail Prices API
     * Fabric pricing is based on Capacity Units (CU) at a standard rate per hour
     */
    private getFabricPricing;
    /**
     * Fallback pricing based on known Fabric rates (as of Nov 2024)
     * Source: https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/
     */
    private getFallbackFabricPricing;
    /**
     * Get Synapse workspace details with full asset inventory
     */
    getSynapseWorkspaceDetails(subscriptionId: string, resourceGroup: string, workspaceName: string): Promise<any>;
    /**
     * Get Synapse compute spend summary using Azure Cost Management API
     */
    getSynapseComputeSpend(subscriptionId: string, resourceGroup: string, workspaceName: string, startDate?: string, endDate?: string): Promise<any>;
    /**
     * Migrate Spark pools to Fabric with full conversion and validation
     */
    migrateSparkPoolsToFabric(sparkPools: any[], targetCapacitySku: string, workspaceId: string): Promise<any>;
    /**
     * Recommend Fabric capacity based on Synapse compute usage and spend
     */
    recommendFabricCapacity(synapseComputeSummary: any, minSku?: string, maxSku?: string): Promise<any>;
    private config;
    private discovery;
    private transformer;
    private provisioner?;
    constructor(config: MigrationConfig);
    /**
     * Execute full migration workflow
     */
    executeMigration(source: SynapseSource, targetWorkspaceId: string): Promise<MigrationReport>;
    /**
     * Generate comprehensive migration report
     */
    private generateMigrationReport;
    /**
     * Discover only (no transformation or provisioning)
     */
    discoverOnly(source: SynapseSource): Promise<MigrationInventory>;
    /**
     * Transform only (no provisioning)
     */
    transformOnly(inventory: MigrationInventory): Promise<TransformationResult[]>;
    /**
     * Generate transformation report
     */
    generateTransformationReport(results: TransformationResult[]): string;
    /**
     * List available Synapse workspaces
     */
    listSynapseWorkspaces(subscriptionId?: string): Promise<any[]>;
}
