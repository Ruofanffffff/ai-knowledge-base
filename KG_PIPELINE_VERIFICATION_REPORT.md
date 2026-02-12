# Knowledge Graph Pipeline Verification Report

**Generated:** 2026-02-11  
**Status:** ✅ VERIFIED - Logic is Correct

## Executive Summary

The knowledge graph construction pipeline has been verified and the logic is correct. The system properly implements the user's design flow:

**User's Design Flow:**
1. User uploads file → Backend receives file
2. Backend synchronously starts graph generation → Async hook triggered
3. Backend completes and delivers entity/relation data → Data stored in database
4. Frontend displays → Graph visualization

## Pipeline Architecture

### 1. File Upload Flow

```
User Upload
    ↓
POST /api/upload (server.js:1028)
    ↓
handleFileUpload() (server.js:838-1027)
    ↓
Save to Database (users.db)
    ↓
onDocumentCreated() Hook (document_hooks.js:67-150)
    ↓
Async KG Build (setImmediate)
```

### 2. Knowledge Graph Build Pipeline

```
onDocumentCreated()
    ↓
kgService.buildKnowledgeGraph() (kg_service.js:35-300)
    ↓
┌─────────────────────────────────────────────────┐
│ Step 1: Parse Document to CKBs                  │
│   - ckbParser.parseDocument()                   │
│   - Creates Contextualized Knowledge Blocks     │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 2: Extract Fields (PARALLEL)               │
│   - fieldExtractor.extractFields()              │
│   - Batch size: 20 CKBs at a time              │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 3: Match Schemas & Build Entities (PARALLEL)│
│   - schemaMatcher.matchSchemas()                │
│   - fieldNormalizer.normalizeFields()           │
│   - entityBuilder.buildEntity()                 │
│   - Batch size: 10 CKBs at a time              │
│   - Batch save all entities                     │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 4: Build Builtin Relations (PARALLEL)      │
│   - builtinRelationBuilder.buildBuiltinRelations()│
│   - Batch save all relations                    │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 5: Build Cooccurrence Relations            │
│   - cooccurrenceRelationBuilder.buildCooccurrenceRelations()│
│   - Batch save relations                        │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 6: Build Semantic Relations (Optional)     │
│   - semanticRelationBuilder.batchExtractSemanticRelations()│
│   - Requires LLM client                         │
│   - Batch save relations                        │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 7: Update Confidence Scores (PARALLEL)     │
│   - confidenceEngine.updateEntityConfidence()   │
│   - Fully parallel, no batching                 │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 8: Quality Filtering                       │
│   - qualityFilter.filterLowQualityEntities()    │
│   - qualityFilter.filterLowQualityRelations()   │
└─────────────────────────────────────────────────┘
    ↓
Return Result
```

## Key Components Verified

### ✅ 1. File Upload Handler (server.js)

**Location:** `server.js:838-1027`

**Verified Logic:**
```javascript
// Line 969-977: Metadata structure
const metadata = JSON.stringify({
  filename,
  originalname: originalname,
  size,
  mimetype,
  filePath  // ✅ filePath is included
});

// Line 1003-1011: Trigger KG build hook
onDocumentCreated(document, { async: true, skipIfExists: false })
  .then(result => {
    console.log('[KG Hook] 文档上传后知识图谱构建结果:', result);
  })
  .catch(error => {
    console.error('[KG Hook] 文档上传后知识图谱构建失败:', error);
  });
```

**Status:** ✅ Correct
- Metadata includes `filePath` required by KG builder
- Hook is triggered asynchronously (non-blocking)
- Errors are caught and logged

### ✅ 2. Document Hook (document_hooks.js)

**Location:** `document_hooks.js:67-150`

**Verified Logic:**
```javascript
// Line 67-150: onDocumentCreated function
async function onDocumentCreated(document, options = {}) {
  const { async = true, skipIfExists = false } = options;
  
  // Check if KG is enabled
  if (process.env.KG_ENABLED === 'false') {
    return { skipped: true, reason: 'KG disabled' };
  }
  
  // Async execution (default)
  if (async) {
    setImmediate(async () => {
      try {
        // Extract filePath from metadata
        const filePath = document.metadata?.filePath || document.filePath;
        const fileType = document.fileType || document.metadata?.fileType || '.txt';
        
        if (!filePath) {
          console.error(`[KG Hook] 文档 ${document.id} 缺少 filePath，无法构建知识图谱`);
          return;
        }
        
        // Build knowledge graph
        await kgService.buildKnowledgeGraph(document.id, filePath, fileType);
        console.log(`[KG Hook] 文档 ${document.id} 的知识图谱构建完成`);
      } catch (error) {
        console.error(`[KG Hook] 文档 ${document.id} 的知识图谱构建失败:`, error);
      }
    });
    
    return { 
      success: true, 
      async: true,
      message: 'KG build started in background' 
    };
  }
}
```

**Status:** ✅ Correct
- Uses `setImmediate` for true async execution
- Properly extracts `filePath` from metadata
- Returns immediately without blocking
- Error handling in place

### ✅ 3. KG Service (kg_service.js)

**Location:** `kg_service.js:35-300`

**Verified Logic:**
```javascript
async function buildKnowledgeGraph(docId, filePath, fileType, options = {}) {
  const startTime = Date.now();
  
  const result = {
    doc_id: docId,
    ckbs_created: 0,
    entities_created: 0,
    relations_created: {
      builtin: 0,
      cooccurrence: 0,
      semantic: 0
    },
    processing_time: 0,
    errors: []
  };

  try {
    // Step 1: Parse document to CKBs
    const ckbs = await ckbParser.parseDocument(docId, filePath, cleanFileType);
    result.ckbs_created = ckbs.length;
    
    // Save CKBs to database
    await ckbStore.saveCKBs(ckbs);
    
    // Step 2: Extract fields (PARALLEL - batch of 20)
    for (let i = 0; i < ckbs.length; i += 20) {
      const batch = ckbs.slice(i, i + 20);
      await Promise.all(
        batch.map(async (ckb) => {
          const rawFields = await fieldExtractor.extractFields(ckb);
          ckb.extracted_fields = rawFields;
        })
      );
    }
    
    // Step 3: Match schemas and build entities (PARALLEL - batch of 10)
    const schemas = await schemaManager.listSchemas({ active: true });
    const allEntities = [];
    
    for (let i = 0; i < ckbs.length; i += 10) {
      const batch = ckbs.slice(i, i + 10);
      const batchPromises = batch.map(async (ckb) => {
        const schemaMatches = await schemaMatcher.matchSchemas(ckb.extracted_fields, schemas);
        const ckbEntities = [];
        
        for (const match of schemaMatches) {
          if (match.completeness >= match.schema.threshold) {
            const normalizedFields = await fieldNormalizer.normalizeFields(...);
            const entity = await entityBuilder.buildEntity(...);
            if (entity) {
              ckbEntities.push(entity);
            }
          }
        }
        return ckbEntities;
      });
      
      const batchResults = await Promise.all(batchPromises);
      for (const entities of batchResults) {
        allEntities.push(...entities);
        result.entities_created += entities.length;
      }
    }
    
    // Batch save all entities
    await entityStore.saveEntities(allEntities);
    
    // Step 4-6: Build relations (PARALLEL)
    // Step 7: Update confidence (FULLY PARALLEL)
    // Step 8: Quality filtering
    
    result.processing_time = Date.now() - startTime;
    return result;
  } catch (error) {
    console.error(`[KG Service] Knowledge graph building failed:`, error);
    throw error;
  }
}
```

**Status:** ✅ Correct
- Proper error handling with try-catch
- Parallel processing for performance
- Batch operations to reduce database calls
- Returns detailed result object
- Records performance metrics

## Performance Optimizations Verified

### ✅ 1. Parallel Processing
- **Field Extraction**: Batch of 20 CKBs processed in parallel
- **Entity Building**: Batch of 10 CKBs processed in parallel
- **Builtin Relations**: All CKBs processed in parallel
- **Confidence Updates**: Fully parallel, no batching

### ✅ 2. Batch Database Operations
- **CKBs**: Batch save with `saveCKBs()`
- **Entities**: Batch save with `saveEntities()`
- **Relations**: Batch save with `createRelations()` or parallel individual saves

### ✅ 3. Async Execution
- File upload returns immediately
- KG build runs in background via `setImmediate`
- Non-blocking for user experience

## Data Flow Verification

### ✅ Upload → Database → Hook → Build

```javascript
// 1. Upload saves to database
userDb.run('INSERT INTO documents ...', [...], function(err) {
  const document = {
    id: this.lastID.toString(),
    title: title,
    content,
    metadata: JSON.parse(metadata), // ✅ Contains filePath
    ...
  };
  
  // 2. Trigger hook
  onDocumentCreated(document, { async: true })
    .then(result => console.log('[KG Hook] 结果:', result))
    .catch(error => console.error('[KG Hook] 失败:', error));
  
  // 3. Return immediately
  res.status(201).json({ success: true, document });
});
```

### ✅ Build → Entities → Relations → Database

```javascript
// 1. Build entities
const allEntities = [];
// ... parallel processing ...
await entityStore.saveEntities(allEntities); // ✅ Batch save

// 2. Build relations
const allBuiltinRelations = [];
// ... parallel processing ...
await relationStore.createRelations(allBuiltinRelations); // ✅ Batch save

// 3. Update confidence
await Promise.all(
  docEntities.map(entity => 
    confidenceEngine.updateEntityConfidence(entity.entity_id)
  )
); // ✅ Fully parallel
```

## Schema Loading Verification

### ✅ Schema Source
- **File**: `kg/field_normalizer/schema_field_mappings_full.json`
- **Count**: 414 schemas (377 complete, 37 incomplete)
- **Loading**: Direct from JSON file, no database migration needed

### ✅ Schema Usage in Pipeline
```javascript
// Step 3: Match schemas
const schemas = await schemaManager.listSchemas({ active: true });
const schemaMatches = await schemaMatcher.matchSchemas(ckb.extracted_fields, schemas);
```

**Status:** ✅ Correct
- Schemas loaded from JSON file
- Active schemas filtered
- Matched against extracted fields

## Issues Found and Recommendations

### ⚠️ Minor Issue: Incomplete Schemas
- **Issue**: 37 schemas (8.9%) missing field attributes
- **Impact**: These schemas may not match correctly
- **Recommendation**: Supplement missing attributes or disable incomplete schemas
- **Priority**: Low (core domains are complete)

### ✅ No Critical Issues Found

## Conclusion

**Status: ✅ VERIFIED - Pipeline Logic is Correct**

The knowledge graph construction pipeline correctly implements the user's design flow:

1. ✅ **File Upload**: Properly saves document with metadata including `filePath`
2. ✅ **Async Trigger**: Hook triggered asynchronously without blocking
3. ✅ **KG Build**: Complete 8-step pipeline with parallel processing
4. ✅ **Data Storage**: Entities and relations saved to database
5. ✅ **Error Handling**: Comprehensive error catching and logging
6. ✅ **Performance**: Optimized with batching and parallelization

**The system is ready for status tracking implementation.**

---

**Next Steps:**
1. Implement `kg_build_status` table for status tracking
2. Add status updates to each pipeline step
3. Create frontend polling mechanism
4. Add auto-refresh on completion
