/**
 * Fabric Provisioning Module
 * Provisions transformed notebooks and resources to Microsoft Fabric
 */
import { TransformationResult, ProvisioningPlan, MigrationConfig } from './types.js';
export declare class FabricProvisioner {
    private workspaceId;
    private lakehouseId?;
    private config;
    private accessToken;
    constructor(workspaceId: string, config?: Partial<MigrationConfig>);
    /**
     * Get Fabric API access token
     */
    private getAccessToken;
    /**
     * Create provisioning plan from transformation results
     */
    createProvisioningPlan(results: TransformationResult[]): ProvisioningPlan;
    /**
     * Provision transformed notebooks to Fabric workspace
     */
    provisionNotebooks(results: TransformationResult[]): Promise<Map<string, string>>;
    /**
     * Create a notebook in Fabric workspace
     */
    private createNotebook;
    /**
     * Create or get lakehouse
     */
    createLakehouse(name: string): Promise<string>;
    /**
     * Create OneLake shortcut
     */
    createShortcut(sourcePath: string, targetPath: string, shortcutName: string): Promise<void>;
    /**
     * Execute complete provisioning plan
     */
    executeProvisioningPlan(plan: ProvisioningPlan): Promise<Map<string, string>>;
    /**
     * Validate provisioned items
     */
    validateProvisionedItems(itemIds: Map<string, string>): Promise<{
        valid: boolean;
        issues: string[];
    }>;
}
