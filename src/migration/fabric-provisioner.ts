/**
 * Fabric Provisioning Module
 * Provisions transformed notebooks and resources to Microsoft Fabric
 */

import {
  TransformationResult,
  ProvisioningPlan,
  ProvisioningItem,
  MigrationConfig
} from './types.js';

export class FabricProvisioner {
  private workspaceId: string;
  private lakehouseId?: string;
  private config: MigrationConfig;
  private accessToken: string | null = null;

  constructor(workspaceId: string, config?: Partial<MigrationConfig>) {
    this.workspaceId = workspaceId;
    this.config = {
      dryRun: config?.dryRun ?? false,
      createShortcuts: config?.createShortcuts ?? true,
      validateTransformation: config?.validateTransformation ?? true,
      ...config
    };
  }

  /**
   * Get Fabric API access token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(
        'az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken --output tsv'
      );
      const token = stdout.trim();
      this.accessToken = token;
      return token;
    } catch (error) {
      throw new Error(`Failed to get Fabric access token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create provisioning plan from transformation results
   */
  createProvisioningPlan(results: TransformationResult[]): ProvisioningPlan {
    const items: ProvisioningItem[] = [];

    // Group successful transformations
    const successful = results.filter(r => r.success);

    // Create lakehouse item if needed
    if (this.config.targetLakehouseName && this.config.createShortcuts) {
      items.push({
        type: 'lakehouse',
        name: this.config.targetLakehouseName,
        sourceAsset: null,
        dependencies: []
      });
    }

    // Create notebook items
    for (const result of successful) {
      items.push({
        type: 'notebook',
        name: result.notebookName,
        sourceAsset: { id: result.notebookId || result.notebookName, content: result.originalContent },
        transformedContent: result.transformedContent,
        dependencies: this.config.targetLakehouseName ? [this.config.targetLakehouseName] : []
      });
    }

    return {
      targetWorkspaceId: this.workspaceId,
      items,
      dryRun: this.config.dryRun ?? false
    };
  }

  /**
   * Provision transformed notebooks to Fabric workspace
   */
  async provisionNotebooks(results: TransformationResult[]): Promise<Map<string, string>> {
    console.error(`📦 Provisioning ${results.length} notebooks to Fabric workspace ${this.workspaceId}`);

    const notebookIds = new Map<string, string>();
    const token = await this.getAccessToken();
    const successfulResults = results.filter(r => r.success);

    if (this.config.dryRun) {
      console.error('🏃 DRY RUN MODE: No actual provisioning will occur');
      successfulResults.forEach(result => {
        const dryRunId = `dryrun-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        notebookIds.set(result.notebookName, dryRunId);
        console.error(`  ✅ [DRY RUN] Would create notebook: ${result.notebookName}`);
      });
      return notebookIds;
    }

    // Provision each notebook
    for (const result of successfulResults) {
      try {
        const notebookId = await this.createNotebook(
          result.notebookName,
          result.transformedContent,
          token
        );

        notebookIds.set(result.notebookName, notebookId);
        console.error(`  ✅ Provisioned notebook: ${result.notebookName} (${notebookId})`);

      } catch (error) {
        console.error(`  ❌ Failed to provision ${result.notebookName}:`, error);
      }
    }

    console.error(`✅ Provisioning complete: ${notebookIds.size}/${successfulResults.length} successful`);
    return notebookIds;
  }

  /**
   * Create a notebook in Fabric workspace
   */
  private async createNotebook(
    name: string,
    content: any,
    token: string
  ): Promise<string> {
    // Use the generic /items endpoint for creating notebooks
    const apiUrl = `https://api.fabric.microsoft.com/v1/workspaces/${this.workspaceId}/items`;

    // Append timestamp to avoid name collisions
    const uniqueName = this.config.dryRun ? name : `${name}-migrated`;

    // Create notebook with definition in a single call
    const createPayload = {
      displayName: uniqueName,
      type: 'Notebook',
      definition: {
        format: 'ipynb',
        parts: [
          {
            path: 'notebook-content.ipynb',
            payload: Buffer.from(JSON.stringify(content)).toString('base64'),
            payloadType: 'InlineBase64'
          }
        ]
      }
    };

    const createResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createPayload)
    });

    if (createResponse.status === 202) {
      // Async operation - poll for result
      const operationLocation = createResponse.headers.get('location');
      const retryAfter = parseInt(createResponse.headers.get('retry-after') || '5');
      
      console.error(`  ⏳ Waiting for notebook creation (${retryAfter}s)...`);
      
      // Poll for result
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        attempts++;
        
        const pollResponse = await fetch(`${operationLocation}/result`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (pollResponse.ok) {
          const result = await pollResponse.json();
          return result.id;
        } else if (pollResponse.status !== 202) {
          throw new Error(`Polling failed: HTTP ${pollResponse.status} ${await pollResponse.text()}`);
        }
        // Continue polling if still 202
      }
      
      throw new Error('Operation timed out after polling');
    } else if (!createResponse.ok) {
      throw new Error(`Failed to create notebook: HTTP ${createResponse.status} ${await createResponse.text()}`);
    }

    const notebookItem = await createResponse.json();
    return notebookItem.id;
  }

  /**
   * Create or get lakehouse
   */
  async createLakehouse(name: string): Promise<string> {
    console.error(`🏗️ Creating lakehouse: ${name}`);

    if (this.config.dryRun) {
      const dryRunId = `dryrun-lakehouse-${Date.now()}`;
      console.error(`  ✅ [DRY RUN] Would create lakehouse: ${name}`);
      return dryRunId;
    }

    const token = await this.getAccessToken();
    // Use the generic /items endpoint for creating lakehouses
    const apiUrl = `https://api.fabric.microsoft.com/v1/workspaces/${this.workspaceId}/items`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        displayName: name,
        type: 'Lakehouse',
        description: `Lakehouse for Synapse migration - ${new Date().toISOString()}`
      })
    });

    if (response.status === 202) {
      // Async operation - poll for result
      const operationLocation = response.headers.get('location');
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      
      console.error(`  ⏳ Waiting for lakehouse creation (${retryAfter}s)...`);
      
      // Poll for result
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        attempts++;
        
        const pollResponse = await fetch(`${operationLocation}/result`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (pollResponse.ok) {
          const lakehouse = await pollResponse.json();
          this.lakehouseId = lakehouse.id;
          console.error(`  ✅ Created lakehouse: ${name} (${lakehouse.id})`);
          return lakehouse.id;
        } else if (pollResponse.status !== 202) {
          throw new Error(`Polling failed: HTTP ${pollResponse.status} ${await pollResponse.text()}`);
        }
        // Continue polling if still 202
      }
      
      throw new Error('Lakehouse creation timed out after polling');
    } else if (!response.ok) {
      throw new Error(`Failed to create lakehouse: HTTP ${response.status} ${await response.text()}`);
    }

    const lakehouse = await response.json();
    this.lakehouseId = lakehouse.id;

    console.error(`  ✅ Created lakehouse: ${name} (${lakehouse.id})`);
    return lakehouse.id;
  }

  /**
   * Create OneLake shortcut
   */
  async createShortcut(
    sourcePath: string,
    targetPath: string,
    shortcutName: string
  ): Promise<void> {
    if (!this.lakehouseId) {
      throw new Error('Lakehouse must be created before creating shortcuts');
    }

    console.error(`🔗 Creating OneLake shortcut: ${shortcutName}`);

    if (this.config.dryRun) {
      console.error(`  ✅ [DRY RUN] Would create shortcut from ${sourcePath} to ${targetPath}`);
      return;
    }

    const token = await this.getAccessToken();
    const apiUrl = `https://api.fabric.microsoft.com/v1/workspaces/${this.workspaceId}/items/${this.lakehouseId}/shortcuts`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: shortcutName,
        path: targetPath,
        target: {
          type: 'AdlsGen2',
          adlsGen2: {
            location: sourcePath,
            subpath: '/'
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create shortcut: HTTP ${response.status} ${await response.text()}`);
    }

    console.error(`  ✅ Created shortcut: ${shortcutName}`);
  }

  /**
   * Execute complete provisioning plan
   */
  async executeProvisioningPlan(plan: ProvisioningPlan): Promise<Map<string, string>> {
    console.error(`🚀 Executing provisioning plan: ${plan.items.length} items`);

    const provisionedIds = new Map<string, string>();

    // Phase 1: Create lakehouse if needed
    const lakehouseItems = plan.items.filter(item => item.type === 'lakehouse');
    for (const item of lakehouseItems) {
      try {
        const lakehouseId = await this.createLakehouse(item.name);
        provisionedIds.set(item.name, lakehouseId);
      } catch (error) {
        console.error(`Failed to create lakehouse ${item.name}:`, error);
      }
    }

    // Phase 2: Create shortcuts if needed
    const shortcutItems = plan.items.filter(item => item.type === 'shortcut');
    for (const item of shortcutItems) {
      try {
        // Shortcut creation logic would go here
        console.error(`📌 Shortcut provisioning not yet implemented for: ${item.name}`);
      } catch (error) {
        console.error(`Failed to create shortcut ${item.name}:`, error);
      }
    }

    // Phase 3: Create notebooks
    const notebookItems = plan.items.filter(item => item.type === 'notebook');
    for (const item of notebookItems) {
      try {
        const notebookId = await this.createNotebook(
          item.name,
          item.transformedContent,
          await this.getAccessToken()
        );
        provisionedIds.set(item.name, notebookId);
      } catch (error) {
        console.error(`Failed to provision notebook ${item.name}:`, error);
      }
    }

    console.error(`✅ Provisioning plan complete: ${provisionedIds.size}/${plan.items.length} items provisioned`);
    return provisionedIds;
  }

  /**
   * Validate provisioned items
   */
  async validateProvisionedItems(itemIds: Map<string, string>): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (this.config.dryRun) {
      return { valid: true, issues: ['Dry run mode - validation skipped'] };
    }

    const token = await this.getAccessToken();

    for (const [name, id] of itemIds.entries()) {
      try {
        // Try to fetch the item to validate it exists
        const url = `https://api.fabric.microsoft.com/v1/workspaces/${this.workspaceId}/notebooks/${id}`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          issues.push(`Item ${name} (${id}) not found or inaccessible`);
        }
      } catch (error) {
        issues.push(`Failed to validate ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
