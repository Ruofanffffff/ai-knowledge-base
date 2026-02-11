# Troubleshooting Guide: Anchor-Driven Entity Synthesis

## Document Information

**Version**: 1.0  
**Created**: 2026-02-08  
**Audience**: Developers, DevOps, Support Engineers  
**Status**: Production Ready

---

## Table of Contents

1. [Quick Diagnosis](#quick-diagnosis)
2. [Common Issues](#common-issues)
3. [Performance Issues](#performance-issues)
4. [Data Issues](#data-issues)
5. [Configuration Issues](#configuration-issues)
6. [Integration Issues](#integration-issues)
7. [Diagnostic Tools](#diagnostic-tools)
8. [Error Messages](#error-messages)
9. [Recovery Procedures](#recovery-procedures)
10. [Getting Help](#getting-help)

---

## Quick Diagnosis

### Symptom Checker

Use this quick reference to find your issue:

| Symptom | Likely Cause | Section |
|---------|--------------|---------|
| Entities not merging | Anchor config issue | [Issue #1](#issue-1-entities-not-merging) |
| Duplicate entities | Normalization problem | [Issue #2](#issue-2-duplicate-entities-created) |
| Slow processing | Performance config | [Performance Issues](#performance-issues) |
| Null anchor fingerprints | Missing anchor fields | [Issue #3](#issue-3-anchor-fingerprint-is-null) |
| Conflicts everywhere | Detection too sensitive | [Issue #4](#issue-4-too-many-conflicts-detected) |
| LLM errors | API key or rate limits | [Issue #5](#issue-5-llm-advisory-failing) |
| Database errors | Lock or schema issue | [Data Issues](#data-issues) |
| Migration failed | Pre-existing state | [Issue #6](#issue-6-migration-script-fails) |

### Quick Health Check

Run this script to check system health:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function healthCheck() {
  console.log('🔍 Running health check...\n');
  
  // 1. Database connection
  try {
    await prisma.$connect();
    console.log('✅ Database connection: OK');
  } catch (error) {
    console.log('❌ Database connection: FAILED');
    console.log('   Error:', error.message);
    return;
  }
  
  // 2. Schema columns
  const result = await prisma.$queryRaw`PRAGMA table_info(kg_entities)`;
  const columns = result.map(r => r.name);
  
  if (columns.includes('anchor_fingerprint')) {
    console.log('✅ anchor_fingerprint column: EXISTS');
  } else {
    console.log('❌ anchor_fingerprint column: MISSING');
  }
  
  if (columns.includes('anchor_fields')) {
    console.log('✅ anchor_fields column: EXISTS');
  } else {
    console.log('❌ anchor_fields column: MISSING');
  }
  
  // 3. Indexes
  const indexes = await prisma.$queryRaw`PRAGMA index_list(kg_entities)`;
  const indexNames = indexes.map(i => i.name);
  
  if (indexNames.includes('kg_entities_anchor_fingerprint_idx')) {
    console.log('✅ Anchor fingerprint index: EXISTS');
  } else {
    console.log('⚠️  Anchor fingerprint index: MISSING');
  }
  
  // 4. Entity statistics
  const totalEntities = await prisma.kGEntity.count();
  const withAnchors = await prisma.kGEntity.count({
    where: { anchor_fingerprint: { not: null } }
  });
  
  console.log(`\n📊 Entity Statistics:`);
  console.log(`   Total entities: ${totalEntities}`);
  console.log(`   With anchors: ${withAnchors} (${(withAnchors/totalEntities*100).toFixed(1)}%)`);
  console.log(`   Without anchors: ${totalEntities - withAnchors}`);
  
  await prisma.$disconnect();
}

healthCheck();
```


---

## Common Issues

### Issue #1: Entities Not Merging

**Symptoms**:
- Multiple entities created for the same semantic entity
- Expected merge not happening
- Entities with similar data remain separate

**Diagnosis**:

```javascript
const AnchorGenerator = require('./kg/entity/anchor_generator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseNoMerge(entityType, sampleFields) {
  // 1. Check schema configuration
  const schema = await prisma.kGSchema.findFirst({
    where: { entity_type: entityType }
  });
  
  if (!schema) {
    console.log('❌ No schema found for entity type:', entityType);
    return;
  }
  
  const config = JSON.parse(schema.schema_definition);
  
  if (!config.anchor_fields || config.anchor_fields.length === 0) {
    console.log('❌ Schema has no anchor_fields configured');
    console.log('   Solution: Add anchor_fields to schema configuration');
    return;
  }
  
  console.log('✅ Anchor fields configured:', config.anchor_fields);
  
  // 2. Check if fields have values
  const missingFields = config.anchor_fields.filter(f => !sampleFields[f]);
  if (missingFields.length > 0) {
    console.log('❌ Missing anchor field values:', missingFields);
    console.log('   Solution: Ensure all anchor fields have values');
    return;
  }
  
  console.log('✅ All anchor fields have values');
  
  // 3. Generate anchor and check normalization
  const instance = {
    entity_type: entityType,
    fields: sampleFields
  };
  
  const result = AnchorGenerator.generate(instance, config);
  console.log('Generated anchor:', result.fingerprint);
  console.log('Normalized values:', result.normalizedValues);
  
  // 4. Check if entities exist with this anchor
  const entities = await prisma.kGEntity.findMany({
    where: { anchor_fingerprint: result.fingerprint }
  });
  
  console.log(`Found ${entities.length} entities with this anchor`);
}

// Example usage
diagnoseNoMerge('PhotographyEntity', {
  Camera: 'A7M4',
  Lens: '35mm F1.8'
});
```

**Common Causes**:

1. **No anchor fields configured**
   - Solution: Add `anchor_fields` to schema definition
   - See: `ANCHOR_FIELDS_GUIDE.md`

2. **Anchor fields missing values**
   - Solution: Ensure extraction populates anchor fields
   - Check field extractor configuration

3. **Normalization differences**
   - Solution: Check normalization strategy
   - Example: "A7M4" vs "a7m4" should normalize to same value

4. **Wrong compatibility mode**
   - Solution: Use `ANCHOR_ONLY` or `HYBRID` mode
   - Check: `compatibilityMode` in config

**Solutions**:

```javascript
// Solution 1: Configure anchor fields
const schemaConfig = {
  name: "Photography Setup A",
  entity_type: "PhotographyEntity",
  anchor_fields: ["Camera", "Lens"], // Add this
  fields: [
    { name: "Camera", type: "string" },
    { name: "Lens", type: "string" }
  ]
};

// Solution 2: Ensure fields have values
// Check field extraction is working
const extracted = await fieldExtractor.extract(document);
console.log('Extracted fields:', extracted);

// Solution 3: Check normalization
const normalizer = require('./kg/entity/field_normalizers');
const normalized = normalizer.normalize('Camera', 'A7M4', 'lowercase');
console.log('Normalized:', normalized); // Should be 'a7m4'
```


### Issue #2: Duplicate Entities Created

**Symptoms**:
- Same entity appears multiple times in database
- Anchor fingerprints are different for same semantic entity
- Merging not working as expected

**Diagnosis**:

```javascript
async function diagnoseDuplicates(entityName) {
  const entities = await prisma.kGEntity.findMany({
    where: { name: { contains: entityName } }
  });
  
  console.log(`Found ${entities.length} entities matching "${entityName}"`);
  
  for (const entity of entities) {
    console.log('\nEntity:', entity.id);
    console.log('  Anchor:', entity.anchor_fingerprint);
    console.log('  Anchor fields:', entity.anchor_fields);
    console.log('  Properties:', entity.properties);
  }
  
  // Check if anchors are different
  const anchors = entities.map(e => e.anchor_fingerprint);
  const uniqueAnchors = [...new Set(anchors)];
  
  if (uniqueAnchors.length > 1) {
    console.log('\n❌ Different anchors detected:');
    uniqueAnchors.forEach(a => console.log('  -', a));
    console.log('\nThis indicates normalization or configuration issue');
  }
}
```

**Common Causes**:

1. **Inconsistent normalization**
   - Example: "A7M4" vs "a7m4" vs "A7 M4"
   - Solution: Use consistent normalization strategy

2. **Anchor fields changed**
   - Changing anchor_fields creates new fingerprints
   - Solution: Plan anchor fields carefully, avoid changes

3. **Missing normalization**
   - Fields not normalized before anchor generation
   - Solution: Ensure normalization is applied

4. **Timestamp in anchor**
   - Using non-normalized timestamps
   - Solution: Use appropriate time normalization (time_month, time_year)

**Solutions**:

```javascript
// Solution 1: Fix normalization
const config = {
  anchor_fields: ["Camera", "Lens"],
  anchor_config: {
    normalization: {
      Camera: "lowercase",  // Normalize to lowercase
      Lens: "lowercase"
    }
  }
};

// Solution 2: Merge existing duplicates
const AnchorMerger = require('./kg/entity/anchor_merger');

async function mergeDuplicates(entityIds) {
  // Get entities
  const entities = await prisma.kGEntity.findMany({
    where: { id: { in: entityIds } }
  });
  
  // Convert to schema instances
  const instances = entities.map(e => ({
    entity_type: e.type,
    fields: JSON.parse(e.properties),
    ckb_ids: [e.ckb_id]
  }));
  
  // Regenerate anchors with correct config
  const anchorResults = await AnchorGenerator.generateBatch(instances);
  
  // Merge
  const merged = await AnchorMerger.mergeBatch(anchorResults);
  
  console.log(`Merged ${entities.length} entities into ${merged.length}`);
}

// Solution 3: Prevent future duplicates
// Use time normalization for timestamps
const config = {
  anchor_fields: ["Location", "Indicator", "Timestamp"],
  anchor_config: {
    normalization: {
      Location: "lowercase",
      Indicator: "lowercase",
      Timestamp: "time_month"  // Normalize to month level
    }
  }
};
```

### Issue #3: Anchor Fingerprint is Null

**Symptoms**:
- Entities created without `anchor_fingerprint`
- `anchor_fields` is also null
- Merging not working

**Diagnosis**:

```javascript
async function diagnoseNullAnchors() {
  const withoutAnchors = await prisma.kGEntity.findMany({
    where: { anchor_fingerprint: null }
  });
  
  console.log(`Found ${withoutAnchors.length} entities without anchors`);
  
  // Group by type
  const byType = {};
  for (const entity of withoutAnchors) {
    byType[entity.type] = (byType[entity.type] || 0) + 1;
  }
  
  console.log('\nBy entity type:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
    
    // Check if schema has anchor fields
    const schema = await prisma.kGSchema.findFirst({
      where: { entity_type: type }
    });
    
    if (schema) {
      const config = JSON.parse(schema.schema_definition);
      if (!config.anchor_fields || config.anchor_fields.length === 0) {
        console.log(`    ❌ No anchor_fields configured`);
      }
    }
  }
}
```

**Common Causes**:

1. **Schema has no anchor_fields**
   - Most common cause
   - Solution: Configure anchor_fields in schema

2. **Legacy mode enabled**
   - `compatibilityMode: 'LEGACY'`
   - Solution: Switch to `HYBRID` or `ANCHOR_ONLY`

3. **Anchor fields have no values**
   - Fields exist but are empty/null
   - Solution: Improve field extraction

4. **Old entities (pre-migration)**
   - Entities created before anchor system
   - Solution: Run migration script

**Solutions**:

```javascript
// Solution 1: Configure anchor fields
// See ANCHOR_FIELDS_GUIDE.md for detailed instructions

// Solution 2: Switch compatibility mode
const config = {
  compatibilityMode: 'ANCHOR_ONLY'  // or 'HYBRID'
};

// Solution 3: Migrate old entities
const { migrateExistingEntities } = require('./prisma/migrations/add_anchor_fields');

await migrateExistingEntities({
  batchSize: 100,
  dryRun: false
});

// Solution 4: Regenerate anchors for specific entities
async function regenerateAnchors(entityIds) {
  for (const id of entityIds) {
    const entity = await prisma.kGEntity.findUnique({ where: { id } });
    
    // Get schema config
    const schema = await prisma.kGSchema.findFirst({
      where: { entity_type: entity.type }
    });
    
    const config = JSON.parse(schema.schema_definition);
    
    // Generate anchor
    const instance = {
      entity_type: entity.type,
      fields: JSON.parse(entity.properties)
    };
    
    const result = AnchorGenerator.generate(instance, config);
    
    // Update entity
    await prisma.kGEntity.update({
      where: { id },
      data: {
        anchor_fingerprint: result.fingerprint,
        anchor_fields: JSON.stringify(result.anchorFields)
      }
    });
  }
}
```


### Issue #4: Too Many Conflicts Detected

**Symptoms**:
- Conflict detection triggering frequently
- Most conflicts are false positives
- System performance degraded

**Diagnosis**:

```javascript
const AnchorConflictDetector = require('./kg/entity/anchor_conflict_detector');

async function analyzeConflicts() {
  // Get entities with same anchor
  const entities = await prisma.kGEntity.findMany({
    where: { anchor_fingerprint: 'some_anchor' }
  });
  
  // Convert to instances
  const instances = entities.map(e => ({
    entity_type: e.type,
    fields: JSON.parse(e.properties),
    ckb_ids: [e.ckb_id]
  }));
  
  // Detect conflicts
  const conflict = AnchorConflictDetector.detect(instances);
  
  console.log('Has conflict:', conflict.hasConflict);
  console.log('Conflict type:', conflict.type);
  console.log('Severity:', conflict.severity);
  console.log('Details:', conflict.details);
}
```

**Common Causes**:

1. **Detection too sensitive**
   - Default threshold too low
   - Solution: Adjust severity threshold

2. **Normal variation treated as conflict**
   - Example: Slightly different timestamps
   - Solution: Use time normalization

3. **Incomplete data treated as conflict**
   - Missing fields vs present fields
   - Solution: Adjust conflict detection logic

**Solutions**:

```javascript
// Solution 1: Adjust severity threshold
const config = {
  conflictDetection: {
    enabled: true,
    severity: 'high'  // Only detect high severity conflicts
  }
};

// Solution 2: Disable for specific entity types
function shouldDetectConflicts(entityType) {
  const noConflictTypes = ['PhotographyEntity', 'TravelEntity'];
  return !noConflictTypes.includes(entityType);
}

// Solution 3: Custom conflict detection
const AnchorConflictDetector = require('./kg/entity/anchor_conflict_detector');

// Override detection for specific cases
const originalDetect = AnchorConflictDetector.detect;
AnchorConflictDetector.detect = function(instances) {
  const result = originalDetect.call(this, instances);
  
  // Ignore minor timestamp differences
  if (result.type === 'time_inconsistency' && result.severity === 'low') {
    result.hasConflict = false;
  }
  
  return result;
};

// Solution 4: Disable conflict detection temporarily
const config = {
  conflictDetection: {
    enabled: false
  }
};
```

### Issue #5: LLM Advisory Failing

**Symptoms**:
- LLM advisory calls throwing errors
- Timeouts or rate limit errors
- Incorrect or empty responses

**Diagnosis**:

```javascript
const LLMConflictAdvisor = require('./kg/entity/llm_conflict_advisor');

async function testLLMAdvisory() {
  try {
    // Test with simple conflict
    const conflict = {
      type: 'value_conflict',
      severity: 'medium',
      details: {
        field: 'ISO',
        values: ['100', '200']
      },
      instances: [
        { fields: { ISO: '100' } },
        { fields: { ISO: '200' } }
      ]
    };
    
    const advisory = await LLMConflictAdvisor.advise(conflict);
    console.log('✅ LLM advisory working');
    console.log('Recommendation:', advisory.recommendation);
  } catch (error) {
    console.log('❌ LLM advisory failed');
    console.log('Error:', error.message);
    
    // Check API key
    if (error.message.includes('API key')) {
      console.log('⚠️  Check DASHSCOPE_API_KEY environment variable');
    }
    
    // Check rate limits
    if (error.message.includes('rate limit')) {
      console.log('⚠️  Rate limit exceeded, reduce request frequency');
    }
  }
}
```

**Common Causes**:

1. **Missing API key**
   - `DASHSCOPE_API_KEY` not set
   - Solution: Set environment variable

2. **Rate limits exceeded**
   - Too many requests
   - Solution: Add delays or disable LLM advisory

3. **Network issues**
   - Timeout or connection errors
   - Solution: Check network, increase timeout

4. **Invalid response format**
   - LLM returns unexpected format
   - Solution: Update response parsing

**Solutions**:

```javascript
// Solution 1: Check and set API key
console.log('API key set:', !!process.env.DASHSCOPE_API_KEY);

// If not set:
// export DASHSCOPE_API_KEY=your_key_here

// Solution 2: Disable LLM advisory
const config = {
  llmAdvisory: {
    enabled: false
  }
};

// Solution 3: Add retry logic
const LLMConflictAdvisor = require('./kg/entity/llm_conflict_advisor');

async function adviseWithRetry(conflict, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await LLMConflictAdvisor.advise(conflict);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}

// Solution 4: Increase timeout
const config = {
  llmAdvisory: {
    enabled: true,
    timeout: 30000  // 30 seconds
  }
};

// Solution 5: Use fallback
async function adviseWithFallback(conflict) {
  try {
    return await LLMConflictAdvisor.advise(conflict);
  } catch (error) {
    console.warn('LLM advisory failed, using fallback');
    
    // Simple fallback logic
    return {
      recommendation: 'merge',
      reasoning: 'Fallback: merge by default',
      confidence: 0.5
    };
  }
}
```


### Issue #6: Migration Script Fails

**Symptoms**:
- Migration script throws errors
- Database in inconsistent state
- Cannot complete migration

**Diagnosis**:

```bash
# Check migration status
node .kiro/specs/anchor-driven-entity-synthesis/migrations/verify-migration.js

# Check database schema
sqlite3 prisma/knowledge-base.db "PRAGMA table_info(kg_entities)"

# Check for locks
lsof prisma/knowledge-base.db
```

**Common Causes**:

1. **Migration already applied**
   - Columns already exist
   - Solution: Skip migration or rollback first

2. **Database locked**
   - Another process using database
   - Solution: Stop all services

3. **Insufficient permissions**
   - Cannot write to database
   - Solution: Check file permissions

4. **Disk space full**
   - No space for backup or migration
   - Solution: Free up disk space

**Solutions**:

```bash
# Solution 1: Check if already migrated
node .kiro/specs/anchor-driven-entity-synthesis/migrations/verify-migration.js

# If already migrated, skip
# If partially migrated, rollback first:
node .kiro/specs/anchor-driven-entity-synthesis/migrations/rollback-migration.js

# Solution 2: Stop all services
pm2 stop all
# Or
pkill -f "node.*kg"

# Then retry migration
node .kiro/specs/anchor-driven-entity-synthesis/migrations/deploy-migration.js

# Solution 3: Check permissions
ls -la prisma/knowledge-base.db
chmod 644 prisma/knowledge-base.db

# Solution 4: Check disk space
df -h
# Free up space if needed

# Solution 5: Manual migration (if script fails)
sqlite3 prisma/knowledge-base.db << EOF
ALTER TABLE kg_entities ADD COLUMN anchor_fingerprint TEXT;
ALTER TABLE kg_entities ADD COLUMN anchor_fields TEXT;
CREATE INDEX kg_entities_anchor_fingerprint_idx ON kg_entities(anchor_fingerprint);
CREATE INDEX kg_entities_type_anchor_fingerprint_idx ON kg_entities(type, anchor_fingerprint);
EOF
```

### Issue #7: Performance Degradation

**Symptoms**:
- Slow document processing
- High CPU or memory usage
- Timeouts

**See**: [Performance Issues](#performance-issues) section below

### Issue #8: Incorrect Entity Merging

**Symptoms**:
- Entities that should be separate are merged
- Wrong entities combined
- Data corruption

**Diagnosis**:

```javascript
async function diagnoseIncorrectMerge(anchorFingerprint) {
  // Get all entities with this anchor
  const entities = await prisma.kGEntity.findMany({
    where: { anchor_fingerprint: anchorFingerprint }
  });
  
  console.log(`Found ${entities.length} entities with anchor: ${anchorFingerprint}`);
  
  for (const entity of entities) {
    console.log('\nEntity:', entity.id);
    console.log('  Name:', entity.name);
    console.log('  Anchor fields:', entity.anchor_fields);
    console.log('  Properties:', entity.properties);
    console.log('  CKB IDs:', entity.ckb_ids);
  }
  
  // Check if they should actually be separate
  console.log('\n⚠️  Review the data above. Should these be separate entities?');
  console.log('If yes, the anchor configuration is too broad.');
  console.log('Solution: Add more distinguishing fields to anchor_fields');
}
```

**Common Causes**:

1. **Anchor fields too broad**
   - Not enough fields to distinguish entities
   - Solution: Add more anchor fields

2. **Over-normalization**
   - Too much normalization loses distinctions
   - Solution: Reduce normalization

3. **Missing key fields**
   - Important distinguishing field not in anchor
   - Solution: Add field to anchor_fields

**Solutions**:

```javascript
// Solution 1: Add more anchor fields
// Before (too broad):
const config = {
  anchor_fields: ["Camera"]  // Only camera
};

// After (more specific):
const config = {
  anchor_fields: ["Camera", "Lens", "Timestamp"]  // Camera + Lens + Time
};

// Solution 2: Reduce normalization
// Before (over-normalized):
const config = {
  anchor_config: {
    normalization: {
      Timestamp: "time_year"  // Too broad, loses month/day
    }
  }
};

// After (more specific):
const config = {
  anchor_config: {
    normalization: {
      Timestamp: "time_day"  // Preserves day-level distinction
    }
  }
};

// Solution 3: Split incorrectly merged entities
async function splitMergedEntities(anchorFingerprint) {
  const entities = await prisma.kGEntity.findMany({
    where: { anchor_fingerprint: anchorFingerprint }
  });
  
  if (entities.length !== 1) {
    console.log('Expected 1 merged entity, found:', entities.length);
    return;
  }
  
  const merged = entities[0];
  const ckbIds = JSON.parse(merged.ckb_ids);
  
  // Delete merged entity
  await prisma.kGEntity.delete({ where: { id: merged.id } });
  
  // Recreate separate entities
  // (Re-process original documents with updated anchor config)
  for (const ckbId of ckbIds) {
    const ckb = await prisma.cKB.findUnique({ where: { id: ckbId } });
    await pipeline.processDocument({
      content: ckb.content,
      ckb_id: ckbId,
      compatibilityMode: 'ANCHOR_ONLY'
    });
  }
}
```


---

## Performance Issues

### Issue: Slow Anchor Generation

**Symptoms**:
- Anchor generation taking >10ms per instance
- High CPU usage during generation
- Batch processing slow

**Diagnosis**:

```javascript
const { performance } = require('perf_hooks');
const AnchorGenerator = require('./kg/entity/anchor_generator');

async function benchmarkAnchorGeneration(instances) {
  const start = performance.now();
  
  for (const instance of instances) {
    await AnchorGenerator.generate(instance, schemaConfig);
  }
  
  const duration = performance.now() - start;
  const perInstance = duration / instances.length;
  
  console.log(`Total: ${duration.toFixed(2)}ms`);
  console.log(`Per instance: ${perInstance.toFixed(2)}ms`);
  
  if (perInstance > 10) {
    console.log('⚠️  Performance below target (<10ms)');
  }
}
```

**Solutions**:

```javascript
// Solution 1: Enable caching
const config = {
  performance: {
    cacheEnabled: true
  }
};

// Solution 2: Use batch processing
const anchorResults = await AnchorGenerator.generateBatch(instances);

// Solution 3: Optimize normalization
// Avoid expensive operations in normalization
const config = {
  anchor_config: {
    normalization: {
      // Use simple normalization
      Camera: "lowercase",  // Fast
      // Avoid: complex regex, API calls, etc.
    }
  }
};

// Solution 4: Reduce anchor fields
// Fewer fields = faster generation
const config = {
  anchor_fields: ["Camera", "Lens"]  // Only essential fields
};
```

### Issue: Slow Entity Merging

**Symptoms**:
- Merge processing taking >100ms for 1000 instances
- Memory usage growing
- Database queries slow

**Diagnosis**:

```javascript
async function benchmarkMerging(instances) {
  const start = performance.now();
  
  const anchorResults = await AnchorGenerator.generateBatch(instances);
  const entities = await AnchorMerger.mergeBatch(anchorResults);
  
  const duration = performance.now() - start;
  
  console.log(`Merged ${instances.length} instances in ${duration.toFixed(2)}ms`);
  console.log(`Per instance: ${(duration / instances.length).toFixed(2)}ms`);
  
  if (duration > 100 && instances.length === 1000) {
    console.log('⚠️  Performance below target (<100ms for 1000 instances)');
  }
}
```

**Solutions**:

```javascript
// Solution 1: Use batch operations
const AnchorMerger = require('./kg/entity/anchor_merger');

// Instead of merging one by one:
for (const result of anchorResults) {
  await AnchorMerger.merge([result]);  // Slow
}

// Use batch merge:
await AnchorMerger.mergeBatch(anchorResults);  // Fast

// Solution 2: Optimize database queries
// Ensure indexes exist
await prisma.$executeRaw`
  CREATE INDEX IF NOT EXISTS kg_entities_anchor_fingerprint_idx 
  ON kg_entities(anchor_fingerprint)
`;

// Solution 3: Increase batch size
const config = {
  performance: {
    batchSize: 200  // Process more at once
  }
};

// Solution 4: Use transactions
await prisma.$transaction(async (tx) => {
  for (const entity of entities) {
    await tx.kGEntity.upsert({
      where: { anchor_fingerprint: entity.anchor_fingerprint },
      update: entity,
      create: entity
    });
  }
});
```

### Issue: High Memory Usage

**Symptoms**:
- Memory usage growing over time
- Out of memory errors
- Slow garbage collection

**Diagnosis**:

```javascript
function checkMemoryUsage() {
  const used = process.memoryUsage();
  
  console.log('Memory Usage:');
  console.log(`  RSS: ${(used.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Used: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  External: ${(used.external / 1024 / 1024).toFixed(2)} MB`);
  
  if (used.heapUsed / used.heapTotal > 0.9) {
    console.log('⚠️  Heap usage >90%, potential memory leak');
  }
}

// Monitor during processing
setInterval(checkMemoryUsage, 5000);
```

**Solutions**:

```javascript
// Solution 1: Process in smaller batches
async function processLargeDataset(instances) {
  const batchSize = 100;
  
  for (let i = 0; i < instances.length; i += batchSize) {
    const batch = instances.slice(i, i + batchSize);
    await processBatch(batch);
    
    // Force garbage collection (if --expose-gc flag set)
    if (global.gc) {
      global.gc();
    }
  }
}

// Solution 2: Clear caches periodically
const AnchorGenerator = require('./kg/entity/anchor_generator');

// After processing large batch
AnchorGenerator.clearCache();

// Solution 3: Disconnect Prisma client
await prisma.$disconnect();
// Reconnect when needed
await prisma.$connect();

// Solution 4: Stream large datasets
const stream = await prisma.kGEntity.findMany({
  where: { /* ... */ },
  cursor: { id: lastId },
  take: 100
});

// Process in chunks
```

### Issue: Database Query Slow

**Symptoms**:
- Slow entity lookups
- Timeout errors
- High database CPU

**Diagnosis**:

```javascript
// Check query performance
const start = performance.now();

const entities = await prisma.kGEntity.findMany({
  where: { anchor_fingerprint: 'some_anchor' }
});

const duration = performance.now() - start;
console.log(`Query took ${duration.toFixed(2)}ms`);

// Explain query plan
const plan = await prisma.$queryRaw`
  EXPLAIN QUERY PLAN
  SELECT * FROM kg_entities WHERE anchor_fingerprint = 'some_anchor'
`;
console.log('Query plan:', plan);
```

**Solutions**:

```bash
# Solution 1: Ensure indexes exist
sqlite3 prisma/knowledge-base.db << EOF
CREATE INDEX IF NOT EXISTS kg_entities_anchor_fingerprint_idx 
  ON kg_entities(anchor_fingerprint);
CREATE INDEX IF NOT EXISTS kg_entities_type_anchor_fingerprint_idx 
  ON kg_entities(type, anchor_fingerprint);
EOF

# Solution 2: Analyze and optimize database
sqlite3 prisma/knowledge-base.db "ANALYZE"

# Solution 3: Vacuum database (reclaim space)
sqlite3 prisma/knowledge-base.db "VACUUM"

# Solution 4: Check database size
ls -lh prisma/knowledge-base.db
# If too large, consider archiving old data
```


---

## Data Issues

### Issue: Data Corruption

**Symptoms**:
- Invalid anchor fingerprints
- Malformed anchor_fields JSON
- Missing or corrupted entity data

**Diagnosis**:

```javascript
async function checkDataIntegrity() {
  const entities = await prisma.kGEntity.findMany();
  
  let issues = [];
  
  for (const entity of entities) {
    // Check anchor fingerprint format
    if (entity.anchor_fingerprint && !entity.anchor_fingerprint.includes('|')) {
      issues.push({
        id: entity.id,
        issue: 'Invalid anchor fingerprint format',
        value: entity.anchor_fingerprint
      });
    }
    
    // Check anchor_fields JSON
    if (entity.anchor_fields) {
      try {
        JSON.parse(entity.anchor_fields);
      } catch (error) {
        issues.push({
          id: entity.id,
          issue: 'Invalid anchor_fields JSON',
          value: entity.anchor_fields
        });
      }
    }
    
    // Check properties JSON
    try {
      JSON.parse(entity.properties);
    } catch (error) {
      issues.push({
        id: entity.id,
        issue: 'Invalid properties JSON',
        value: entity.properties
      });
    }
  }
  
  console.log(`Found ${issues.length} data integrity issues`);
  return issues;
}
```

**Solutions**:

```javascript
// Solution 1: Fix invalid anchor fingerprints
async function fixInvalidAnchors() {
  const entities = await prisma.kGEntity.findMany({
    where: { anchor_fingerprint: { not: null } }
  });
  
  for (const entity of entities) {
    if (!entity.anchor_fingerprint.includes('|')) {
      // Regenerate anchor
      const schema = await prisma.kGSchema.findFirst({
        where: { entity_type: entity.type }
      });
      
      const config = JSON.parse(schema.schema_definition);
      const instance = {
        entity_type: entity.type,
        fields: JSON.parse(entity.properties)
      };
      
      const result = AnchorGenerator.generate(instance, config);
      
      await prisma.kGEntity.update({
        where: { id: entity.id },
        data: {
          anchor_fingerprint: result.fingerprint,
          anchor_fields: JSON.stringify(result.anchorFields)
        }
      });
    }
  }
}

// Solution 2: Fix malformed JSON
async function fixMalformedJSON() {
  const entities = await prisma.kGEntity.findMany();
  
  for (const entity of entities) {
    let needsUpdate = false;
    let updates = {};
    
    // Try to parse and fix anchor_fields
    if (entity.anchor_fields) {
      try {
        JSON.parse(entity.anchor_fields);
      } catch (error) {
        console.log(`Fixing anchor_fields for entity ${entity.id}`);
        updates.anchor_fields = null;  // Clear invalid data
        needsUpdate = true;
      }
    }
    
    // Try to parse and fix properties
    try {
      JSON.parse(entity.properties);
    } catch (error) {
      console.log(`Fixing properties for entity ${entity.id}`);
      updates.properties = '{}';  // Reset to empty object
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await prisma.kGEntity.update({
        where: { id: entity.id },
        data: updates
      });
    }
  }
}

// Solution 3: Restore from backup
// If data is severely corrupted, restore from backup
cp prisma/knowledge-base.backup.db prisma/knowledge-base.db
```

### Issue: Missing Data

**Symptoms**:
- Entities missing expected fields
- Anchor fields incomplete
- CKB IDs missing

**Diagnosis**:

```javascript
async function checkMissingData() {
  const entities = await prisma.kGEntity.findMany();
  
  for (const entity of entities) {
    const properties = JSON.parse(entity.properties);
    
    // Check if anchor fields are present in properties
    if (entity.anchor_fields) {
      const anchorFields = JSON.parse(entity.anchor_fields);
      
      for (const [field, value] of Object.entries(anchorFields)) {
        if (!properties[field]) {
          console.log(`⚠️  Entity ${entity.id}: anchor field "${field}" not in properties`);
        }
      }
    }
    
    // Check CKB IDs
    if (!entity.ckb_ids || entity.ckb_ids === '[]') {
      console.log(`⚠️  Entity ${entity.id}: no CKB IDs`);
    }
  }
}
```

**Solutions**:

```javascript
// Solution 1: Re-extract fields
// Re-process documents to extract missing fields

// Solution 2: Merge from multiple sources
// If data is split across entities, merge them

// Solution 3: Manual data entry
// For critical missing data, add manually
await prisma.kGEntity.update({
  where: { id: entityId },
  data: {
    properties: JSON.stringify({
      ...existingProperties,
      MissingField: 'value'
    })
  }
});
```

### Issue: Duplicate Anchor Fingerprints

**Symptoms**:
- Multiple entities with same anchor fingerprint
- Should be merged but aren't
- Database constraint violations (if unique constraint added)

**Diagnosis**:

```javascript
async function findDuplicateAnchors() {
  const result = await prisma.$queryRaw`
    SELECT anchor_fingerprint, COUNT(*) as count
    FROM kg_entities
    WHERE anchor_fingerprint IS NOT NULL
    GROUP BY anchor_fingerprint
    HAVING count > 1
    ORDER BY count DESC
  `;
  
  console.log(`Found ${result.length} duplicate anchors`);
  
  for (const row of result) {
    console.log(`\nAnchor: ${row.anchor_fingerprint}`);
    console.log(`Count: ${row.count}`);
    
    const entities = await prisma.kGEntity.findMany({
      where: { anchor_fingerprint: row.anchor_fingerprint }
    });
    
    for (const entity of entities) {
      console.log(`  - Entity ${entity.id}: ${entity.name}`);
    }
  }
}
```

**Solutions**:

```javascript
// Solution 1: Merge duplicates
const AnchorMerger = require('./kg/entity/anchor_merger');

async function mergeDuplicateAnchors() {
  const duplicates = await findDuplicateAnchors();
  
  for (const dup of duplicates) {
    const entities = await prisma.kGEntity.findMany({
      where: { anchor_fingerprint: dup.anchor_fingerprint }
    });
    
    // Keep first entity, merge others into it
    const [primary, ...others] = entities;
    
    for (const other of others) {
      // Merge properties
      const primaryProps = JSON.parse(primary.properties);
      const otherProps = JSON.parse(other.properties);
      const merged = { ...primaryProps, ...otherProps };
      
      // Merge CKB IDs
      const primaryCkbs = JSON.parse(primary.ckb_ids);
      const otherCkbs = JSON.parse(other.ckb_ids);
      const mergedCkbs = [...new Set([...primaryCkbs, ...otherCkbs])];
      
      // Update primary
      await prisma.kGEntity.update({
        where: { id: primary.id },
        data: {
          properties: JSON.stringify(merged),
          ckb_ids: JSON.stringify(mergedCkbs)
        }
      });
      
      // Delete duplicate
      await prisma.kGEntity.delete({
        where: { id: other.id }
      });
    }
  }
}

// Solution 2: If duplicates are actually different entities
// Update anchor configuration to distinguish them
```


---

## Configuration Issues

### Issue: Wrong Compatibility Mode

**Symptoms**:
- System behaving unexpectedly
- Anchors not being used
- Legacy behavior when expecting anchor behavior

**Diagnosis**:

```javascript
// Check current compatibility mode
const config = require('./config/anchor.config');
console.log('Compatibility mode:', config.mode);

// Expected modes:
// - ANCHOR_ONLY: Only use anchor system
// - HYBRID: Use both anchor and legacy
// - LEGACY: Only use legacy system
```

**Solutions**:

```javascript
// Solution 1: Set correct mode in config
// config/anchor.config.js
module.exports = {
  mode: 'ANCHOR_ONLY',  // or 'HYBRID' or 'LEGACY'
  // ...
};

// Solution 2: Override at runtime
const result = await pipeline.processDocument({
  content: text,
  ckb_id: 'doc_001',
  compatibilityMode: 'ANCHOR_ONLY'  // Override config
});

// Solution 3: Environment-specific config
// config/anchor.config.production.js
module.exports = {
  mode: 'ANCHOR_ONLY',  // Production uses anchor only
  // ...
};

// config/anchor.config.development.js
module.exports = {
  mode: 'HYBRID',  // Development uses hybrid for testing
  // ...
};
```

### Issue: Schema Configuration Missing

**Symptoms**:
- Schemas have no anchor_fields
- Anchor generation fails
- Entities not merging

**Diagnosis**:

```javascript
async function checkSchemaConfiguration() {
  const schemas = await prisma.kGSchema.findMany();
  
  let configured = 0;
  let notConfigured = 0;
  
  for (const schema of schemas) {
    const config = JSON.parse(schema.schema_definition);
    
    if (config.anchor_fields && config.anchor_fields.length > 0) {
      configured++;
    } else {
      notConfigured++;
      console.log(`⚠️  Schema ${schema.name} has no anchor_fields`);
    }
  }
  
  console.log(`\nConfigured: ${configured}`);
  console.log(`Not configured: ${notConfigured}`);
  console.log(`Total: ${schemas.length}`);
}
```

**Solutions**:

```javascript
// Solution 1: Configure schemas manually
// See ANCHOR_FIELDS_GUIDE.md for detailed instructions

// Solution 2: Use batch configuration tool
const batchConfigure = require('./kg/schema/batch_configure_anchors');

await batchConfigure.configureAllSchemas({
  dryRun: false,
  autoInfer: true  // Automatically infer anchor fields
});

// Solution 3: Configure specific schema
await prisma.kGSchema.update({
  where: { name: 'Photography Setup A' },
  data: {
    schema_definition: JSON.stringify({
      ...existingConfig,
      anchor_fields: ['Camera', 'Lens', 'Timestamp'],
      anchor_config: {
        normalization: {
          Camera: 'lowercase',
          Lens: 'lowercase',
          Timestamp: 'time_day'
        }
      }
    })
  }
});
```

### Issue: Incorrect Normalization Strategy

**Symptoms**:
- Entities not merging when they should
- Or merging when they shouldn't
- Anchor fingerprints inconsistent

**Diagnosis**:

```javascript
const normalizers = require('./kg/entity/field_normalizers');

// Test normalization
const testCases = [
  { field: 'Camera', value: 'A7M4', strategy: 'lowercase' },
  { field: 'Timestamp', value: '2026-01-20', strategy: 'time_day' },
  { field: 'Location', value: 'Aomori Museum', strategy: 'lowercase' }
];

for (const test of testCases) {
  const normalized = normalizers.normalize(
    test.field,
    test.value,
    test.strategy
  );
  
  console.log(`${test.field}: "${test.value}" → "${normalized}"`);
}
```

**Solutions**:

```javascript
// Solution 1: Adjust normalization strategy
const config = {
  anchor_fields: ['Camera', 'Timestamp'],
  anchor_config: {
    normalization: {
      Camera: 'lowercase',  // Simple lowercase
      Timestamp: 'time_month'  // Month-level (was time_year, too broad)
    }
  }
};

// Solution 2: Add custom normalization
const normalizers = require('./kg/entity/field_normalizers');

normalizers.addStrategy('custom_camera', (value) => {
  // Custom normalization for camera names
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Remove special chars
    .replace(/^sony/, '');  // Remove brand prefix
});

// Use in config
const config = {
  anchor_config: {
    normalization: {
      Camera: 'custom_camera'
    }
  }
};

// Solution 3: Disable normalization for specific field
const config = {
  anchor_config: {
    normalization: {
      Camera: 'none'  // No normalization
    }
  }
};
```


---

## Integration Issues

### Issue: Pipeline Integration Not Working

**Symptoms**:
- Pipeline not using anchor system
- Entities created without anchors
- Integration tests failing

**Diagnosis**:

```javascript
const pipeline = require('./kg/pipeline/universal_document_pipeline');

async function testPipelineIntegration() {
  const result = await pipeline.processDocument({
    content: 'Camera: A7M4, Lens: 35mm F1.8',
    ckb_id: 'test_001',
    compatibilityMode: 'ANCHOR_ONLY'
  });
  
  console.log('Entities created:', result.entities.length);
  
  if (result.entities.length > 0) {
    const entity = result.entities[0];
    console.log('Has anchor:', !!entity.anchor_fingerprint);
    console.log('Anchor:', entity.anchor_fingerprint);
    console.log('Anchor fields:', entity.anchor_fields);
  }
  
  if (result.anchorStats) {
    console.log('Anchor stats:', result.anchorStats);
  } else {
    console.log('⚠️  No anchor stats (integration may not be working)');
  }
}
```

**Solutions**:

```javascript
// Solution 1: Verify pipeline version
// Ensure you're using the updated pipeline with anchor support
const pipeline = require('./kg/pipeline/universal_document_pipeline');
console.log('Pipeline has anchor support:', typeof pipeline.buildEntitiesWithAnchor === 'function');

// Solution 2: Check compatibility mode
// Ensure mode is set correctly
const result = await pipeline.processDocument({
  content: text,
  ckb_id: 'doc_001',
  compatibilityMode: 'ANCHOR_ONLY'  // Explicitly set
});

// Solution 3: Update pipeline imports
// If using old import path, update to new one
// Old:
// const { buildEntities } = require('./kg/entity/entity_builder');

// New:
const { buildEntitiesWithAnchor } = require('./kg/pipeline/universal_document_pipeline');
```

### Issue: API Endpoints Not Working

**Symptoms**:
- API returns errors
- Anchor data not in responses
- Frontend integration broken

**Diagnosis**:

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/kg/process \
  -H "Content-Type: application/json" \
  -d '{"content": "Camera: A7M4", "ckb_id": "test_001"}'

# Check response for anchor data
# Should include: anchor_fingerprint, anchor_fields
```

**Solutions**:

```javascript
// Solution 1: Update API routes
// Ensure routes return anchor data

// routes/knowledgeGraphRoutes.js
router.post('/process', async (req, res) => {
  const result = await pipeline.processDocument({
    content: req.body.content,
    ckb_id: req.body.ckb_id,
    compatibilityMode: 'ANCHOR_ONLY'
  });
  
  // Include anchor data in response
  res.json({
    entities: result.entities.map(e => ({
      ...e,
      anchor_fingerprint: e.anchor_fingerprint,  // Include
      anchor_fields: e.anchor_fields  // Include
    })),
    anchorStats: result.anchorStats  // Include stats
  });
});

// Solution 2: Update API documentation
// Document new fields in API responses

// Solution 3: Add backward compatibility
// Support old API format for legacy clients
router.post('/process', async (req, res) => {
  const result = await pipeline.processDocument({
    content: req.body.content,
    ckb_id: req.body.ckb_id,
    compatibilityMode: req.body.useAnchor ? 'ANCHOR_ONLY' : 'LEGACY'
  });
  
  res.json(result);
});
```

### Issue: Frontend Not Displaying Anchor Data

**Symptoms**:
- Anchor data not shown in UI
- Frontend errors
- Missing fields in entity display

**Solutions**:

```typescript
// Solution 1: Update entity type definitions
// types/entity.ts
interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  anchor_fingerprint?: string;  // Add
  anchor_fields?: Record<string, any>;  // Add
  // ... other fields
}

// Solution 2: Update entity display component
// components/EntityCard.tsx
function EntityCard({ entity }: { entity: Entity }) {
  return (
    <div>
      <h3>{entity.name}</h3>
      <p>Type: {entity.type}</p>
      
      {/* Add anchor display */}
      {entity.anchor_fingerprint && (
        <div className="anchor-info">
          <h4>Anchor</h4>
          <code>{entity.anchor_fingerprint}</code>
          
          {entity.anchor_fields && (
            <div>
              <h5>Anchor Fields</h5>
              <pre>{JSON.stringify(entity.anchor_fields, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
      
      {/* ... rest of component */}
    </div>
  );
}

// Solution 3: Add anchor visualization
// Show which entities share the same anchor
function AnchorVisualization({ anchor }: { anchor: string }) {
  const [entities, setEntities] = useState([]);
  
  useEffect(() => {
    fetch(`/api/entities?anchor=${anchor}`)
      .then(res => res.json())
      .then(data => setEntities(data));
  }, [anchor]);
  
  return (
    <div>
      <h4>Entities with anchor: {anchor}</h4>
      <ul>
        {entities.map(e => (
          <li key={e.id}>{e.name}</li>
        ))}
      </ul>
    </div>
  );
}
```


---

## Diagnostic Tools

### Tool 1: System Health Check

Complete system health check script:

```javascript
// scripts/health-check.js
const { PrismaClient } = require('@prisma/client');
const AnchorGenerator = require('./kg/entity/anchor_generator');
const pipeline = require('./kg/pipeline/universal_document_pipeline');

async function fullHealthCheck() {
  const prisma = new PrismaClient();
  const results = {
    database: false,
    schema: false,
    indexes: false,
    configuration: false,
    performance: false,
    integration: false
  };
  
  console.log('🏥 Running Full Health Check\n');
  
  // 1. Database
  try {
    await prisma.$connect();
    results.database = true;
    console.log('✅ Database connection');
  } catch (error) {
    console.log('❌ Database connection:', error.message);
  }
  
  // 2. Schema
  try {
    const columns = await prisma.$queryRaw`PRAGMA table_info(kg_entities)`;
    const columnNames = columns.map(c => c.name);
    
    if (columnNames.includes('anchor_fingerprint') && 
        columnNames.includes('anchor_fields')) {
      results.schema = true;
      console.log('✅ Database schema');
    } else {
      console.log('❌ Database schema: missing columns');
    }
  } catch (error) {
    console.log('❌ Database schema:', error.message);
  }
  
  // 3. Indexes
  try {
    const indexes = await prisma.$queryRaw`PRAGMA index_list(kg_entities)`;
    const indexNames = indexes.map(i => i.name);
    
    if (indexNames.includes('kg_entities_anchor_fingerprint_idx')) {
      results.indexes = true;
      console.log('✅ Database indexes');
    } else {
      console.log('⚠️  Database indexes: missing anchor index');
    }
  } catch (error) {
    console.log('❌ Database indexes:', error.message);
  }
  
  // 4. Configuration
  try {
    const schemas = await prisma.kGSchema.findMany();
    let configured = 0;
    
    for (const schema of schemas) {
      const config = JSON.parse(schema.schema_definition);
      if (config.anchor_fields && config.anchor_fields.length > 0) {
        configured++;
      }
    }
    
    const percentage = (configured / schemas.length * 100).toFixed(1);
    
    if (percentage > 80) {
      results.configuration = true;
      console.log(`✅ Schema configuration: ${percentage}% configured`);
    } else {
      console.log(`⚠️  Schema configuration: only ${percentage}% configured`);
    }
  } catch (error) {
    console.log('❌ Schema configuration:', error.message);
  }
  
  // 5. Performance
  try {
    const { performance } = require('perf_hooks');
    const start = performance.now();
    
    const testInstance = {
      entity_type: 'TestEntity',
      fields: { test: 'value' }
    };
    
    const testConfig = {
      anchor_fields: ['test'],
      anchor_config: { normalization: { test: 'lowercase' } }
    };
    
    for (let i = 0; i < 100; i++) {
      AnchorGenerator.generate(testInstance, testConfig);
    }
    
    const duration = performance.now() - start;
    const perInstance = duration / 100;
    
    if (perInstance < 10) {
      results.performance = true;
      console.log(`✅ Performance: ${perInstance.toFixed(2)}ms per instance`);
    } else {
      console.log(`⚠️  Performance: ${perInstance.toFixed(2)}ms per instance (target: <10ms)`);
    }
  } catch (error) {
    console.log('❌ Performance:', error.message);
  }
  
  // 6. Integration
  try {
    const result = await pipeline.processDocument({
      content: 'Test: value',
      ckb_id: 'health_check_test',
      compatibilityMode: 'ANCHOR_ONLY'
    });
    
    if (result.entities && result.entities.length > 0 && 
        result.entities[0].anchor_fingerprint) {
      results.integration = true;
      console.log('✅ Pipeline integration');
      
      // Clean up test entity
      await prisma.kGEntity.deleteMany({
        where: { ckb_ids: { contains: 'health_check_test' } }
      });
    } else {
      console.log('⚠️  Pipeline integration: no anchor generated');
    }
  } catch (error) {
    console.log('❌ Pipeline integration:', error.message);
  }
  
  // Summary
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n📊 Health Check Summary: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All checks passed! System is healthy.');
  } else {
    console.log('⚠️  Some checks failed. Review issues above.');
  }
  
  await prisma.$disconnect();
  return results;
}

fullHealthCheck();
```

### Tool 2: Anchor Debugger

Debug anchor generation:

```javascript
// scripts/debug-anchor.js
const AnchorGenerator = require('./kg/entity/anchor_generator');

function debugAnchorGeneration(instance, config) {
  console.log('🔍 Debugging Anchor Generation\n');
  
  console.log('Input Instance:');
  console.log(JSON.stringify(instance, null, 2));
  
  console.log('\nSchema Config:');
  console.log(JSON.stringify(config, null, 2));
  
  // Generate anchor with detailed logging
  const result = AnchorGenerator.generate(instance, config);
  
  console.log('\nAnchor Fields:');
  console.log(JSON.stringify(result.anchorFields, null, 2));
  
  console.log('\nNormalized Values:');
  console.log(JSON.stringify(result.normalizedValues, null, 2));
  
  console.log('\nAnchor Fingerprint:');
  console.log(result.fingerprint);
  
  console.log('\nFingerprint Breakdown:');
  const parts = result.fingerprint.split('|');
  console.log(`  Entity Type: ${parts[0]}`);
  parts.slice(1).forEach((part, i) => {
    const field = config.anchor_fields[i];
    console.log(`  ${field}: ${part}`);
  });
  
  return result;
}

// Example usage
const instance = {
  entity_type: 'PhotographyEntity',
  fields: {
    Camera: 'A7M4',
    Lens: '35mm F1.8',
    ISO: '100'
  }
};

const config = {
  anchor_fields: ['Camera', 'Lens'],
  anchor_config: {
    normalization: {
      Camera: 'lowercase',
      Lens: 'lowercase'
    }
  }
};

debugAnchorGeneration(instance, config);
```

### Tool 3: Entity Analyzer

Analyze entities and their anchors:

```javascript
// scripts/analyze-entities.js
const { PrismaClient } = require('@prisma/client');

async function analyzeEntities() {
  const prisma = new PrismaClient();
  
  console.log('📊 Entity Analysis\n');
  
  // Total entities
  const total = await prisma.kGEntity.count();
  console.log(`Total entities: ${total}`);
  
  // With/without anchors
  const withAnchors = await prisma.kGEntity.count({
    where: { anchor_fingerprint: { not: null } }
  });
  console.log(`With anchors: ${withAnchors} (${(withAnchors/total*100).toFixed(1)}%)`);
  console.log(`Without anchors: ${total - withAnchors}`);
  
  // By entity type
  const byType = await prisma.$queryRaw`
    SELECT type, 
           COUNT(*) as total,
           SUM(CASE WHEN anchor_fingerprint IS NOT NULL THEN 1 ELSE 0 END) as with_anchor
    FROM kg_entities
    GROUP BY type
    ORDER BY total DESC
  `;
  
  console.log('\nBy Entity Type:');
  for (const row of byType) {
    const percentage = (row.with_anchor / row.total * 100).toFixed(1);
    console.log(`  ${row.type}: ${row.total} total, ${row.with_anchor} with anchor (${percentage}%)`);
  }
  
  // Anchor distribution
  const anchorDist = await prisma.$queryRaw`
    SELECT anchor_fingerprint, COUNT(*) as count
    FROM kg_entities
    WHERE anchor_fingerprint IS NOT NULL
    GROUP BY anchor_fingerprint
    HAVING count > 1
    ORDER BY count DESC
    LIMIT 10
  `;
  
  console.log('\nTop 10 Most Common Anchors:');
  for (const row of anchorDist) {
    console.log(`  ${row.anchor_fingerprint}: ${row.count} entities`);
  }
  
  await prisma.$disconnect();
}

analyzeEntities();
```

### Tool 4: Performance Profiler

Profile system performance:

```javascript
// scripts/profile-performance.js
const { performance } = require('perf_hooks');
const AnchorGenerator = require('./kg/entity/anchor_generator');
const AnchorMerger = require('./kg/entity/anchor_merger');

async function profilePerformance() {
  console.log('⚡ Performance Profiling\n');
  
  // Generate test data
  const instances = [];
  for (let i = 0; i < 1000; i++) {
    instances.push({
      entity_type: 'TestEntity',
      fields: {
        field1: `value${i % 10}`,
        field2: `value${i % 5}`,
        field3: `value${i}`
      }
    });
  }
  
  const config = {
    anchor_fields: ['field1', 'field2'],
    anchor_config: {
      normalization: {
        field1: 'lowercase',
        field2: 'lowercase'
      }
    }
  };
  
  // Profile anchor generation
  console.log('Testing anchor generation...');
  const genStart = performance.now();
  const anchorResults = await AnchorGenerator.generateBatch(instances);
  const genDuration = performance.now() - genStart;
  
  console.log(`  Total: ${genDuration.toFixed(2)}ms`);
  console.log(`  Per instance: ${(genDuration / instances.length).toFixed(2)}ms`);
  console.log(`  Target: <10ms per instance`);
  console.log(`  Status: ${genDuration / instances.length < 10 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Profile merging
  console.log('\nTesting entity merging...');
  const mergeStart = performance.now();
  const entities = await AnchorMerger.mergeBatch(anchorResults);
  const mergeDuration = performance.now() - mergeStart;
  
  console.log(`  Total: ${mergeDuration.toFixed(2)}ms`);
  console.log(`  Per instance: ${(mergeDuration / instances.length).toFixed(2)}ms`);
  console.log(`  Target: <100ms for 1000 instances`);
  console.log(`  Status: ${mergeDuration < 100 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Memory usage
  const mem = process.memoryUsage();
  console.log('\nMemory Usage:');
  console.log(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
}

profilePerformance();
```


---

## Error Messages

### Error: "Schema has no anchor_fields configured"

**Meaning**: The schema definition doesn't include `anchor_fields` array

**Solution**:
```javascript
// Add anchor_fields to schema configuration
await prisma.kGSchema.update({
  where: { name: 'YourSchema' },
  data: {
    schema_definition: JSON.stringify({
      ...existingConfig,
      anchor_fields: ['Field1', 'Field2']
    })
  }
});
```

### Error: "Cannot generate anchor: missing anchor field values"

**Meaning**: One or more anchor fields have no value in the instance

**Solution**:
```javascript
// Check which fields are missing
const instance = { /* ... */ };
const config = { anchor_fields: ['Field1', 'Field2'] };

for (const field of config.anchor_fields) {
  if (!instance.fields[field]) {
    console.log(`Missing field: ${field}`);
  }
}

// Either:
// 1. Ensure field extraction populates these fields
// 2. Or remove field from anchor_fields
// 3. Or make field optional in anchor config
```

### Error: "SQLITE_BUSY: database is locked"

**Meaning**: Another process is using the database

**Solution**:
```bash
# Stop all services
pm2 stop all

# Or find and kill the process
lsof prisma/knowledge-base.db
kill -9 <PID>

# Then retry operation
```

### Error: "Invalid anchor fingerprint format"

**Meaning**: Anchor fingerprint doesn't match expected format (entity_type|value1|value2|...)

**Solution**:
```javascript
// Regenerate anchor with correct format
const result = AnchorGenerator.generate(instance, config);
console.log('Correct format:', result.fingerprint);

// Update entity
await prisma.kGEntity.update({
  where: { id: entityId },
  data: { anchor_fingerprint: result.fingerprint }
});
```

### Error: "Conflict detection failed"

**Meaning**: Error in conflict detection logic

**Solution**:
```javascript
// Disable conflict detection temporarily
const config = {
  conflictDetection: { enabled: false }
};

// Or check conflict detector logs
const AnchorConflictDetector = require('./kg/entity/anchor_conflict_detector');
AnchorConflictDetector.setLogLevel('debug');
```

### Error: "LLM API key not found"

**Meaning**: `DASHSCOPE_API_KEY` environment variable not set

**Solution**:
```bash
# Set API key
export DASHSCOPE_API_KEY=your_key_here

# Or add to .env file
echo "DASHSCOPE_API_KEY=your_key_here" >> .env

# Or disable LLM advisory
# In config: llmAdvisory: { enabled: false }
```

### Error: "Migration already applied"

**Meaning**: Database already has anchor columns

**Solution**:
```bash
# Verify migration status
node .kiro/specs/anchor-driven-entity-synthesis/migrations/verify-migration.js

# If already applied, skip migration
# If need to reapply, rollback first:
node .kiro/specs/anchor-driven-entity-synthesis/migrations/rollback-migration.js
```

### Error: "Normalization strategy not found"

**Meaning**: Unknown normalization strategy specified

**Solution**:
```javascript
// Check available strategies
const normalizers = require('./kg/entity/field_normalizers');
console.log('Available strategies:', normalizers.getAvailableStrategies());

// Use valid strategy
const config = {
  anchor_config: {
    normalization: {
      Field1: 'lowercase'  // Valid strategy
    }
  }
};

// Or add custom strategy
normalizers.addStrategy('custom', (value) => {
  return value.toLowerCase().trim();
});
```

---

## Recovery Procedures

### Procedure 1: Rollback to Legacy System

If you need to revert to the legacy system:

```bash
# 1. Backup current state
cp prisma/knowledge-base.db prisma/knowledge-base.backup.db

# 2. Run rollback script
node .kiro/specs/anchor-driven-entity-synthesis/migrations/rollback-migration.js \
  --environment=production

# 3. Update configuration
# Set compatibilityMode to 'LEGACY' in config

# 4. Restart services
pm2 restart kg-service

# 5. Verify
curl http://localhost:3000/api/health
```

### Procedure 2: Restore from Backup

If data is corrupted:

```bash
# 1. Stop all services
pm2 stop all

# 2. Restore database
cp prisma/knowledge-base.backup.db prisma/knowledge-base.db

# 3. Verify restoration
sqlite3 prisma/knowledge-base.db "SELECT COUNT(*) FROM kg_entities"

# 4. Restart services
pm2 start all

# 5. Verify system health
node scripts/health-check.js
```

### Procedure 3: Regenerate All Anchors

If anchors are incorrect:

```javascript
// scripts/regenerate-anchors.js
const { PrismaClient } = require('@prisma/client');
const AnchorGenerator = require('./kg/entity/anchor_generator');

async function regenerateAllAnchors() {
  const prisma = new PrismaClient();
  
  console.log('🔄 Regenerating all anchors...\n');
  
  const entities = await prisma.kGEntity.findMany();
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const entity of entities) {
    try {
      // Get schema config
      const schema = await prisma.kGSchema.findFirst({
        where: { entity_type: entity.type }
      });
      
      if (!schema) {
        skipped++;
        continue;
      }
      
      const config = JSON.parse(schema.schema_definition);
      
      if (!config.anchor_fields || config.anchor_fields.length === 0) {
        skipped++;
        continue;
      }
      
      // Generate new anchor
      const instance = {
        entity_type: entity.type,
        fields: JSON.parse(entity.properties)
      };
      
      const result = AnchorGenerator.generate(instance, config);
      
      // Update entity
      await prisma.kGEntity.update({
        where: { id: entity.id },
        data: {
          anchor_fingerprint: result.fingerprint,
          anchor_fields: JSON.stringify(result.anchorFields)
        }
      });
      
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated} entities updated`);
      }
    } catch (error) {
      console.error(`Error updating entity ${entity.id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  await prisma.$disconnect();
}

regenerateAllAnchors();
```

### Procedure 4: Clean Up Duplicate Entities

If you have duplicate entities:

```javascript
// scripts/cleanup-duplicates.js
const { PrismaClient } = require('@prisma/client');

async function cleanupDuplicates() {
  const prisma = new PrismaClient();
  
  console.log('🧹 Cleaning up duplicate entities...\n');
  
  // Find duplicates
  const duplicates = await prisma.$queryRaw`
    SELECT anchor_fingerprint, COUNT(*) as count
    FROM kg_entities
    WHERE anchor_fingerprint IS NOT NULL
    GROUP BY anchor_fingerprint
    HAVING count > 1
  `;
  
  console.log(`Found ${duplicates.length} duplicate anchors`);
  
  let merged = 0;
  
  for (const dup of duplicates) {
    const entities = await prisma.kGEntity.findMany({
      where: { anchor_fingerprint: dup.anchor_fingerprint },
      orderBy: { created_at: 'asc' }
    });
    
    // Keep first, merge others
    const [primary, ...others] = entities;
    
    for (const other of others) {
      // Merge data
      const primaryProps = JSON.parse(primary.properties);
      const otherProps = JSON.parse(other.properties);
      const mergedProps = { ...primaryProps, ...otherProps };
      
      const primaryCkbs = JSON.parse(primary.ckb_ids);
      const otherCkbs = JSON.parse(other.ckb_ids);
      const mergedCkbs = [...new Set([...primaryCkbs, ...otherCkbs])];
      
      // Update primary
      await prisma.kGEntity.update({
        where: { id: primary.id },
        data: {
          properties: JSON.stringify(mergedProps),
          ckb_ids: JSON.stringify(mergedCkbs)
        }
      });
      
      // Delete duplicate
      await prisma.kGEntity.delete({
        where: { id: other.id }
      });
      
      merged++;
    }
  }
  
  console.log(`\n✅ Merged ${merged} duplicate entities`);
  
  await prisma.$disconnect();
}

cleanupDuplicates();
```

---

## Getting Help

### Before Asking for Help

1. **Check this guide** - Most issues are covered here
2. **Run health check** - Use the health check script above
3. **Check logs** - Review application logs for errors
4. **Try diagnostic tools** - Use the diagnostic scripts provided
5. **Search documentation** - Check other documentation files

### When Asking for Help

Include this information:

```
**Environment**:
- Node.js version: 
- Database: SQLite
- Compatibility mode: 
- Environment: development/staging/production

**Issue Description**:
- What were you trying to do?
- What happened instead?
- Error message (full stack trace):

**Steps to Reproduce**:
1. 
2. 
3. 

**What You've Tried**:
- 
- 

**Health Check Results**:
(Paste output from health-check.js)

**Relevant Configuration**:
(Paste relevant config)

**Sample Data** (if applicable):
(Provide sample data that reproduces the issue)
```

### Resources

- **Documentation**: See `ANCHOR_ARCHITECTURE.md`, `ANCHOR_DEVELOPER_GUIDE.md`, `MIGRATION_GUIDE.md`
- **Examples**: Check test files in `kg/entity/` and `kg/pipeline/`
- **Scripts**: Use diagnostic scripts in this guide
- **Logs**: Check `logs/kg-service.log`

---

**End of Troubleshooting Guide**

For additional help, refer to the documentation or contact the development team.
