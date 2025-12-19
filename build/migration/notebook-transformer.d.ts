/**
 * Notebook Transformation Module
 * Transforms Synapse notebooks to Fabric-compatible format
 */
import { NotebookAsset, TransformationResult, MigrationConfig } from './types.js';
export declare class NotebookTransformer {
    private config;
    constructor(config?: Partial<MigrationConfig>);
    /**
     * Default transformation rules for Synapse to Fabric
     */
    private getDefaultTransformRules;
    /**
     * Transform a single notebook
     */
    transformNotebook(notebook: NotebookAsset): Promise<TransformationResult>;
    /**
     * Transform notebook metadata
     */
    private transformNotebookMetadata;
    /**
     * Transform multiple notebooks in batch
     */
    transformNotebooks(notebooks: NotebookAsset[]): Promise<TransformationResult[]>;
    /**
     * Generate transformation report
     */
    generateTransformationReport(results: TransformationResult[]): string;
    /**
     * Validate transformed notebook
     */
    validateTransformedNotebook(result: TransformationResult): {
        valid: boolean;
        issues: string[];
    };
}
