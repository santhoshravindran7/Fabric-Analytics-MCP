export declare class AzureOpenAIAnalyzer {
    private config;
    constructor(configPath?: string);
    analyzeSparkLogs(logs: string[], analysisType?: string): Promise<string>;
    analyzeStatementPerformance(statementData: any, analysisType?: string): Promise<string>;
    analyzeExecutionHistory(sessions: any[], timeRange: string, analysisType?: string): Promise<string>;
    private buildSparkAnalysisPrompt;
    private buildStatementAnalysisPrompt;
    private buildHistoryAnalysisPrompt;
    private callAzureOpenAI;
    testConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
}
