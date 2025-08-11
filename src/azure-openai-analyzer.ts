import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

interface AzureOpenAIConfig {
  azureOpenAI: {
    apiKey: string;
    endpoint: string;
    apiVersion: string;
    deploymentName: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  analysis: {
    enableLLMAnalysis: boolean;
    analysisTypes: string[];
  };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class AzureOpenAIAnalyzer {
  private config: AzureOpenAIConfig;

  constructor(configPath?: string) {
    const configFile = configPath || path.join(process.cwd(), 'azure-openai-config.json');
    this.config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }

  async analyzeSparkLogs(logs: string[], analysisType: string = 'comprehensive'): Promise<string> {
    if (!this.config.analysis.enableLLMAnalysis) {
      return "LLM analysis is disabled in configuration";
    }

    const prompt = this.buildSparkAnalysisPrompt(logs, analysisType);
    return await this.callAzureOpenAI(prompt);
  }

  async analyzeStatementPerformance(statementData: any, analysisType: string = 'optimization'): Promise<string> {
    if (!this.config.analysis.enableLLMAnalysis) {
      return "LLM analysis is disabled in configuration";
    }

    const prompt = this.buildStatementAnalysisPrompt(statementData, analysisType);
    return await this.callAzureOpenAI(prompt);
  }

  async analyzeExecutionHistory(sessions: any[], timeRange: string, analysisType: string = 'trends'): Promise<string> {
    if (!this.config.analysis.enableLLMAnalysis) {
      return "LLM analysis is disabled in configuration";
    }

    const prompt = this.buildHistoryAnalysisPrompt(sessions, timeRange, analysisType);
    return await this.callAzureOpenAI(prompt);
  }

  private buildSparkAnalysisPrompt(logs: string[], analysisType: string): string {
    const logSample = logs.slice(0, 50).join('\n'); // First 50 lines
    
    return `You are a Spark performance expert. Analyze the following Spark session logs and provide insights based on the analysis type: ${analysisType}.

Spark Session Logs:
${logSample}

Please provide:
1. Performance bottlenecks identified
2. Memory usage patterns
3. Error analysis (if any)
4. Optimization recommendations
5. Resource utilization insights

Focus on actionable recommendations for improving Spark job performance.`;
  }

  private buildStatementAnalysisPrompt(statementData: any, analysisType: string): string {
    return `You are a Spark SQL optimization expert. Analyze the following Spark statement execution and provide ${analysisType} insights.

Statement Details:
- Code: ${statementData.code}
- State: ${statementData.state}
- Execution Time: ${statementData.executionTime || 'Unknown'}
- Output Type: ${statementData.outputType || 'Unknown'}

Please provide:
1. Query optimization opportunities
2. Performance analysis
3. Best practices recommendations
4. Potential issues and solutions
5. Resource optimization suggestions

Focus on specific, actionable improvements for this Spark statement.`;
  }

  private buildHistoryAnalysisPrompt(sessions: any[], timeRange: string, analysisType: string): string {
    const sessionSummary = sessions.map(s => ({
      id: s.id,
      state: s.state,
      kind: s.kind,
      duration: s.duration || 'Unknown'
    }));

    return `You are a Spark operations analyst. Analyze the following session execution history over ${timeRange} and provide ${analysisType} insights.

Session History Summary:
${JSON.stringify(sessionSummary, null, 2)}

Please provide:
1. Performance trends analysis
2. Failure pattern identification
3. Resource utilization trends
4. Operational recommendations
5. Capacity planning insights

Focus on trends and patterns that can help optimize overall Spark operations.`;
  }

  private async callAzureOpenAI(prompt: string): Promise<string> {
    const { azureOpenAI } = this.config;
    
    const url = `${azureOpenAI.endpoint}openai/deployments/${azureOpenAI.deploymentName}/chat/completions?api-version=${azureOpenAI.apiVersion}`;
    
    const requestBody = {
      messages: [
        {
          role: "system",
          content: "You are an expert Apache Spark performance analyst and optimization consultant. Provide detailed, actionable insights and recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: azureOpenAI.maxTokens,
      temperature: azureOpenAI.temperature,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureOpenAI.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;
      return data.choices[0]?.message?.content || "No response from Azure OpenAI";
    } catch (error) {
      console.error('Azure OpenAI API call failed:', error);
      return `Error calling Azure OpenAI: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testPrompt = "Hello, this is a test connection to Azure OpenAI. Please respond with 'Connection successful' and today's date.";
      const response = await this.callAzureOpenAI(testPrompt);
      
      if (response.includes('Error calling Azure OpenAI')) {
        return {
          success: false,
          message: response
        };
      }
      
      return {
        success: true,
        message: `✅ Azure OpenAI connection successful! Response: ${response}`
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Connection test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
