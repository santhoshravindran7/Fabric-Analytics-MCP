/**
 * Migration Orchestrator
 * Coordinates the end-to-end migration process
 */
import { SynapseDiscovery } from './synapse-discovery.js';
import { NotebookTransformer } from './notebook-transformer.js';
import { FabricProvisioner } from './fabric-provisioner.js';
import { SparkPoolManager } from './spark-pool-tools.js';
import { CapacityManager } from './capacity-tools.js';
import { execSync } from 'child_process';
export class MigrationOrchestrator {
    /**
     * Fetch Fabric pricing from Azure Retail Prices API
     * Fabric pricing is based on Capacity Units (CU) at a standard rate per hour
     */
    async getFabricPricing(region = 'eastus') {
        console.error(`💲 Fetching Fabric pricing for region: ${region}`);
        // Azure Retail Prices API (unauthenticated)
        // Fabric uses Capacity Units (CU) pricing model
        const apiUrl = `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Microsoft Fabric' and productName eq 'Fabric Capacity' and armRegionName eq '${region}'`;
        const pricingMap = {};
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                console.error(`⚠️  Pricing API returned ${response.status}, using fallback pricing`);
                return this.getFallbackFabricPricing();
            }
            const data = await response.json();
            const items = data.Items || [];
            if (items.length === 0) {
                console.error(`⚠️  No pricing data for region ${region}, using fallback`);
                return this.getFallbackFabricPricing();
            }
            // Fabric pricing is per Capacity Unit (CU) per hour
            // Look for any capacity usage meter to get the CU price
            const cuPriceItem = items.find((item) => item.meterName && item.meterName.includes('Capacity Usage CU'));
            if (!cuPriceItem) {
                console.error(`⚠️  Could not find CU pricing, using fallback`);
                return this.getFallbackFabricPricing();
            }
            const pricePerCU = cuPriceItem.retailPrice;
            console.error(`   Capacity Unit price: $${pricePerCU}/hour`);
            // Calculate pricing for each F-series SKU
            // F2 = 2 CUs, F4 = 4 CUs, F64 = 64 CUs, etc.
            const fSeriesSKUs = ['F2', 'F4', 'F8', 'F16', 'F32', 'F64', 'F128', 'F256', 'F512', 'F1024', 'F2048'];
            fSeriesSKUs.forEach(sku => {
                const capacityUnits = parseInt(sku.replace('F', ''));
                const price = capacityUnits * pricePerCU;
                pricingMap[sku] = price;
                console.error(`   ${sku} (${capacityUnits} CUs): $${price.toFixed(2)}/hour`);
            });
            return pricingMap;
        }
        catch (error) {
            console.error(`⚠️  Error fetching pricing: ${error}, using fallback`);
            return this.getFallbackFabricPricing();
        }
    }
    /**
     * Fallback pricing based on known Fabric rates (as of Nov 2024)
     * Source: https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/
     */
    getFallbackFabricPricing() {
        console.error('   Using fallback pricing (Nov 2024 rates)');
        return {
            'F2': 0.36, // $0.36/hour
            'F4': 0.72, // $0.72/hour
            'F8': 1.44, // $1.44/hour
            'F16': 2.88, // $2.88/hour
            'F32': 5.76, // $5.76/hour
            'F64': 11.52, // $11.52/hour
            'F128': 23.04, // $23.04/hour
            'F256': 46.08, // $46.08/hour
            'F512': 92.16, // $92.16/hour
            'F1024': 184.32, // $184.32/hour
            'F2048': 368.64 // $368.64/hour
        };
    }
    /**
     * Get Synapse workspace details with full asset inventory
     */
    async getSynapseWorkspaceDetails(subscriptionId, resourceGroup, workspaceName) {
        console.error(`🔍 Fetching Synapse workspace details: ${workspaceName}`);
        // Get access token for Azure Management API
        const token = execSync('az account get-access-token --resource https://management.azure.com --query accessToken -o tsv', { encoding: 'utf-8' }).trim();
        const apiVersion = '2021-06-01';
        const baseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Synapse/workspaces/${workspaceName}`;
        // Fetch workspace details
        const workspaceUrl = `${baseUrl}?api-version=${apiVersion}`;
        const workspaceResponse = await fetch(workspaceUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!workspaceResponse.ok) {
            throw new Error(`Failed to fetch workspace: ${workspaceResponse.status} ${await workspaceResponse.text()}`);
        }
        const workspace = await workspaceResponse.json();
        // Fetch Spark pools using SparkPoolManager
        const sparkPoolManager = new SparkPoolManager();
        const sparkPools = await sparkPoolManager.listSynapseSparkPools(subscriptionId, resourceGroup, workspaceName);
        // Use existing discovery to get notebooks and pipelines
        const source = {
            type: 'synapse',
            subscriptionId,
            resourceGroup,
            workspaceName
        };
        const inventory = await this.discovery.discoverWorkspace(source);
        return {
            workspaceName: workspace.name,
            resourceGroup,
            subscriptionId,
            location: workspace.location,
            workspaceId: workspace.id,
            properties: {
                connectivityEndpoints: workspace.properties?.connectivityEndpoints,
                managedResourceGroupName: workspace.properties?.managedResourceGroupName,
                provisioningState: workspace.properties?.provisioningState
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
            sparkPools: sparkPools.map(sp => ({
                name: sp.name,
                nodeSize: sp.nodeSize,
                nodeCount: sp.nodeCount,
                autoScale: sp.autoScale,
                autoPause: sp.autoPause,
                dynamicExecutorAllocation: sp.dynamicExecutorAllocation,
                sparkVersion: sp.sparkVersion
            })),
            linkedServices: inventory.linkedServices.map(ls => ({
                name: ls.name,
                type: ls.type
            })),
            summary: {
                totalNotebooks: inventory.notebooks.length,
                totalPipelines: inventory.pipelines.length,
                totalSparkPools: sparkPools.length,
                totalLinkedServices: inventory.linkedServices.length
            }
        };
    }
    /**
     * Get Synapse compute spend summary using Azure Cost Management API
     */
    async getSynapseComputeSpend(subscriptionId, resourceGroup, workspaceName, startDate, endDate) {
        console.error(`💰 Fetching compute spend for: ${workspaceName}`);
        // Default to last 30 days if not specified
        const end = endDate || new Date().toISOString().split('T')[0];
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Get access token for Azure Management API
        const token = execSync('az account get-access-token --resource https://management.azure.com --query accessToken -o tsv', { encoding: 'utf-8' }).trim();
        // Get workspace resource ID first
        const apiVersion = '2021-06-01';
        const workspaceUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Synapse/workspaces/${workspaceName}?api-version=${apiVersion}`;
        const workspaceResponse = await fetch(workspaceUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!workspaceResponse.ok) {
            throw new Error(`Failed to fetch workspace: ${workspaceResponse.status}`);
        }
        const workspace = await workspaceResponse.json();
        const resourceId = workspace.id;
        const workspaceLocation = workspace.location || 'eastus';
        // Query Cost Management API
        const costApiVersion = '2023-11-01';
        const costUrl = `https://management.azure.com${resourceId}/providers/Microsoft.CostManagement/query?api-version=${costApiVersion}`;
        const costQuery = {
            type: 'Usage',
            timeframe: 'Custom',
            timePeriod: {
                from: start,
                to: end
            },
            dataset: {
                granularity: 'Daily',
                aggregation: {
                    totalCost: {
                        name: 'PreTaxCost',
                        function: 'Sum'
                    }
                },
                grouping: [
                    {
                        type: 'Dimension',
                        name: 'MeterCategory'
                    },
                    {
                        type: 'Dimension',
                        name: 'MeterSubCategory'
                    }
                ],
                filter: {
                    dimensions: {
                        name: 'ResourceId',
                        operator: 'In',
                        values: [resourceId]
                    }
                }
            }
        };
        const costResponse = await fetch(costUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(costQuery)
        });
        let totalSpendUSD = 0;
        const details = [];
        let sparkPoolSpend = 0;
        let storageSpend = 0;
        let otherSpend = 0;
        if (costResponse.ok) {
            const costData = await costResponse.json();
            const rows = costData.properties?.rows || [];
            const columns = costData.properties?.columns || [];
            // Parse cost data
            rows.forEach((row) => {
                const cost = row[0] || 0; // First column is typically cost
                const category = row[1] || 'Unknown';
                const subCategory = row[2] || 'Unknown';
                totalSpendUSD += cost;
                if (category.toLowerCase().includes('spark') || subCategory.toLowerCase().includes('spark')) {
                    sparkPoolSpend += cost;
                }
                else if (category.toLowerCase().includes('storage') || subCategory.toLowerCase().includes('storage')) {
                    storageSpend += cost;
                }
                else {
                    otherSpend += cost;
                }
                details.push({
                    category,
                    subCategory,
                    cost: parseFloat(cost.toFixed(2)),
                    date: row[row.length - 1] // Last column is typically date
                });
            });
        }
        else {
            console.error(`⚠️  Cost Management API returned ${costResponse.status}, using estimated data`);
            // Fallback: estimate based on Spark pool configurations
            const sparkPoolManager = new SparkPoolManager();
            const sparkPools = await sparkPoolManager.listSynapseSparkPools(subscriptionId, resourceGroup, workspaceName);
            // Rough estimate: $0.50/vCore/hour average
            sparkPools.forEach(pool => {
                const nodeVCores = { 'Small': 4, 'Medium': 8, 'Large': 16, 'XLarge': 32, 'XXLarge': 64 }[pool.nodeSize] || 8;
                const totalVCores = pool.nodeCount * nodeVCores;
                const estimatedHoursPerDay = 8; // Conservative estimate
                const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
                const estimated = totalVCores * 0.50 * estimatedHoursPerDay * days;
                sparkPoolSpend += estimated;
                details.push({
                    category: 'Synapse Apache Spark Pool',
                    subCategory: pool.name,
                    cost: parseFloat(estimated.toFixed(2)),
                    estimated: true
                });
            });
            totalSpendUSD = sparkPoolSpend;
        }
        return {
            workspaceName,
            resourceGroup,
            subscriptionId,
            region: workspaceLocation,
            startDate: start,
            endDate: end,
            totalSpendUSD: parseFloat(totalSpendUSD.toFixed(2)),
            breakdown: {
                sparkPoolSpend: parseFloat(sparkPoolSpend.toFixed(2)),
                storageSpend: parseFloat(storageSpend.toFixed(2)),
                otherSpend: parseFloat(otherSpend.toFixed(2))
            },
            details,
            summary: {
                averageDailySpend: parseFloat((totalSpendUSD / Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)))).toFixed(2)),
                totalDays: Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)),
                primaryCostDriver: sparkPoolSpend > storageSpend ? 'Spark Compute' : 'Storage'
            }
        };
    }
    /**
     * Migrate Spark pools to Fabric with full conversion and validation
     */
    async migrateSparkPoolsToFabric(sparkPools, targetCapacitySku, workspaceId) {
        console.error(`🔄 Migrating ${sparkPools.length} Spark pools to Fabric`);
        const sparkPoolManager = new SparkPoolManager();
        const capacityManager = new CapacityManager();
        // Get capacity specifications
        const capacitySpecs = capacityManager.getCapacitySpecs(targetCapacitySku);
        // Convert Synapse pools to Fabric recommendations
        const recommendations = sparkPoolManager.convertSynapseToFabricPools(sparkPools, targetCapacitySku);
        // Validate if capacity can support all pools
        const validation = sparkPoolManager.validateCapacityForPools(recommendations, capacitySpecs.sparkVCores, capacitySpecs.maxSparkVCoresWithBurst);
        const migrationResults = {
            targetCapacitySku,
            workspaceId,
            totalPoolsMigrated: sparkPools.length,
            capacityValidation: validation,
            recommendations: recommendations.map(rec => ({
                synapsePoolName: rec.synapsePoolName,
                fabricConfig: rec.recommendedConfig,
                notes: rec.notes
            })),
            capacityInfo: {
                sku: targetCapacitySku,
                baseSparkVCores: capacitySpecs.sparkVCores,
                burstSparkVCores: capacitySpecs.maxSparkVCoresWithBurst,
                queueLimit: capacitySpecs.queueLimit
            },
            nextSteps: validation.canSupport
                ? [
                    'All Spark pools can be supported on the selected capacity',
                    'Use Fabric workspace settings to configure Spark compute',
                    'Update notebook attachments to use Fabric Spark',
                    'Test workloads to validate performance'
                ]
                : [
                    '⚠️  Selected capacity may not support all pools at peak usage',
                    'Consider upgrading to a larger Fabric capacity SKU',
                    'Review warnings above for specific pool requirements',
                    'Some pools may need dynamic allocation tuning'
                ]
        };
        return migrationResults;
    }
    /**
     * Recommend Fabric capacity based on Synapse compute usage and spend
     */
    async recommendFabricCapacity(synapseComputeSummary, minSku, maxSku) {
        console.error(`📊 Analyzing Synapse usage to recommend Fabric capacity`);
        const capacityManager = new CapacityManager();
        // Get actual Fabric pricing from Azure Retail Prices API
        // Extract region from compute summary if available
        const region = synapseComputeSummary.region || 'eastus';
        const fabricPricing = await this.getFabricPricing(region);
        // Available Fabric SKUs in order
        const allSkus = ['F2', 'F4', 'F8', 'F16', 'F32', 'F64', 'F128', 'F256', 'F512', 'F1024', 'F2048'];
        // Filter SKUs based on min/max constraints
        const minIndex = minSku ? allSkus.indexOf(minSku) : 0;
        const maxIndex = maxSku ? allSkus.indexOf(maxSku) : allSkus.length - 1;
        const availableSkus = allSkus.slice(Math.max(0, minIndex), Math.min(allSkus.length, maxIndex + 1));
        // Extract compute metrics from summary
        const sparkPoolSpend = synapseComputeSummary.breakdown?.sparkPoolSpend || 0;
        const totalSpend = synapseComputeSummary.totalSpendUSD || 0;
        const sparkPools = synapseComputeSummary.sparkPools || [];
        // Calculate total Synapse vCores from all pools
        let totalSynapseVCores = 0;
        const nodeVCoreMap = {
            'Small': 4,
            'Medium': 8,
            'Large': 16,
            'XLarge': 32,
            'XXLarge': 64
        };
        sparkPools.forEach((pool) => {
            const nodeVCores = nodeVCoreMap[pool.nodeSize] || 8;
            const maxNodes = pool.autoScale?.enabled
                ? (pool.autoScale.maxNodeCount || pool.nodeCount)
                : pool.nodeCount;
            totalSynapseVCores += maxNodes * nodeVCores;
        });
        // Conversion formula: 1 Synapse vCore ≈ 2 Fabric vCores
        const requiredFabricVCores = totalSynapseVCores * 2;
        // Cost-based sizing: estimate monthly Fabric cost
        // Fabric pricing is roughly $0.18-0.22 per vCore/hour for F-series
        // Synapse is roughly $0.40-0.50 per vCore/hour
        const avgDailySpend = synapseComputeSummary.summary?.averageDailySpend || 0;
        const estimatedMonthlySpend = avgDailySpend * 30;
        // Find optimal SKU based on vCore requirements
        let recommendedSku = availableSkus[0]; // Default to minimum
        let recommendationReason = '';
        let confidence = 'low';
        for (const sku of availableSkus) {
            const specs = capacityManager.getCapacitySpecs(sku);
            // Check if base capacity can handle 70% of load (allowing for burst)
            if (specs.sparkVCores >= requiredFabricVCores * 0.7) {
                recommendedSku = sku;
                confidence = 'high';
                recommendationReason = `Based on ${totalSynapseVCores} Synapse vCores → ${requiredFabricVCores} Fabric vCores requirement. ${sku} provides ${specs.sparkVCores} base vCores (${specs.maxSparkVCoresWithBurst} with burst).`;
                break;
            }
            else if (specs.maxSparkVCoresWithBurst >= requiredFabricVCores) {
                recommendedSku = sku;
                confidence = 'medium';
                recommendationReason = `${sku} can handle peak load with burst capacity (${specs.maxSparkVCoresWithBurst} vCores), but consider next size up for consistent performance.`;
                // Don't break, keep looking for better fit
            }
        }
        // If no SKU found, recommend the largest available
        if (!recommendationReason) {
            recommendedSku = availableSkus[availableSkus.length - 1];
            confidence = 'low';
            recommendationReason = `Current requirements (${requiredFabricVCores} vCores) exceed available SKUs. ${recommendedSku} is the largest available option.`;
        }
        const recommendedSpecs = capacityManager.getCapacitySpecs(recommendedSku);
        // Calculate cost estimates using actual Azure pricing
        const hoursPerMonth = 730; // Average hours per month
        const recommendedPricePerHour = fabricPricing[recommendedSku] || 0;
        const estimatedFabricMonthlyCost = recommendedPricePerHour * hoursPerMonth;
        const potentialSavings = estimatedMonthlySpend - estimatedFabricMonthlyCost;
        const savingsPercentage = estimatedMonthlySpend > 0
            ? ((potentialSavings / estimatedMonthlySpend) * 100).toFixed(1)
            : '0';
        return {
            recommendedSku,
            confidence,
            reason: recommendationReason,
            analysis: {
                synapseTotalVCores: totalSynapseVCores,
                fabricRequiredVCores: requiredFabricVCores,
                conversionRatio: '1:2 (Synapse:Fabric)',
                sparkPoolCount: sparkPools.length,
                currentMonthlySpend: parseFloat(estimatedMonthlySpend.toFixed(2)),
                estimatedFabricMonthlyCost: parseFloat(estimatedFabricMonthlyCost.toFixed(2)),
                potentialSavings: parseFloat(potentialSavings.toFixed(2)),
                savingsPercentage: `${savingsPercentage}%`,
                pricingSource: Object.keys(fabricPricing).length > 0 ? 'Azure Retail Prices API' : 'Fallback estimates',
                pricePerHour: recommendedPricePerHour
            },
            recommendedCapacitySpecs: {
                sku: recommendedSku,
                baseSparkVCores: recommendedSpecs.sparkVCores,
                burstSparkVCores: recommendedSpecs.maxSparkVCoresWithBurst,
                queueLimit: recommendedSpecs.queueLimit,
                pricePerHour: recommendedPricePerHour,
                pricePerMonth: parseFloat(estimatedFabricMonthlyCost.toFixed(2))
            },
            alternatives: availableSkus
                .filter(sku => sku !== recommendedSku)
                .slice(0, 3)
                .map(sku => {
                const specs = capacityManager.getCapacitySpecs(sku);
                const pricePerHour = fabricPricing[sku] || 0;
                return {
                    sku,
                    baseSparkVCores: specs.sparkVCores,
                    burstSparkVCores: specs.maxSparkVCoresWithBurst,
                    pricePerHour: pricePerHour,
                    estimatedMonthlyCost: parseFloat((pricePerHour * hoursPerMonth).toFixed(2)),
                    note: specs.sparkVCores >= requiredFabricVCores
                        ? 'Can fully support workload'
                        : 'May require burst capacity'
                };
            }),
            recommendations: [
                `Start with ${recommendedSku} capacity for optimal performance and cost`,
                'Monitor Fabric capacity metrics during first month',
                totalSynapseVCores > 0
                    ? 'Review Spark pool auto-scaling settings to optimize costs'
                    : 'Consider starting with smaller capacity and scaling up as needed',
                potentialSavings > 0
                    ? `Estimated savings: $${potentialSavings.toFixed(2)}/month (${savingsPercentage}%)`
                    : 'Fabric provides better integration and modern features'
            ]
        };
    }
    constructor(config) {
        this.config = config;
        this.discovery = new SynapseDiscovery();
        this.transformer = new NotebookTransformer(config);
    }
    /**
     * Execute full migration workflow
     */
    async executeMigration(source, targetWorkspaceId) {
        const startTime = Date.now();
        console.error('🚀 Starting Synapse to Fabric migration...');
        console.error(`   Source: ${source.workspaceName}`);
        console.error(`   Target: ${targetWorkspaceId}`);
        try {
            // Phase 1: Discovery
            console.error('\n📋 Phase 1: Discovery');
            const inventory = await this.discovery.discoverWorkspace(source);
            console.error(`   Found: ${inventory.notebooks.length} notebooks, ${inventory.pipelines.length} pipelines`);
            // Phase 2: Transformation
            console.error('\n🔄 Phase 2: Transformation');
            const transformResults = await this.transformer.transformNotebooks(inventory.notebooks);
            const successful = transformResults.filter(r => r.success);
            const failed = transformResults.filter(r => !r.success);
            console.error(`   Transformed: ${successful.length} successful, ${failed.length} failed`);
            // Phase 3: Provisioning
            console.error('\n📦 Phase 3: Provisioning');
            this.provisioner = new FabricProvisioner(targetWorkspaceId, this.config);
            // Create lakehouse if needed
            let lakehouseId;
            if (this.config.targetLakehouseName) {
                lakehouseId = await this.provisioner.createLakehouse(this.config.targetLakehouseName);
            }
            // Provision notebooks
            const provisionedIds = await this.provisioner.provisionNotebooks(successful);
            console.error(`   Provisioned: ${provisionedIds.size} notebooks`);
            // Phase 4: Validation
            console.error('\n✅ Phase 4: Validation');
            const validation = await this.provisioner.validateProvisionedItems(provisionedIds);
            console.error(`   Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
            if (validation.issues.length > 0) {
                console.error(`   Issues: ${validation.issues.length}`);
            }
            // Generate report
            const report = this.generateMigrationReport(inventory, transformResults, provisionedIds, validation, Date.now() - startTime);
            console.error('\n✨ Migration complete!');
            console.error(`   Duration: ${(report.summary.duration / 1000).toFixed(2)}s`);
            console.error(`   Success rate: ${((report.summary.successful / report.summary.totalAssets) * 100).toFixed(1)}%`);
            return report;
        }
        catch (error) {
            console.error('\n❌ Migration failed:', error);
            throw error;
        }
    }
    /**
     * Generate comprehensive migration report
     */
    generateMigrationReport(inventory, transformResults, provisionedIds, validation, duration) {
        const details = [];
        // Create result for each notebook
        for (const result of transformResults) {
            const fabricItemId = provisionedIds.get(result.notebookName);
            let status = 'failed';
            if (result.success && fabricItemId) {
                status = 'success';
            }
            else if (result.success && !fabricItemId) {
                status = 'failed';
            }
            else if (!result.success && result.errors && result.errors.length > 0) {
                status = 'manual_review';
            }
            details.push({
                assetName: result.notebookName,
                assetType: 'notebook',
                status,
                fabricItemId,
                changes: result.changes,
                warnings: result.warnings,
                error: result.errors?.[0]
            });
        }
        const successful = details.filter(d => d.status === 'success').length;
        const failed = details.filter(d => d.status === 'failed').length;
        const manualReview = details.filter(d => d.status === 'manual_review').length;
        const recommendations = [];
        // Add recommendations based on results
        if (failed > 0) {
            recommendations.push(`${failed} items failed migration - review error details and retry`);
        }
        if (manualReview > 0) {
            recommendations.push(`${manualReview} items require manual review - check transformation changes`);
        }
        if (inventory.pipelines.length > 0) {
            recommendations.push(`${inventory.pipelines.length} pipelines detected but not migrated - consider manual conversion to Data Factory or Data Pipelines`);
        }
        if (inventory.linkedServices.length > 0) {
            recommendations.push(`${inventory.linkedServices.length} linked services detected - review and recreate connections in Fabric`);
        }
        if (!validation.valid) {
            recommendations.push('Validation failed - some provisioned items may not be accessible');
            recommendations.push(...validation.issues);
        }
        return {
            summary: {
                totalAssets: inventory.notebooks.length,
                successful,
                failed,
                requiresManualReview: manualReview,
                duration
            },
            details,
            recommendations,
            generatedAt: new Date()
        };
    }
    /**
     * Discover only (no transformation or provisioning)
     */
    async discoverOnly(source) {
        console.error('🔍 Discovery mode: Scanning Synapse workspace...');
        const inventory = await this.discovery.discoverWorkspace(source);
        console.error('\n📊 Discovery Summary:');
        console.error(`   Notebooks: ${inventory.notebooks.length}`);
        console.error(`   Pipelines: ${inventory.pipelines.length}`);
        console.error(`   Linked Services: ${inventory.linkedServices.length}`);
        console.error(`   Spark Jobs: ${inventory.sparkJobs.length}`);
        return inventory;
    }
    /**
     * Transform only (no provisioning)
     */
    async transformOnly(inventory) {
        console.error('🔄 Transformation mode: Processing notebooks...');
        const results = await this.transformer.transformNotebooks(inventory.notebooks);
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);
        console.error('\n📊 Transformation Summary:');
        console.error(`   Successful: ${successful}`);
        console.error(`   Failed: ${failed}`);
        console.error(`   Total Changes: ${totalChanges}`);
        return results;
    }
    /**
     * Generate transformation report
     */
    generateTransformationReport(results) {
        return this.transformer.generateTransformationReport(results);
    }
    /**
     * List available Synapse workspaces
     */
    async listSynapseWorkspaces(subscriptionId) {
        return this.discovery.listWorkspaces(subscriptionId);
    }
}
//# sourceMappingURL=orchestrator.js.map