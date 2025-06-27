# Notebook Management API - Test Guide

This guide demonstrates how to use the new notebook management capabilities added to the Microsoft Fabric Analytics MCP Server.

## New Tools Available

### 1. create-fabric-notebook
Creates a new Fabric notebook from predefined templates or custom definitions.

**Parameters:**
- `bearerToken`: Authentication token
- `workspaceId`: Target workspace ID  
- `displayName`: Name for the new notebook
- `template`: Template type (blank, sales_analysis, nyc_taxi_analysis, data_exploration, machine_learning, custom)
- `customNotebook`: Custom notebook definition (required if template is 'custom')
- `environmentId`: Optional environment ID to attach
- `lakehouseId`: Optional default lakehouse ID
- `lakehouseName`: Optional default lakehouse name

**Templates Available:**
1. **blank**: Basic notebook with minimal setup
2. **sales_analysis**: Comprehensive sales data analysis with sample dataset
3. **nyc_taxi_analysis**: NYC taxi trip data analysis with sample dataset  
4. **data_exploration**: Structured data exploration template
5. **machine_learning**: Complete ML workflow template
6. **custom**: Use your own notebook definition

### 2. get-fabric-notebook-definition
Retrieves the notebook definition (cells, metadata) from an existing Fabric notebook.

**Parameters:**
- `bearerToken`: Authentication token
- `workspaceId`: Workspace ID containing the notebook
- `notebookId`: ID of the notebook to retrieve
- `format`: Format to return (ipynb or fabricGitSource)

### 3. update-fabric-notebook-definition
Updates the notebook definition (cells, metadata) of an existing Fabric notebook.

**Parameters:**
- `bearerToken`: Authentication token
- `workspaceId`: Workspace ID containing the notebook
- `notebookId`: ID of the notebook to update
- `notebookDefinition`: Updated notebook definition object

### 4. run-fabric-notebook
Executes a Fabric notebook on-demand with optional parameters and configuration.

**Parameters:**
- `bearerToken`: Authentication token
- `workspaceId`: Workspace ID containing the notebook
- `notebookId`: ID of the notebook to run
- `parameters`: Optional notebook parameters (key-value pairs with types)
- `configuration`: Optional execution configuration (environment, lakehouse, pools, etc.)

## Sample Usage Examples

### Create a Sales Analysis Notebook
```json
{
  "bearerToken": "your-token",
  "workspaceId": "your-workspace-id", 
  "displayName": "Sales Analysis Q4 2024",
  "template": "sales_analysis",
  "lakehouseId": "your-lakehouse-id",
  "lakehouseName": "Sales Data Lakehouse"
}
```

### Create a Custom Notebook
```json
{
  "bearerToken": "your-token",
  "workspaceId": "your-workspace-id",
  "displayName": "Custom Analysis",
  "template": "custom",
  "customNotebook": {
    "nbformat": 4,
    "nbformat_minor": 5,
    "cells": [
      {
        "cell_type": "markdown",
        "source": ["# My Custom Analysis"],
        "metadata": {}
      },
      {
        "cell_type": "code", 
        "source": ["print('Hello World')"],
        "execution_count": null,
        "outputs": [],
        "metadata": {}
      }
    ],
    "metadata": {
      "language_info": {"name": "python"}
    }
  }
}
```

### Run Notebook with Parameters
```json
{
  "bearerToken": "your-token",
  "workspaceId": "your-workspace-id",
  "notebookId": "your-notebook-id",
  "parameters": {
    "start_date": {
      "value": "2024-01-01",
      "type": "string"
    },
    "end_date": {
      "value": "2024-12-31", 
      "type": "string"
    },
    "sample_size": {
      "value": 10000,
      "type": "int"
    }
  },
  "configuration": {
    "environment": {
      "id": "your-environment-id",
      "name": "Python Environment"
    },
    "defaultLakehouse": {
      "id": "your-lakehouse-id",
      "name": "Data Lakehouse"
    },
    "useStarterPool": true,
    "conf": {
      "spark.sql.adaptive.enabled": "true",
      "spark.sql.adaptive.coalescePartitions.enabled": "true"
    }
  }
}
```

## Features

### Template Notebooks Include:
- **Sales Analysis**: Complete sales data analysis with sample dataset generation, trend analysis, category breakdown, and visualizations
- **NYC Taxi Analysis**: Comprehensive taxi trip analysis with geographic patterns, time-based trends, and fare analysis
- **Data Exploration**: Structured approach to data inspection, statistical summaries, and quality assessment
- **Machine Learning**: Full ML workflow from preprocessing to model evaluation and interpretation

### Advanced Capabilities:
- Base64 encoded notebook payload support
- Comprehensive metadata management
- Environment and lakehouse integration
- Parameterized notebook execution
- Spark configuration support
- Support for multiple programming languages (Python, Scala, SQL, R)

### Enterprise Features:
- Secure token-based authentication
- Workspace isolation
- Integration with Fabric environments
- Support for starter pools and workspace pools
- Comprehensive error handling and validation
