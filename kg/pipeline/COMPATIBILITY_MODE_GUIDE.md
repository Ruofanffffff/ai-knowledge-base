# Compatibility Mode Guide

## Overview

The Universal Document Pipeline supports three compatibility modes for entity building, allowing gradual migration from the legacy name-similarity approach to the new anchor-driven synthesis mechanism.

## Compatibility Modes

### 1. ANCHOR_ONLY (Default)

**Description**: Pure anchor-driven mode. Uses the new anchor fingerprint mechanism for all entity synthesis.

**When to use**:
- For new projects starting from scratch
- When all schemas have `anchor_fields` configured
- When you want the most accurate entity merging

**Behavior**:
- Generates schema instances from matched schemas
- Creates anchor fingerprints for each instance
- Merges instances with identical anchors into entities
- Fails if anchor generation encounters errors

**Configuration**:
```javascript
const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    compatibilityMode: COMPATIBILITY_MODE.ANCHOR_ONLY
  }
});
```

**Advantages**:
- ✅ Most accurate entity merging
- ✅ Deterministic results (same input → same output)
- ✅ Semantic-aware merging
- ✅ Reduced LLM token usage

**Disadvantages**:
- ❌ Requires schemas to have `anchor_fields` configured
- ❌ May fail if anchor configuration is incorrect

---

### 2. HYBRID (Recommended for Migration)

**Description**: Hybrid mode. Tries anchor-driven mode first, falls back to legacy mode on failure.

**When to use**:
- During migration from legacy to anchor-driven mode
- When some schemas have `anchor_fields` but others don't
- When you want safety with gradual adoption

**Behavior**:
- First attempts anchor-driven entity building
- If anchor mode fails (e.g., missing anchor_fields), automatically falls back to legacy mode
- Logs warnings when fallback occurs
- Continues processing without interruption

**Configuration**:
```javascript
const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    compatibilityMode: COMPATIBILITY_MODE.HYBRID
  }
});
```

**Advantages**:
- ✅ Safe migration path
- ✅ No service interruption
- ✅ Gradual schema configuration
- ✅ Automatic fallback on errors

**Disadvantages**:
- ⚠️ Inconsistent behavior (some entities use anchors, others don't)
- ⚠️ May hide configuration issues

---

### 3. LEGACY

**Description**: Traditional mode. Uses the old name-similarity mechanism for entity building.

**When to use**:
- For backward compatibility with existing systems
- When anchor configuration is not yet ready
- For testing and comparison purposes

**Behavior**:
- Builds entities directly from matched schemas
- Uses name similarity for entity merging
- No anchor fingerprints generated
- Same behavior as the original system

**Configuration**:
```javascript
const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    compatibilityMode: COMPATIBILITY_MODE.LEGACY
  }
});
```

**Advantages**:
- ✅ No schema configuration required
- ✅ Backward compatible
- ✅ Works with all existing schemas

**Disadvantages**:
- ❌ Less accurate entity merging
- ❌ Higher LLM token usage
- ❌ Non-deterministic results

---

## Migration Strategy

### Phase 1: Assessment (Week 1)
1. Identify all schemas in use
2. Analyze which schemas need anchor configuration
3. Prioritize schemas by usage frequency

### Phase 2: Gradual Configuration (Weeks 2-4)
1. Start with HYBRID mode
2. Configure `anchor_fields` for high-priority schemas
3. Test each schema after configuration
4. Monitor fallback warnings

### Phase 3: Validation (Week 5)
1. Review fallback logs
2. Fix any remaining schema configurations
3. Run integration tests
4. Compare results with legacy mode

### Phase 4: Full Migration (Week 6)
1. Switch to ANCHOR_ONLY mode
2. Monitor for errors
3. Have rollback plan ready (switch back to HYBRID)
4. Gradually remove legacy code

---

## Configuration Examples

### Example 1: New Project (Anchor-Only)
```javascript
const { UniversalDocumentPipeline, COMPATIBILITY_MODE } = require('./kg/pipeline/universal_document_pipeline');

const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    compatibilityMode: COMPATIBILITY_MODE.ANCHOR_ONLY,
    detectConflicts: true  // Enable conflict detection
  }
});

const result = await pipeline.processDocument(document);
```

### Example 2: Migration (Hybrid)
```javascript
const { UniversalDocumentPipeline, COMPATIBILITY_MODE } = require('./kg/pipeline/universal_document_pipeline');

const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    compatibilityMode: COMPATIBILITY_MODE.HYBRID,
    detectConflicts: false  // Disable during migration
  }
});

const result = await pipeline.processDocument(document);

// Check if fallback occurred
if (result.warnings.some(w => w.error.includes('降级到传统模式'))) {
  console.warn('Fallback to legacy mode occurred');
  // Log for later schema configuration
}
```

### Example 3: Legacy System (Backward Compatible)
```javascript
const { UniversalDocumentPipeline, COMPATIBILITY_MODE } = require('./kg/pipeline/universal_document_pipeline');

const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    compatibilityMode: COMPATIBILITY_MODE.LEGACY
  }
});

const result = await pipeline.processDocument(document);
```

---

## Monitoring and Debugging

### Check Current Mode
```javascript
const result = await pipeline.processDocument(document);
const mode = result.steps.entityBuilding.metrics.mode;
console.log(`Entity building mode: ${mode}`);
```

### Monitor Fallback Events (Hybrid Mode)
```javascript
const result = await pipeline.processDocument(document);
const fallbackWarnings = result.warnings.filter(w => 
  w.step === 'entityBuilding' && w.error.includes('降级')
);

if (fallbackWarnings.length > 0) {
  console.warn(`Fallback occurred ${fallbackWarnings.length} times`);
  fallbackWarnings.forEach(w => console.warn(w.error));
}
```

### Compare Modes (Testing)
```javascript
// Process with anchor mode
const pipelineAnchor = new UniversalDocumentPipeline({
  entityBuilding: { compatibilityMode: COMPATIBILITY_MODE.ANCHOR_ONLY }
});
const resultAnchor = await pipelineAnchor.processDocument(document);

// Process with legacy mode
const pipelineLegacy = new UniversalDocumentPipeline({
  entityBuilding: { compatibilityMode: COMPATIBILITY_MODE.LEGACY }
});
const resultLegacy = await pipelineLegacy.processDocument(document);

// Compare results
console.log('Anchor entities:', resultAnchor.data.entities.length);
console.log('Legacy entities:', resultLegacy.data.entities.length);
```

---

## Troubleshooting

### Issue: Anchor mode fails with "missing anchor_fields"

**Solution**: 
1. Check if the schema has `anchor_fields` configured
2. Use HYBRID mode temporarily
3. Configure `anchor_fields` for the schema
4. Test with ANCHOR_ONLY mode

### Issue: Hybrid mode always falls back to legacy

**Solution**:
1. Check logs for specific error messages
2. Verify anchor_fields configuration
3. Ensure field normalizers are working
4. Test anchor generation manually

### Issue: Different results between modes

**Expected**: Anchor mode should produce more accurate merging. If results differ significantly:
1. Review anchor_fields configuration
2. Check if time granularity is appropriate
3. Verify field normalization strategies
4. Compare entity fingerprints manually

---

## Best Practices

1. **Start with HYBRID mode** during migration
2. **Monitor fallback warnings** to identify schemas needing configuration
3. **Test each schema** after configuring anchor_fields
4. **Use ANCHOR_ONLY** for production once all schemas are configured
5. **Keep LEGACY mode** available for emergency rollback
6. **Document schema configurations** for team reference
7. **Run integration tests** before switching modes

---

## Performance Considerations

| Mode | Token Usage | Processing Speed | Accuracy |
|------|-------------|------------------|----------|
| ANCHOR_ONLY | Low | Fast | High |
| HYBRID | Medium | Medium | Medium-High |
| LEGACY | High | Slow | Medium |

**Recommendation**: Use ANCHOR_ONLY for best performance and accuracy once schemas are configured.

---

## Related Documentation

- [Anchor Fields Guide](../schema/ANCHOR_FIELDS_GUIDE.md) - How to configure anchor_fields
- [Schema Validator](../schema/schema_validator.js) - Validate schema configurations
- [Anchor Generator](../entity/anchor_generator.js) - Anchor fingerprint generation
- [Anchor Merger](../entity/anchor_merger.js) - Entity merging logic

---

## Support

For questions or issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review schema configuration examples
3. Test with HYBRID mode first
4. Contact the development team with logs and error messages
