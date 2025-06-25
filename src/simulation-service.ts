import { ApiResponse } from './fabric-client.js';

/**
 * Simulation service for testing without real API access.
 * Provides realistic mock responses for all Fabric operations.
 */
export class SimulationService {
  /**
   * Simulate an API call with realistic response data.
   * @param operation - The operation to simulate
   * @param params - Parameters for the operation
   * @returns Promise resolving to simulated API response
   */
  static async simulateApiCall(operation: string, params: any = {}): Promise<ApiResponse> {
    // Simulate network delay (500ms to 1.5s)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    switch (operation) {
      case "list-items":
        return {
          status: 'success',
          data: {
            value: [
              {
                id: "lh-sample-001",
                displayName: "Sales Analytics Lakehouse",
                type: "Lakehouse",
                description: "Main lakehouse for sales data processing",
                createdDate: "2025-06-01T10:00:00Z",
                modifiedDate: "2025-06-18T08:30:00Z"
              },
              {
                id: "nb-sample-001",
                displayName: "Customer Analysis Notebook",
                type: "Notebook",
                description: "Notebook for customer segmentation analysis",
                createdDate: "2025-06-10T14:20:00Z",
                modifiedDate: "2025-06-18T09:15:00Z"
              },
              {
                id: "ds-sample-001",
                displayName: "Revenue Dataset",
                type: "Dataset",
                description: "Dataset containing revenue analytics",
                createdDate: "2025-06-05T16:45:00Z",
                modifiedDate: "2025-06-17T11:20:00Z"
              }
            ]
          }
        };

      case "create-item":
        return {
          status: 'success',
          data: {
            id: `${params.itemType.toLowerCase()}-${Date.now()}`,
            displayName: params.displayName,
            type: params.itemType,
            description: params.description || "",
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString()
          }
        };

      case "get-item":
        return {
          status: 'success',
          data: {
            id: params.itemId,
            displayName: "Sample Item",
            type: "Lakehouse",
            description: "Sample item for testing",
            createdDate: "2025-06-01T10:00:00Z",
            modifiedDate: "2025-06-18T08:30:00Z",
            properties: {
              owner: "test-user@fabric.microsoft.com",
              size: "2.5 GB",
              lastAccessed: "2025-06-18T07:15:00Z"
            }
          }
        };

      case "update-item":
        return {
          status: 'success',
          data: {
            id: params.itemId,
            displayName: params.updates.displayName || "Updated Item",
            description: params.updates.description || "Updated description",
            modifiedDate: new Date().toISOString()
          }
        };

      case "delete-item":
        return {
          status: 'success',
          data: {
            message: `Item ${params.itemId} successfully deleted`,
            deletedAt: new Date().toISOString()
          }
        };

      case "execute-notebook":
        return {
          status: 'success',
          data: {
            id: `job-nb-${Date.now()}`,
            status: "Running",
            createdDateTime: new Date().toISOString(),
            type: "NotebookExecution",
            notebookId: params.notebookId,
            parameters: params.parameters || {},
            estimatedDuration: "5-10 minutes"
          }
        };

      case "spark-job":
        return {
          status: 'success',
          data: {
            id: `spark-job-${Date.now()}`,
            status: "Submitted",
            createdDateTime: new Date().toISOString(),
            language: params.language || "python",
            lakehouseId: params.lakehouseId,
            clusterInfo: params.config || {
              driverCores: 4,
              driverMemory: "8g",
              executorCores: 2,
              executorMemory: "4g",
              numExecutors: 2
            },
            estimatedDuration: "2-5 minutes"
          }
        };

      case "job-status":
        const statuses = ["Running", "Completed", "Failed", "Cancelled"];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const baseResponse = {
          id: params.jobId,
          status: randomStatus,
          createdDateTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        };

        if (randomStatus === "Completed") {
          return {
            status: 'success',
            data: {
              ...baseResponse,
              completedDateTime: new Date().toISOString(),
              duration: "4m 32s",
              output: "Job completed successfully. Processed 10,000 records."
            }
          };
        } else if (randomStatus === "Failed") {
          return {
            status: 'success',
            data: {
              ...baseResponse,
              completedDateTime: new Date().toISOString(),
              error: "Sample execution error for testing: Connection timeout to data source",
              duration: "2m 15s"
            }
          };
        } else if (randomStatus === "Cancelled") {
          return {
            status: 'success',
            data: {
              ...baseResponse,
              completedDateTime: new Date().toISOString(),
              duration: "1m 45s",
              reason: "Cancelled by user request"
            }
          };
        } else {
          return {
            status: 'success',
            data: {
              ...baseResponse,
              progress: Math.floor(Math.random() * 80) + 10, // 10-90% progress
              currentStep: "Processing data transformations",
              estimatedTimeRemaining: "2-3 minutes"
            }
          };
        }

      case "analytics-query":
        return {
          status: 'success',
          data: {
            queryId: `query-${Date.now()}`,
            results: {
              totalRows: 15432,
              columns: ["Region", "Sales", "Growth"],
              rows: [
                ["North America", 2450000, 12.5],
                ["Europe", 1890000, 8.3],
                ["Asia Pacific", 3200000, 15.7],
                ["Latin America", 890000, 6.2]
              ],
              executionTime: "1.2s",
              dataRefreshed: new Date().toISOString()
            }
          }
        };

      default:
        return {
          status: 'error',
          error: `Unknown simulation operation: ${operation}`
        };
    }
  }

  /**
   * Generate realistic sample data for different item types.
   * @param itemType - Type of item to generate data for
   * @param count - Number of items to generate
   * @returns Array of sample items
   */
  static generateSampleItems(itemType: string, count: number = 5): any[] {
    const items = [];
    const now = new Date();
    
    for (let i = 1; i <= count; i++) {
      const createdDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const modifiedDate = new Date(now.getTime() - (Math.random() * 12 * 60 * 60 * 1000));
      
      switch (itemType) {
        case "Lakehouse":
          items.push({
            id: `lh-${String(i).padStart(3, '0')}`,
            displayName: `${["Sales", "Marketing", "Finance", "Operations", "Analytics"][i - 1] || "Data"} Lakehouse`,
            type: "Lakehouse",
            description: `Lakehouse for ${["sales analytics", "customer data", "financial reporting", "operational metrics", "business intelligence"][i - 1] || "data processing"}`,
            createdDate: createdDate.toISOString(),
            modifiedDate: modifiedDate.toISOString(),
            size: `${Math.floor(Math.random() * 50 + 10)} GB`
          });
          break;
          
        case "Notebook":
          items.push({
            id: `nb-${String(i).padStart(3, '0')}`,
            displayName: `${["Customer Segmentation", "Revenue Analysis", "Predictive Modeling", "Data Quality", "ETL Pipeline"][i - 1] || "Analytics"} Notebook`,
            type: "Notebook",
            description: `Notebook for ${["customer analysis", "revenue insights", "ML predictions", "data validation", "data processing"][i - 1] || "analytics"}`,
            createdDate: createdDate.toISOString(),
            modifiedDate: modifiedDate.toISOString(),
            language: ["Python", "SQL", "R", "Scala"][Math.floor(Math.random() * 4)]
          });
          break;
          
        default:
          items.push({
            id: `${itemType.toLowerCase()}-${String(i).padStart(3, '0')}`,
            displayName: `Sample ${itemType} ${i}`,
            type: itemType,
            description: `Sample ${itemType.toLowerCase()} for testing`,
            createdDate: createdDate.toISOString(),
            modifiedDate: modifiedDate.toISOString()
          });
      }
    }
    
    return items;
  }
}
