/**
 * Migration Module Types
 * Shared types for Synapse and HDInsight migration
 */

export interface MigrationSource {
  type: 'synapse' | 'hdinsight';
  resourceGroup: string;
  subscriptionId: string;
}

export interface SynapseSource extends MigrationSource {
  type: 'synapse';
  workspaceName: string;
  sparkPoolName?: string;
}

export interface HDInsightSource extends MigrationSource {
  type: 'hdinsight';
  clusterName: string;
}

export interface NotebookAsset {
  id: string;
  name: string;
  path: string;
  content: any; // ipynb JSON
  properties?: Record<string, any>;
}

export interface PipelineAsset {
  id: string;
  name: string;
  definition: any; // JSON definition
  properties?: Record<string, any>;
}

export interface LinkedServiceAsset {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
}

export interface SparkJobAsset {
  id: string;
  name: string;
  scriptPath?: string;
  mainClass?: string;
  arguments?: string[];
  libraries?: string[];
  configuration?: Record<string, string>;
}

export interface MigrationInventory {
  source: MigrationSource;
  notebooks: NotebookAsset[];
  pipelines: PipelineAsset[];
  linkedServices: LinkedServiceAsset[];
  sparkJobs: SparkJobAsset[];
  discoveredAt: Date;
}

export interface TransformationResult {
  notebookId?: string;
  notebookName: string;
  original?: string;
  originalContent?: any;
  transformed?: string;
  transformedContent: any;
  changes: CodeChange[];
  warnings?: string[];
  errors?: string[];
  success: boolean;
  requiresManualReview?: boolean;
}

export interface CodeChange {
  type: 'replacement' | 'addition' | 'removal' | 'code' | 'metadata';
  line?: number;
  location?: string;
  original: string;
  transformed: string;
  reason?: string;
  rule?: string;
}

export interface ProvisioningPlan {
  targetWorkspaceId: string;
  items: ProvisioningItem[];
  dryRun: boolean;
}

export interface ProvisioningItem {
  type: 'notebook' | 'lakehouse' | 'pipeline' | 'shortcut';
  name: string;
  sourceAsset: NotebookAsset | PipelineAsset | any;
  transformedContent?: any;
  dependencies?: string[];
}

export interface MigrationReport {
  summary: {
    totalAssets: number;
    successful: number;
    failed: number;
    requiresManualReview: number;
    duration: number; // milliseconds
  };
  details: MigrationItemResult[];
  recommendations: string[];
  generatedAt: Date;
}

export interface MigrationItemResult {
  assetName: string;
  assetType: string;
  status: 'success' | 'failed' | 'manual_review';
  fabricItemId?: string;
  changes?: CodeChange[];
  warnings?: string[];
  error?: string;
}

export interface MigrationConfig {
  sourceType?: 'synapse' | 'hdinsight';
  targetWorkspaceName?: string;
  targetLakehouseName?: string;
  targetWorkspace?: string;
  targetLakehouse?: string;
  migrateData?: boolean;
  useShortcuts?: boolean;
  createShortcuts?: boolean;
  validateAfterMigration?: boolean;
  validateTransformation?: boolean;
  dryRun?: boolean;
  backupOriginal?: boolean;
  customTransformRules?: TransformRule[];
  transformRules?: TransformRule[];
  targetEnvironment?: {
    lakehouseId?: string;
    sparkPoolSize?: 'small' | 'medium' | 'large';
  };
}

export interface TransformRule {
  name: string;
  pattern: string | RegExp;
  replacement: string | ((match: string) => string);
  description?: string;
  scope?: 'notebooks' | 'pipelines' | 'all';
}
