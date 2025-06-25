#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var zod_1 = require("zod");
// Microsoft Fabric Analytics MCP Server
// This server provides analytics capabilities for Microsoft Fabric data platform
var server = new mcp_js_1.McpServer({
    name: "fabric-analytics",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
}, {
    capabilities: {
        logging: {}
    }
});
// Schemas for input validation
var DatasetQuerySchema = zod_1.z.object({
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    datasetName: zod_1.z.string().describe("Name of the dataset to query"),
    query: zod_1.z.string().describe("SQL or KQL query to execute"),
});
var MetricsAnalysisSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    itemId: zod_1.z.string().describe("Item ID (dataset, report, etc.)"),
    timeRange: zod_1.z.enum(["1h", "24h", "7d", "30d"]).describe("Time range for metrics"),
    metrics: zod_1.z.array(zod_1.z.string()).describe("List of metrics to analyze"),
});
var DataModelSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    itemId: zod_1.z.string().describe("Item ID to analyze"),
});
// Helper function to simulate Microsoft Fabric API calls
// In a real implementation, these would call actual Microsoft Fabric REST APIs
function simulateFabricApiCall(endpoint, data) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Simulate API delay
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                case 1:
                    // Simulate API delay
                    _a.sent();
                    // Return simulated data based on endpoint
                    switch (endpoint) {
                        case "query-dataset":
                            return [2 /*return*/, {
                                    status: "success",
                                    rows: [
                                        { id: 1, name: "Sample Product A", sales: 15000, region: "North America" },
                                        { id: 2, name: "Sample Product B", sales: 12000, region: "Europe" },
                                        { id: 3, name: "Sample Product C", sales: 8000, region: "Asia Pacific" },
                                    ],
                                    totalRows: 3,
                                    executionTime: "0.45s"
                                }];
                        case "get-metrics":
                            return [2 /*return*/, {
                                    status: "success",
                                    metrics: {
                                        totalQueries: 1247,
                                        avgResponseTime: "2.3s",
                                        errorRate: "0.02%",
                                        activeUsers: 45,
                                        dataRefreshCount: 12
                                    },
                                    timeRange: data.timeRange,
                                    timestamp: new Date().toISOString()
                                }];
                        case "analyze-model":
                            return [2 /*return*/, {
                                    status: "success",
                                    modelInfo: {
                                        tables: 8,
                                        relationships: 12,
                                        measures: 25,
                                        columns: 156,
                                        dataSize: "2.4 GB",
                                        lastRefresh: "2025-06-18T10:30:00Z"
                                    },
                                    recommendations: [
                                        "Consider partitioning the Sales table for better performance",
                                        "Add indexes on frequently queried date columns",
                                        "Review unused calculated columns in Customer table"
                                    ]
                                }];
                        default:
                            return [2 /*return*/, { status: "error", message: "Unknown endpoint" }];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Tool: Query Dataset
server.tool("query-fabric-dataset", "Execute a query against a Microsoft Fabric dataset", {
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    datasetName: zod_1.z.string().describe("Name of the dataset to query"),
    query: zod_1.z.string().describe("SQL or KQL query to execute"),
}, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var result, formattedResults, error_1;
    var workspaceId = _b.workspaceId, datasetName = _b.datasetName, query = _b.query;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, simulateFabricApiCall("query-dataset", {
                        workspaceId: workspaceId,
                        datasetName: datasetName,
                        query: query
                    })];
            case 1:
                result = _c.sent();
                if (result.status === "error") {
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error executing query: ".concat(result.message)
                                }
                            ]
                        }];
                }
                formattedResults = result.rows.map(function (row, index) {
                    return "Row ".concat(index + 1, ": ").concat(Object.entries(row).map(function (_a) {
                        var key = _a[0], value = _a[1];
                        return "".concat(key, ": ").concat(value);
                    }).join(", "));
                }).join("\n");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Query Results for dataset \"".concat(datasetName, "\":\n\n").concat(formattedResults, "\n\nTotal Rows: ").concat(result.totalRows, "\nExecution Time: ").concat(result.executionTime)
                            }
                        ]
                    }];
            case 2:
                error_1 = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Failed to execute query: ".concat(error_1 instanceof Error ? error_1.message : String(error_1))
                            }
                        ]
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Tool: Get Analytics Metrics
server.tool("get-fabric-metrics", "Retrieve analytics metrics for Microsoft Fabric items", {
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    itemId: zod_1.z.string().describe("Item ID (dataset, report, etc.)"),
    timeRange: zod_1.z.enum(["1h", "24h", "7d", "30d"]).describe("Time range for metrics"),
    metrics: zod_1.z.array(zod_1.z.string()).describe("List of metrics to analyze"),
}, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var result, metricsText, error_2;
    var workspaceId = _b.workspaceId, itemId = _b.itemId, timeRange = _b.timeRange, metrics = _b.metrics;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, simulateFabricApiCall("get-metrics", {
                        workspaceId: workspaceId,
                        itemId: itemId,
                        timeRange: timeRange,
                        metrics: metrics
                    })];
            case 1:
                result = _c.sent();
                if (result.status === "error") {
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error retrieving metrics: ".concat(result.message)
                                }
                            ]
                        }];
                }
                metricsText = Object.entries(result.metrics)
                    .map(function (_a) {
                    var key = _a[0], value = _a[1];
                    return "".concat(key, ": ").concat(value);
                })
                    .join("\n");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Analytics Metrics (".concat(timeRange, "):\n\n").concat(metricsText, "\n\nTimestamp: ").concat(result.timestamp)
                            }
                        ]
                    }];
            case 2:
                error_2 = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Failed to retrieve metrics: ".concat(error_2 instanceof Error ? error_2.message : String(error_2))
                            }
                        ]
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Tool: Analyze Data Model
server.tool("analyze-fabric-model", "Analyze a Microsoft Fabric data model and get optimization recommendations", {
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    itemId: zod_1.z.string().describe("Item ID to analyze"),
}, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var result, modelInfoText, recommendationsText, error_3;
    var workspaceId = _b.workspaceId, itemId = _b.itemId;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, simulateFabricApiCall("analyze-model", {
                        workspaceId: workspaceId,
                        itemId: itemId
                    })];
            case 1:
                result = _c.sent();
                if (result.status === "error") {
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error analyzing model: ".concat(result.message)
                                }
                            ]
                        }];
                }
                modelInfoText = Object.entries(result.modelInfo)
                    .map(function (_a) {
                    var key = _a[0], value = _a[1];
                    return "".concat(key, ": ").concat(value);
                })
                    .join("\n");
                recommendationsText = result.recommendations
                    .map(function (rec, index) { return "".concat(index + 1, ". ").concat(rec); })
                    .join("\n");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Data Model Analysis:\n\n".concat(modelInfoText, "\n\nRecommendations:\n").concat(recommendationsText)
                            }
                        ]
                    }];
            case 2:
                error_3 = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Failed to analyze model: ".concat(error_3 instanceof Error ? error_3.message : String(error_3))
                            }
                        ]
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Tool: Generate Analytics Report
server.tool("generate-fabric-report", "Generate a comprehensive analytics report for Microsoft Fabric workspace", {
    workspaceId: zod_1.z.string().describe("Microsoft Fabric workspace ID"),
    reportType: zod_1.z.enum(["performance", "usage", "health", "summary"]).describe("Type of report to generate"),
}, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var reportContent;
    var workspaceId = _b.workspaceId, reportType = _b.reportType;
    return __generator(this, function (_c) {
        try {
            reportContent = "";
            switch (reportType) {
                case "performance":
                    reportContent = "Performance Report for Workspace ".concat(workspaceId, "\n          \n\uD83D\uDCCA Query Performance:\n- Average response time: 2.3 seconds\n- 95th percentile: 5.1 seconds\n- Slowest queries: 3 identified\n- Query optimization opportunities: 5\n\n\uD83D\uDD04 Data Refresh Performance:\n- Last refresh: Success (12 minutes ago)\n- Average refresh time: 8.5 minutes\n- Failed refreshes (24h): 0\n- Refresh schedule adherence: 98.5%\n\n\uD83D\uDCBE Storage Performance:\n- Data compression ratio: 85%\n- Index effectiveness: Good\n- Partition health: Optimal");
                    break;
                case "usage":
                    reportContent = "Usage Report for Workspace ".concat(workspaceId, "\n          \n\uD83D\uDC65 User Activity:\n- Active users (24h): 45\n- Total sessions: 156\n- Peak usage time: 10:00 AM - 12:00 PM\n- Most accessed reports: Sales Dashboard, Financial Overview\n\n\uD83D\uDCC8 Data Consumption:\n- Queries executed: 1,247\n- Data processed: 15.6 GB\n- Most queried tables: Sales, Customer, Product\n- API calls: 892");
                    break;
                case "health":
                    reportContent = "Health Report for Workspace ".concat(workspaceId, "\n          \n\u2705 System Status: Healthy\n- All services operational\n- No critical alerts\n- Data freshness: Current\n\n\u26A0\uFE0F Warnings:\n- Dataset 'Marketing Analytics' approaching capacity limit\n- Scheduled refresh for 'Customer360' delayed by 15 minutes\n\n\uD83D\uDD27 Maintenance Recommendations:\n- Update connection credentials for 'SalesDB' (expires in 7 days)\n- Review unused datasets (3 identified)\n- Optimize large tables for better performance");
                    break;
                case "summary":
                    reportContent = "Executive Summary for Workspace ".concat(workspaceId, "\n          \n\uD83D\uDCCA Key Metrics:\n- Total Datasets: 12\n- Active Reports: 8\n- Data Volume: 2.4 GB\n- Monthly Growth: +12%\n\n\uD83D\uDC65 User Engagement:\n- Daily Active Users: 45\n- Report Views: 1,856\n- User Satisfaction: 4.2/5\n\n\uD83D\uDCA1 Business Impact:\n- Queries answered: 1,247\n- Decisions supported: 89\n- Time saved: ~120 hours/month\n- ROI: 340%\n\n\uD83C\uDFAF Next Steps:\n- Expand to additional departments\n- Implement real-time analytics\n- Add predictive modeling capabilities");
                    break;
            }
            return [2 /*return*/, {
                    content: [
                        {
                            type: "text",
                            text: reportContent
                        }
                    ]
                }];
        }
        catch (error) {
            return [2 /*return*/, {
                    content: [
                        {
                            type: "text",
                            text: "Failed to generate report: ".concat(error instanceof Error ? error.message : String(error))
                        }
                    ]
                }];
        }
        return [2 /*return*/];
    });
}); });
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    console.error("Microsoft Fabric Analytics MCP Server running on stdio");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
