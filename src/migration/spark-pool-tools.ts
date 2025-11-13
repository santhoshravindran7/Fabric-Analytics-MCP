/**
 * Spark Pool Management Tools
 * Handles Synapse Spark pool discovery and Fabric Spark pool conversion
 */

import { execSync } from 'child_process';

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

// Synapse node size to vCore mapping
const NODE_SIZE_VCORES: Record<string, number> = {
  'Small': 4,
  'Medium': 8,
  'Large': 16,
  'XLarge': 32,
  'XXLarge': 64
};

export class SparkPoolManager {
  private async getAzureAccessToken(): Promise<string> {
    const tokenOutput = execSync(
      'az account get-access-token --resource https://management.azure.com --query accessToken -o tsv',
      { encoding: 'utf-8' }
    );
    return tokenOutput.trim();
  }

  /**
   * List all Spark pools in a Synapse workspace
   */
  public async listSynapseSparkPools(
    subscriptionId: string,
    resourceGroup: string,
    workspaceName: string
  ): Promise<SynapseSparkPool[]> {
    const token = await this.getAzureAccessToken();
    const apiVersion = '2021-06-01';
    
    const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Synapse/workspaces/${workspaceName}/bigDataPools?api-version=${apiVersion}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to list Synapse Spark pools: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const pools = data.value || [];

    return pools.map((pool: any) => ({
      id: pool.id,
      name: pool.name,
      nodeSize: pool.properties?.nodeSize || 'Medium',
      nodeCount: pool.properties?.nodeCount || 3,
      autoScale: {
        enabled: pool.properties?.autoScale?.enabled || false,
        minNodeCount: pool.properties?.autoScale?.minNodeCount,
        maxNodeCount: pool.properties?.autoScale?.maxNodeCount
      },
      autoPause: {
        enabled: pool.properties?.autoPause?.enabled || false,
        delayInMinutes: pool.properties?.autoPause?.delayInMinutes
      },
      sparkVersion: pool.properties?.sparkVersion || '3.3',
      dynamicExecutorAllocation: {
        enabled: pool.properties?.dynamicExecutorAllocation?.enabled || false,
        minExecutors: pool.properties?.dynamicExecutorAllocation?.minExecutors,
        maxExecutors: pool.properties?.dynamicExecutorAllocation?.maxExecutors
      }
    }));
  }

  /**
   * Convert Synapse Spark pools to Fabric Spark recommendations
   * Formula: 1 Synapse VCore = 2 Fabric VCores per CU
   * Fabric capacities get 3X burst factor
   */
  public convertSynapseToFabricPools(
    synapsePools: SynapseSparkPool[],
    capacitySku: string
  ): FabricSparkPoolRecommendation[] {
    const recommendations: FabricSparkPoolRecommendation[] = [];

    for (const pool of synapsePools) {
      const nodeVCores = NODE_SIZE_VCORES[pool.nodeSize] || 8; // Default to Medium
      const synapseVCores = pool.autoScale.enabled 
        ? (pool.autoScale.maxNodeCount || pool.nodeCount) * nodeVCores
        : pool.nodeCount * nodeVCores;

      // Convert to Fabric VCores: 1 Synapse VCore = 2 Fabric VCores
      const fabricVCores = synapseVCores * 2;

      // Determine executor configuration
      // Use 4 cores per executor as best practice
      const executorCores = 4;
      const maxExecutors = Math.floor(fabricVCores / executorCores);
      const minExecutors = pool.autoScale.enabled 
        ? Math.floor(((pool.autoScale.minNodeCount || 1) * nodeVCores * 2) / executorCores)
        : Math.floor(maxExecutors / 2);

      const notes: string[] = [];
      notes.push(`Synapse: ${pool.nodeCount} × ${pool.nodeSize} nodes (${nodeVCores} vCores/node) = ${synapseVCores} total vCores`);
      notes.push(`Fabric conversion: ${synapseVCores} × 2 = ${fabricVCores} vCores required`);
      notes.push(`Capacity ${capacitySku} provides burst capacity for optimal performance`);
      
      if (pool.autoScale.enabled) {
        notes.push(`Synapse autoscale: ${pool.autoScale.minNodeCount}-${pool.autoScale.maxNodeCount} nodes`);
        notes.push(`Fabric recommendation: ${minExecutors}-${maxExecutors} executors with dynamic allocation`);
      }

      if (pool.autoPause.enabled) {
        notes.push(`Synapse auto-pause: ${pool.autoPause.delayInMinutes} minutes - configure similar timeout in Fabric`);
      }

      recommendations.push({
        synapsePoolName: pool.name,
        recommendedConfig: {
          driverCores: 4,
          driverMemory: '28g',
          executorCores: executorCores,
          executorMemory: '28g',
          dynamicAllocation: pool.autoScale.enabled || pool.dynamicExecutorAllocation?.enabled || false,
          minExecutors: minExecutors,
          maxExecutors: maxExecutors
        },
        notes
      });
    }

    return recommendations;
  }

  /**
   * Validate if capacity can support the converted Spark pools
   */
  public validateCapacityForPools(
    recommendations: FabricSparkPoolRecommendation[],
    capacitySparkVCores: number,
    capacityMaxBurst: number
  ): { canSupport: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let canSupport = true;

    for (const rec of recommendations) {
      const requiredVCores = rec.recommendedConfig.maxExecutors! * rec.recommendedConfig.executorCores;
      
      if (requiredVCores > capacityMaxBurst) {
        canSupport = false;
        warnings.push(
          `❌ Pool '${rec.synapsePoolName}' requires ${requiredVCores} vCores but capacity only provides ${capacityMaxBurst} (with burst)`
        );
      } else if (requiredVCores > capacitySparkVCores) {
        warnings.push(
          `⚠️ Pool '${rec.synapsePoolName}' requires ${requiredVCores} vCores, using burst capacity (base: ${capacitySparkVCores}, burst: ${capacityMaxBurst})`
        );
      } else {
        warnings.push(
          `✅ Pool '${rec.synapsePoolName}' can run within base capacity (${requiredVCores}/${capacitySparkVCores} vCores)`
        );
      }
    }

    return { canSupport, warnings };
  }
}
