/**
 * Synapse Discovery Module
 * Discovers and inventories Synapse workspace assets for migration
 */
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export class SynapseDiscovery {
    constructor() {
        this.accessToken = null;
    }
    /**
     * Get Azure access token for Synapse REST API
     */
    async getAccessToken() {
        if (this.accessToken) {
            return this.accessToken;
        }
        try {
            // Synapse REST API requires dev.azuresynapse.net audience
            const { stdout } = await execAsync('az account get-access-token --resource https://dev.azuresynapse.net --query accessToken --output tsv');
            this.accessToken = stdout.trim();
            return this.accessToken;
        }
        catch (error) {
            throw new Error(`Failed to get Azure access token: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * List all Synapse workspaces in subscription
     */
    async listWorkspaces(subscriptionId) {
        try {
            const subId = subscriptionId || await this.getCurrentSubscription();
            const { stdout } = await execAsync(`az synapse workspace list --subscription ${subId} --output json`);
            const workspaces = JSON.parse(stdout);
            return workspaces;
        }
        catch (error) {
            console.error('Error listing Synapse workspaces:', error);
            return [];
        }
    }
    /**
     * Get current Azure subscription
     */
    async getCurrentSubscription() {
        const { stdout } = await execAsync('az account show --query id --output tsv');
        return stdout.trim();
    }
    /**
     * Discover all assets from a Synapse workspace
     */
    async discoverWorkspace(source) {
        console.error(`🔍 Discovering assets from Synapse workspace: ${source.workspaceName}`);
        const token = await this.getAccessToken();
        // Discover in parallel for faster execution
        const [notebooks, pipelines, linkedServices, sparkJobs] = await Promise.all([
            this.discoverNotebooks(source, token),
            this.discoverPipelines(source, token),
            this.discoverLinkedServices(source, token),
            this.discoverSparkJobs(source, token)
        ]);
        const inventory = {
            source,
            notebooks,
            pipelines,
            linkedServices,
            sparkJobs,
            discoveredAt: new Date()
        };
        console.error(`✅ Discovery complete: ${notebooks.length} notebooks, ${pipelines.length} pipelines, ${linkedServices.length} linked services, ${sparkJobs.length} Spark jobs`);
        return inventory;
    }
    /**
     * Discover notebooks from Synapse workspace
     */
    async discoverNotebooks(source, token) {
        try {
            // Use Synapse REST API to list notebooks
            const apiVersion = '2021-06-01-preview';
            const url = `https://${source.workspaceName}.dev.azuresynapse.net/notebooks?api-version=${apiVersion}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            const data = await response.json();
            const notebooks = [];
            // Fetch each notebook's content
            for (const notebook of data.value || []) {
                try {
                    const contentUrl = `https://${source.workspaceName}.dev.azuresynapse.net/notebooks/${notebook.name}?api-version=${apiVersion}`;
                    const contentResponse = await fetch(contentUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (contentResponse.ok) {
                        const content = await contentResponse.json();
                        // Extract the actual notebook content from Synapse API response
                        const notebookContent = content.properties || content;
                        notebooks.push({
                            id: notebook.id || notebook.name,
                            name: notebook.name,
                            path: notebook.properties?.folder?.name ?
                                `${notebook.properties.folder.name}/${notebook.name}` :
                                notebook.name,
                            content: notebookContent,
                            properties: notebook.properties
                        });
                    }
                }
                catch (error) {
                    console.error(`Failed to fetch notebook ${notebook.name}:`, error);
                }
            }
            return notebooks;
        }
        catch (error) {
            console.error('Error discovering notebooks:', error);
            return [];
        }
    }
    /**
     * Discover pipelines from Synapse workspace
     */
    async discoverPipelines(source, token) {
        try {
            const apiVersion = '2021-06-01-preview';
            const url = `https://${source.workspaceName}.dev.azuresynapse.net/pipelines?api-version=${apiVersion}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            const data = await response.json();
            const pipelines = [];
            for (const pipeline of data.value || []) {
                pipelines.push({
                    id: pipeline.id || pipeline.name,
                    name: pipeline.name,
                    definition: pipeline.properties,
                    properties: pipeline.properties
                });
            }
            return pipelines;
        }
        catch (error) {
            console.error('Error discovering pipelines:', error);
            return [];
        }
    }
    /**
     * Discover linked services from Synapse workspace
     */
    async discoverLinkedServices(source, token) {
        try {
            const apiVersion = '2021-06-01-preview';
            const url = `https://${source.workspaceName}.dev.azuresynapse.net/linkedservices?api-version=${apiVersion}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            const data = await response.json();
            const linkedServices = [];
            for (const service of data.value || []) {
                linkedServices.push({
                    id: service.id || service.name,
                    name: service.name,
                    type: service.properties?.type || 'Unknown',
                    properties: service.properties
                });
            }
            return linkedServices;
        }
        catch (error) {
            console.error('Error discovering linked services:', error);
            return [];
        }
    }
    /**
     * Discover Spark job definitions from Synapse workspace
     */
    async discoverSparkJobs(source, token) {
        try {
            const apiVersion = '2021-06-01-preview';
            const url = `https://${source.workspaceName}.dev.azuresynapse.net/sparkJobDefinitions?api-version=${apiVersion}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                // Spark job definitions might not be available in all workspaces
                console.error(`Could not fetch Spark job definitions: HTTP ${response.status}`);
                return [];
            }
            const data = await response.json();
            const sparkJobs = [];
            for (const job of data.value || []) {
                sparkJobs.push({
                    id: job.id || job.name,
                    name: job.name,
                    scriptPath: job.properties?.file,
                    mainClass: job.properties?.mainClassName,
                    arguments: job.properties?.args,
                    libraries: job.properties?.jars || job.properties?.files,
                    configuration: job.properties?.configuration
                });
            }
            return sparkJobs;
        }
        catch (error) {
            console.error('Error discovering Spark jobs:', error);
            return [];
        }
    }
    /**
     * Export inventory to JSON file
     */
    async exportInventory(inventory, outputPath) {
        const fs = await import('fs');
        fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2), 'utf-8');
        console.error(`📄 Inventory exported to: ${outputPath}`);
    }
}
//# sourceMappingURL=synapse-discovery.js.map