# KG Consistency Checker Integration Guide

## Overview

The KG Consistency Checker validates the knowledge graph against the indexed narrative text and generates natural language descriptions of the graph. This guide shows how to integrate it into the KG building pipeline.

## Integration Point

The consistency checker should be called **after** the knowledge graph is fully built but **before** returning the result to the caller. This is typically at the end of the `buildKnowledgeGraph` function in `kg/services/kg_service.js`.

## Integration Steps

### 1. Import the Consistency Checker

Add the import at the top of `kg/services/kg_service.js`:

```javascript
const { createKGConsistencyChecker } = require('../preprocessing/kg_consistency_checker');
```

### 2. Add Consistency Check Step

Add this code after Step 8 (Quality filtering) and before returning the result:

```javascript
// Step 9: Knowledge Graph Consistency Check (Optional)
if (options.enableConsistencyCheck && llmClient) {
  try {
    console.log(`[KG Service] Checking knowledge graph consistency...`);
    
    // Get the indexed text for this document
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const documentIndex = await prisma.documentIndex.findFirst({
      where: { docId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (documentIndex) {
      // Get all entities and relations for this document
      const entities = await entityStore.getEntitiesByDocument(docId);
      const relations = await relationStore.getRelationsByDocument(docId);
      
      const graph = { entities, relations };
      
      // Create consistency checker
      const consistencyChecker = createKGConsistencyChecker({
        timeout: 30000,
        consistencyThreshold: 0.8
      });
      
      // Check consistency
      const consistencyResult = await consistencyChecker.checkConsistency(
        graph,
        documentIndex.indexedText,
        llmClient
      );
      
      // Generate graph descriptions (both brief and detailed)
      const briefDescription = consistencyChecker.generateGraphDescription(graph, 'brief');
      const detailedDescription = consistencyChecker.generateGraphDescription(graph, 'detailed');
      
      // Save descriptions to database
      await consistencyChecker.saveGraphDescription(
        docId,
        briefDescription,
        'brief',
        {
          entityCount: entities.length,
          relationCount: relations.length,
          consistencyScore: consistencyResult.consistencyScore
        },
        prisma
      );
      
      await consistencyChecker.saveGraphDescription(
        docId,
        detailedDescription,
        'detailed',
        {
          entityCount: entities.length,
          relationCount: relations.length,
          consistencyScore: consistencyResult.consistencyScore
        },
        prisma
      );
      
      // Add consistency info to result
      result.consistency = {
        score: consistencyResult.consistencyScore,
        isConsistent: consistencyResult.isConsistent,
        issuesCount: consistencyResult.issues.length,
        briefDescription,
        detailedDescription
      };
      
      console.log(`[KG Service] Consistency check complete: score=${consistencyResult.consistencyScore}, issues=${consistencyResult.issues.length}`);
      
      // Log issues if any
      if (consistencyResult.issues.length > 0) {
        console.warn(`[KG Service] Consistency issues found:`, consistencyResult.issues);
      }
    } else {
      console.log(`[KG Service] No document index found, skipping consistency check`);
    }
  } catch (error) {
    console.error(`[KG Service] Consistency check failed:`, error);
    result.errors.push({ step: 'consistency_check', error: error.message });
    // Don't fail the entire build if consistency check fails
  }
}
```

### 3. Update Function Options

Update the function signature to accept the new option:

```javascript
async function buildKnowledgeGraph(docId, filePath, fileType, options = {}) {
  const {
    llmClient = null,
    enableSemanticRelations = true,
    enableQualityFilter = true,
    enableConsistencyCheck = false  // Add this option
  } = options;
  
  // ... rest of the function
}
```

### 4. Enable Consistency Check

When calling `buildKnowledgeGraph`, pass the option:

```javascript
const result = await kgService.buildKnowledgeGraph(
  docId,
  filePath,
  fileType,
  {
    llmClient: myLLMClient,
    enableConsistencyCheck: true  // Enable consistency checking
  }
);
```

## Configuration

The consistency checker can be configured with the following options:

- `temperature`: LLM temperature (default: 0.1)
- `timeout`: LLM call timeout in milliseconds (default: 30000)
- `maxRetries`: Maximum retry attempts (default: 2)
- `consistencyThreshold`: Threshold for considering graph consistent (default: 0.8)

## Environment Variables

You can also configure via environment variables:

```bash
LLM_TEMPERATURE=0.1
LLM_TIMEOUT=30000
LLM_MAX_RETRIES=2
```

## Result Structure

When consistency check is enabled, the result will include:

```javascript
{
  doc_id: "...",
  ckbs_created: 10,
  entities_created: 5,
  relations_created: { ... },
  consistency: {
    score: 0.85,
    isConsistent: true,
    issuesCount: 0,
    briefDescription: "图谱包含 5 个实体和 3 个关系...",
    detailedDescription: "# 知识图谱描述\n..."
  },
  processing_time: 5000,
  errors: []
}
```

## Querying Graph Descriptions

To retrieve saved graph descriptions:

```javascript
const { createKGConsistencyChecker } = require('./kg/preprocessing/kg_consistency_checker');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const checker = createKGConsistencyChecker();

// Get brief description
const briefDesc = await checker.getGraphDescription(docId, 'brief', prisma);
console.log(briefDesc.description);

// Get detailed description
const detailedDesc = await checker.getGraphDescription(docId, 'detailed', prisma);
console.log(detailedDesc.description);
```

## API Endpoints

You can also expose the consistency check via API endpoints:

```javascript
// In routes/knowledgeGraphRoutes.js

router.get('/api/kg/:docId/description/:type', async (req, res) => {
  const { docId, type } = req.params;
  
  const checker = createKGConsistencyChecker();
  const description = await checker.getGraphDescription(docId, type, prisma);
  
  if (!description) {
    return res.status(404).json({ error: 'Description not found' });
  }
  
  res.json(description);
});
```

## Performance Considerations

- The consistency check adds approximately 5-10 seconds to the build time
- It requires an LLM client to be available
- The check is optional and can be disabled for faster builds
- Consider running consistency checks asynchronously for large graphs

## Error Handling

The consistency checker is designed to fail gracefully:

- If the indexed text is not available, it skips the check
- If the LLM client is not provided, it skips the check
- If the LLM call fails, it returns a default consistent result
- Errors are logged but don't fail the entire build process

## Testing

Run the unit tests:

```bash
npm test kg/preprocessing/__tests__/kg_consistency_checker.test.js
```

## Requirements Validated

This implementation validates the following requirements:

- **Requirement 7.1**: Generate natural language description of the knowledge graph
- **Requirement 7.3**: Include main entities, key relations, and graph structure summary
- **Requirement 7.5**: Persist graph description and associate with knowledge graph
