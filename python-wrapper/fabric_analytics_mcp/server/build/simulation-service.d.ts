import { ApiResponse } from './fabric-client.js';
/**
 * Simulation service for testing without real API access.
 * Provides realistic mock responses for all Fabric operations.
 */
export declare class SimulationService {
    /**
     * Simulate an API call with realistic response data.
     * @param operation - The operation to simulate
     * @param params - Parameters for the operation
     * @returns Promise resolving to simulated API response
     */
    static simulateApiCall(operation: string, params?: any): Promise<ApiResponse>;
    /**
     * Generate realistic sample data for different item types.
     * @param itemType - Type of item to generate data for
     * @param count - Number of items to generate
     * @returns Array of sample items
     */
    static generateSampleItems(itemType: string, count?: number): any[];
}
