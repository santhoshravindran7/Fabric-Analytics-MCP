/**
 * Fabric Capacity Management Tools
 * Handles capacity listing, assignment, and SKU calculations
 */

import { execSync } from 'child_process';

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

// Capacity SKU specifications based on Microsoft documentation
const CAPACITY_SPECS: Record<string, { sparkVCores: number; burstFactor: number; queueLimit: number }> = {
  'F2': { sparkVCores: 4, burstFactor: 5, queueLimit: 4 },
  'F4': { sparkVCores: 8, burstFactor: 3, queueLimit: 4 },
  'F8': { sparkVCores: 16, burstFactor: 3, queueLimit: 8 },
  'F16': { sparkVCores: 32, burstFactor: 3, queueLimit: 16 },
  'F32': { sparkVCores: 64, burstFactor: 3, queueLimit: 32 },
  'F64': { sparkVCores: 128, burstFactor: 3, queueLimit: 64 },
  'F128': { sparkVCores: 256, burstFactor: 3, queueLimit: 128 },
  'F256': { sparkVCores: 512, burstFactor: 3, queueLimit: 256 },
  'F512': { sparkVCores: 1024, burstFactor: 3, queueLimit: 512 },
  'F1024': { sparkVCores: 2048, burstFactor: 3, queueLimit: 1024 },
  'F2048': { sparkVCores: 4096, burstFactor: 3, queueLimit: 2048 },
  'FT1': { sparkVCores: 128, burstFactor: 1, queueLimit: 0 }, // Trial
  'P1': { sparkVCores: 128, burstFactor: 3, queueLimit: 64 },
  'P2': { sparkVCores: 256, burstFactor: 3, queueLimit: 128 },
  'P3': { sparkVCores: 512, burstFactor: 3, queueLimit: 256 },
  'P4': { sparkVCores: 1024, burstFactor: 3, queueLimit: 512 },
  'P5': { sparkVCores: 2048, burstFactor: 3, queueLimit: 1024 }
};

export class CapacityManager {
  private async getAccessToken(): Promise<string> {
    const tokenOutput = execSync(
      'az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv',
      { encoding: 'utf-8' }
    );
    return tokenOutput.trim();
  }

  /**
   * Get Spark VCore specifications for a capacity SKU
   */
  public getCapacitySpecs(sku: string): { sparkVCores: number; maxSparkVCoresWithBurst: number; queueLimit: number } {
    const specs = CAPACITY_SPECS[sku];
    if (!specs) {
      throw new Error(`Unknown capacity SKU: ${sku}`);
    }
    
    return {
      sparkVCores: specs.sparkVCores,
      maxSparkVCoresWithBurst: specs.sparkVCores * specs.burstFactor,
      queueLimit: specs.queueLimit
    };
  }

  /**
   * List all available Fabric capacities
   */
  public async listCapacities(): Promise<FabricCapacity[]> {
    const token = await this.getAccessToken();
    
    const response = await fetch('https://api.fabric.microsoft.com/v1/capacities', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to list capacities: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const capacities = data.value || [];

    return capacities.map((cap: any) => {
      const specs = this.getCapacitySpecs(cap.sku);
      return {
        id: cap.id,
        displayName: cap.displayName || cap.sku,
        sku: cap.sku,
        state: cap.state,
        region: cap.region,
        sparkVCores: specs.sparkVCores,
        maxSparkVCoresWithBurst: specs.maxSparkVCoresWithBurst,
        queueLimit: specs.queueLimit
      };
    });
  }

  /**
   * Select the best (largest) capacity from available list
   */
  public selectBestCapacity(capacities: FabricCapacity[]): FabricCapacity {
    const active = capacities.filter(c => c.state === 'Active');
    
    if (active.length === 0) {
      throw new Error('No active capacities available');
    }

    // Sort by Spark VCores descending
    active.sort((a, b) => b.sparkVCores - a.sparkVCores);
    return active[0];
  }

  /**
   * Assign capacity to a workspace
   */
  public async assignCapacity(workspaceId: string, capacityId: string): Promise<void> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/assignToCapacity`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ capacityId })
      }
    );

    if (!response.ok && response.status !== 200) {
      throw new Error(`Failed to assign capacity: ${response.status} ${await response.text()}`);
    }

    console.error(`✅ Successfully assigned capacity ${capacityId} to workspace ${workspaceId}`);
  }

  /**
   * Get workspace capacity assignment
   */
  public async getWorkspaceCapacity(workspaceId: string): Promise<string | null> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to get workspace: ${response.status} ${await response.text()}`);
    }

    const workspace = await response.json();
    return workspace.capacityId || null;
  }
}
