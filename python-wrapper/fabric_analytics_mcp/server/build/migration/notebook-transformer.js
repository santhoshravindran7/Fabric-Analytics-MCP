/**
 * Notebook Transformation Module
 * Transforms Synapse notebooks to Fabric-compatible format
 */
export class NotebookTransformer {
    constructor(config) {
        this.config = {
            dryRun: config?.dryRun ?? false,
            backupOriginal: config?.backupOriginal ?? true,
            validateTransformation: config?.validateTransformation ?? true,
            targetWorkspaceName: config?.targetWorkspaceName ?? '',
            targetLakehouseName: config?.targetLakehouseName ?? '',
            transformRules: config?.transformRules ?? this.getDefaultTransformRules()
        };
    }
    /**
     * Default transformation rules for Synapse to Fabric
     */
    getDefaultTransformRules() {
        return [
            {
                name: 'mssparkutils-to-notebookutils',
                pattern: /mssparkutils/g,
                replacement: 'notebookutils',
                description: 'Replace mssparkutils with notebookutils'
            },
            {
                name: 'synapse-magic-commands',
                pattern: /%%synapse/g,
                replacement: '%%spark',
                description: 'Replace Synapse magic commands with Fabric equivalents'
            },
            {
                name: 'abfss-path-rewriting',
                pattern: /abfss:\/\/([^@]+)@([^.]+)\.dfs\.core\.windows\.net\/([^\s'"]+)/g,
                replacement: 'abfss://$1@onelake.dfs.fabric.microsoft.com/$3',
                description: 'Rewrite ABFSS paths to OneLake'
            },
            {
                name: 'synapse-spark-pool-config',
                pattern: /%%configure[^%]*?"name":\s*"[^"]*synapse[^"]*"/gi,
                replacement: '# Fabric: Spark pool configuration managed automatically',
                description: 'Remove Synapse-specific Spark pool configurations'
            },
            {
                name: 'adls-gen2-paths',
                pattern: /wasbs?:\/\//g,
                replacement: 'abfss://',
                description: 'Convert WASB/WASBS to ABFSS protocol'
            }
        ];
    }
    /**
     * Transform a single notebook
     */
    async transformNotebook(notebook) {
        console.error(`🔄 Transforming notebook: ${notebook.name}`);
        const changes = [];
        let transformedContent = JSON.parse(JSON.stringify(notebook.content)); // Deep clone
        try {
            // Check if content is Jupyter notebook format
            if (!transformedContent.cells) {
                throw new Error('Invalid notebook format: missing cells array');
            }
            // Transform each cell
            for (let cellIndex = 0; cellIndex < transformedContent.cells.length; cellIndex++) {
                const cell = transformedContent.cells[cellIndex];
                if (cell.cell_type === 'code' && cell.source) {
                    const originalSource = Array.isArray(cell.source)
                        ? cell.source.join('')
                        : cell.source;
                    let transformedSource = originalSource;
                    // Apply each transformation rule
                    for (const rule of this.config.transformRules || []) {
                        const beforeTransform = transformedSource;
                        transformedSource = transformedSource.replace(rule.pattern, rule.replacement);
                        // Track changes
                        if (beforeTransform !== transformedSource) {
                            const matches = beforeTransform.match(rule.pattern);
                            const transformedValue = typeof rule.replacement === 'function'
                                ? rule.replacement(matches ? matches[0] : '')
                                : rule.replacement;
                            changes.push({
                                type: 'code',
                                location: `Cell ${cellIndex + 1}`,
                                original: matches ? matches[0] : '',
                                transformed: transformedValue,
                                rule: rule.name
                            });
                        }
                    }
                    // Update cell source if changed
                    if (originalSource !== transformedSource) {
                        // Preserve source format (string or array)
                        if (Array.isArray(cell.source)) {
                            cell.source = transformedSource.split('\n').map((line, idx, arr) => idx < arr.length - 1 ? line + '\n' : line);
                        }
                        else {
                            cell.source = transformedSource;
                        }
                    }
                }
            }
            // Transform notebook metadata
            if (transformedContent.metadata) {
                const metadataChanges = this.transformNotebookMetadata(transformedContent.metadata);
                changes.push(...metadataChanges);
            }
            const result = {
                notebookId: notebook.id,
                notebookName: notebook.name,
                originalContent: notebook.content,
                transformedContent,
                changes,
                success: true,
                errors: []
            };
            console.error(`✅ Transformation complete: ${changes.length} changes applied`);
            return result;
        }
        catch (error) {
            console.error(`❌ Transformation failed for ${notebook.name}:`, error);
            return {
                notebookId: notebook.id,
                notebookName: notebook.name,
                originalContent: notebook.content,
                transformedContent: notebook.content, // Return original on error
                changes: [],
                success: false,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    /**
     * Transform notebook metadata
     */
    transformNotebookMetadata(metadata) {
        const changes = [];
        // Remove Synapse-specific metadata
        if (metadata.synapse) {
            delete metadata.synapse;
            changes.push({
                type: 'metadata',
                location: 'Notebook metadata',
                original: 'synapse metadata section',
                transformed: 'removed',
                rule: 'remove-synapse-metadata'
            });
        }
        // Update language info if needed
        if (metadata.language_info) {
            if (metadata.language_info.name === 'synapse_pyspark') {
                metadata.language_info.name = 'python';
                changes.push({
                    type: 'metadata',
                    location: 'Notebook metadata',
                    original: 'synapse_pyspark',
                    transformed: 'python',
                    rule: 'normalize-language'
                });
            }
        }
        // Add Fabric metadata
        metadata.fabric = {
            environment: 'Fabric',
            migrated: true,
            migrationTimestamp: new Date().toISOString()
        };
        changes.push({
            type: 'metadata',
            location: 'Notebook metadata',
            original: '',
            transformed: 'Added Fabric metadata',
            rule: 'add-fabric-metadata'
        });
        return changes;
    }
    /**
     * Transform multiple notebooks in batch
     */
    async transformNotebooks(notebooks) {
        console.error(`🔄 Transforming ${notebooks.length} notebooks...`);
        const results = [];
        // Transform notebooks in parallel (with concurrency limit)
        const batchSize = 5;
        for (let i = 0; i < notebooks.length; i += batchSize) {
            const batch = notebooks.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(notebook => this.transformNotebook(notebook)));
            results.push(...batchResults);
        }
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);
        console.error(`✅ Batch transformation complete:`);
        console.error(`   - Successful: ${successful}`);
        console.error(`   - Failed: ${failed}`);
        console.error(`   - Total changes: ${totalChanges}`);
        return results;
    }
    /**
     * Generate transformation report
     */
    generateTransformationReport(results) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        let report = '# Notebook Transformation Report\n\n';
        report += `**Generated:** ${new Date().toISOString()}\n\n`;
        report += `## Summary\n\n`;
        report += `- **Total Notebooks:** ${results.length}\n`;
        report += `- **Successful:** ${successful.length}\n`;
        report += `- **Failed:** ${failed.length}\n`;
        report += `- **Total Changes:** ${results.reduce((sum, r) => sum + r.changes.length, 0)}\n\n`;
        // Group changes by rule
        const changesByRule = new Map();
        results.forEach(result => {
            result.changes.forEach(change => {
                const ruleName = change.rule || 'unknown';
                const count = changesByRule.get(ruleName) || 0;
                changesByRule.set(ruleName, count + 1);
            });
        });
        report += `## Changes by Rule\n\n`;
        report += `| Rule | Count |\n`;
        report += `|------|-------|\n`;
        changesByRule.forEach((count, rule) => {
            report += `| ${rule} | ${count} |\n`;
        });
        report += `\n`;
        // Successful transformations
        if (successful.length > 0) {
            report += `## Successful Transformations\n\n`;
            successful.forEach(result => {
                report += `### ${result.notebookName}\n`;
                report += `- **Changes:** ${result.changes.length}\n`;
                if (result.changes.length > 0) {
                    report += `- **Change Types:**\n`;
                    const changeTypes = new Map();
                    result.changes.forEach(change => {
                        const count = changeTypes.get(change.type) || 0;
                        changeTypes.set(change.type, count + 1);
                    });
                    changeTypes.forEach((count, type) => {
                        report += `  - ${type}: ${count}\n`;
                    });
                }
                report += `\n`;
            });
        }
        // Failed transformations
        if (failed.length > 0) {
            report += `## Failed Transformations\n\n`;
            failed.forEach(result => {
                report += `### ${result.notebookName}\n`;
                report += `- **Errors:**\n`;
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(error => {
                        report += `  - ${error}\n`;
                    });
                }
                report += `\n`;
            });
        }
        return report;
    }
    /**
     * Validate transformed notebook
     */
    validateTransformedNotebook(result) {
        const issues = [];
        try {
            const content = result.transformedContent;
            // Check notebook structure
            if (!content.cells || !Array.isArray(content.cells)) {
                issues.push('Invalid notebook structure: missing or invalid cells array');
            }
            // Check for remaining Synapse-specific references
            const contentStr = JSON.stringify(content);
            if (contentStr.includes('mssparkutils')) {
                issues.push('Warning: mssparkutils references still present');
            }
            if (contentStr.includes('%%synapse')) {
                issues.push('Warning: Synapse magic commands still present');
            }
            // Check metadata
            if (!content.metadata) {
                issues.push('Warning: Missing notebook metadata');
            }
            return {
                valid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            return {
                valid: false,
                issues: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
            };
        }
    }
}
//# sourceMappingURL=notebook-transformer.js.map