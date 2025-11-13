# MCP Tools User Guide - Synapse to Fabric Migration

## Overview
This guide shows how to use the Fabric Analytics MCP tools through GitHub Copilot to migrate from Azure Synapse Analytics to Microsoft Fabric.

## Available MCP Tools

### 1. **fabric_synapse_workspace_details**
Get complete details about a Synapse workspace including notebooks, pipelines, Spark pools, and linked services.

**Example Copilot Prompt:**
```
Get me the details of my Synapse workspace 'samplesynapseworkspace' in resource group 'sparkpmteam_rc'
```

**What it does:**
- ✅ Calls Azure Management API to get workspace metadata
- ✅ Discovers all notebooks, pipelines, and Spark pools
- ✅ Returns inventory for migration planning

**Azure API Integration:**
- Azure Resource Manager API (workspace metadata)
- Synapse Management API (notebooks, pipelines)
- Spark Pool Management API (pool configurations)

---

### 2. **fabric_synapse_compute_spend**
Analyze compute spending for a Synapse workspace over a time period.

**Example Copilot Prompt:**
```
Show me the compute spend for my Synapse workspace 'samplesynapseworkspace' over the last 30 days
```

**What it does:**
- ✅ Calls Azure Cost Management API for actual spend data
- ✅ Falls back to intelligent estimation based on pool configurations
- ✅ Breaks down costs by Spark pools, storage, and other services

**Azure API Integration:**
- Azure Cost Management API (actual spend data)
- Spark Pool API (for estimation if Cost API unavailable)

---

### 3. **fabric_recommend_fabric_capacity**
Get intelligent Fabric capacity recommendations based on Synapse compute usage.

**Example Copilot Prompt:**
```
What Fabric capacity should I use to migrate my Synapse workspace with 72 vCores?
```

**What it does:**
- ✅ Fetches real-time Fabric pricing from Azure Retail Prices API
- ✅ Calculates required Fabric vCores (1 Synapse vCore = 2 Fabric vCores)
- ✅ Recommends optimal F-series SKU with confidence level
- ✅ Shows cost comparison and potential savings

**Azure API Integration:**
- Azure Retail Prices API (real-time Fabric pricing)
- Uses Capacity Unit (CU) pricing at $0.18/hour per CU
- Calculates F-series pricing: F64 = 64 CUs × $0.18 = $11.52/hour

---

### 4. **fabric_migrate_spark_pools_to_fabric**
Convert Synapse Spark pool configurations to Fabric equivalents and validate capacity.

**Example Copilot Prompt:**
```
Migrate my Synapse Spark pools to Fabric F64 capacity
```

**What it does:**
- ✅ Converts Synapse node sizes to Fabric executor configurations
- ✅ Applies 1:2 vCore conversion ratio
- ✅ Validates all pools fit within target capacity
- ✅ Provides detailed migration recommendations

**Conversion Logic:**
- Synapse Small (4 vCores) → Fabric 8 vCores
- Synapse Medium (8 vCores) → Fabric 16 vCores
- Synapse Large (16 vCores) → Fabric 32 vCores
- Auto-scale → Dynamic executor allocation

---

### 5. **fabric_migrate_synapse_to_fabric** (Full Migration)
Execute complete end-to-end migration from Synapse to Fabric.

**Example Copilot Prompt:**
```
Migrate my Synapse workspace 'samplesynapseworkspace' to Fabric workspace '43f2c633-e5c1-4e1d-906e-789cd4f081a2'
```

**What it does:**
- ✅ Discovers all Synapse assets
- ✅ Transforms notebooks (mssparkutils → notebookutils)
- ✅ Provisions notebooks to Fabric workspace
- ✅ Creates lakehouse if needed
- ✅ Generates comprehensive migration report

---

## Example End-to-End Migration Workflow

### Step 1: Get Workspace Details
**Copilot Prompt:**
```
Show me all the assets in my Synapse workspace 'samplesynapseworkspace'
```

**Tool Used:** `fabric_synapse_workspace_details`

**Result:**
- 2 notebooks discovered
- 2 Spark pools (SampleSpark, sampleLargePool)
- 72 total Synapse vCores

---

### Step 2: Analyze Compute Spend
**Copilot Prompt:**
```
What's my monthly compute spend for this Synapse workspace?
```

**Tool Used:** `fabric_synapse_compute_spend`

**Result:**
- Total spend: $22,080/month (estimated)
- Primary driver: Spark Compute
- Period: Last 30 days

---

### Step 3: Get Capacity Recommendation
**Copilot Prompt:**
```
Recommend a Fabric capacity for migrating this workspace
```

**Tool Used:** `fabric_recommend_fabric_capacity`

**Result:**
- **Recommended SKU: F64**
- **Confidence: HIGH**
- **Pricing Source: Azure Retail Prices API**
- **Cost: $8,409.60/month**
- **Savings: $13,670.40/month (61.9%)**

---

### Step 4: Validate Spark Pool Migration
**Copilot Prompt:**
```
Validate my Spark pools can run on Fabric F64 capacity
```

**Tool Used:** `fabric_migrate_spark_pools_to_fabric`

**Result:**
- ✅ All pools can run within base capacity
- ✅ SampleSpark: 48/128 vCores
- ✅ sampleLargePool: 96/128 vCores
- Detailed executor configurations provided

---

### Step 5: Execute Full Migration (Optional)
**Copilot Prompt:**
```
Migrate everything to my Fabric workspace with lakehouse 'SynapseMigration'
```

**Tool Used:** `fabric_migrate_synapse_to_fabric`

**Result:**
- Notebooks transformed and provisioned
- Lakehouse created
- Migration report generated

---

## Azure API Integration Summary

### APIs Used:
| API | Purpose | Authentication |
|-----|---------|----------------|
| **Azure Resource Manager** | Workspace metadata | Azure CLI token |
| **Azure Cost Management** | Actual spend data | Azure CLI token |
| **Azure Retail Prices** | Real-time Fabric pricing | Public API (no auth) |
| **Synapse Management** | Notebooks, pipelines | Azure CLI token |
| **Spark Pool Management** | Pool configurations | Azure CLI token |

### Pricing Accuracy:
- ✅ **Real-time pricing** from Azure Retail Prices API
- ✅ **Capacity Unit (CU) based:** $0.18/hour per CU
- ✅ **F-series calculation:** F64 = 64 CUs × $0.18 = $11.52/hour
- ✅ **Regional pricing** based on workspace location

---

## Test Results

### ✅ All MCP Tools Validated:

**Test Workspace:** `samplesynapseworkspace` (sparkpmteam_rc)

**Results:**
- ✅ Workspace details retrieved via Azure Management API
- ✅ Compute spend analyzed ($22,080/month estimated)
- ✅ Real-time pricing fetched from Azure Retail Prices API
- ✅ F64 capacity recommended with HIGH confidence
- ✅ Spark pool migration validated (all pools fit)
- ✅ Detailed migration recommendations generated

**Pricing Source:** Azure Retail Prices API ✅

---

## Benefits of MCP Tool Integration

### For Users:
- 🗣️ **Natural language interface** - Just ask Copilot
- 📊 **Real-time data** - Actual Azure API responses
- 💰 **Accurate pricing** - Live from Azure Retail Prices API
- ✅ **Validation** - Know before you migrate
- 📋 **Reports** - Comprehensive migration analysis

### For Developers:
- 🔧 **Modular tools** - Each tool is independent
- 🔄 **Composable** - Chain tools together
- 📦 **Testable** - Validated end-to-end
- 🌐 **Azure-native** - Official API integration

---

## Next Steps

1. **Test with your workspace:**
   ```
   Get details for my Synapse workspace '<your-workspace-name>'
   ```

2. **Get recommendations:**
   ```
   Recommend Fabric capacity for my workspace
   ```

3. **Validate migration:**
   ```
   Check if my Spark pools will work on F64
   ```

4. **Execute migration:**
   ```
   Migrate to Fabric workspace '<workspace-id>'
   ```

---

## Support

For issues or questions:
- Check test results: `node test-mcp-tools-e2e.mjs`
- Review logs in terminal output
- Verify Azure CLI authentication: `az account show`

---

**Last Updated:** November 13, 2025  
**Status:** ✅ All tools working with Azure API integration
