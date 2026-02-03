# Semantic Field Extraction - Design Document

## 1. Overview

This design optimizes the existing field extraction system to support **semantic field extraction** with domain-aware strategy selection. The current system extracts generic field types (区域, 数值, 时间) but fails to extract semantic field names (目的地名称, 预算范围, 最佳时间) that are critical for domain-specific knowledge graphs.

### Key Design Principles

1. **Backward Compatibility**: Existing code continues to work without changes
2. **Opt-in Enhancement**: New features are enabled via options parameter
3. **Domain-Aware**: Automatic domain detection drives extraction strategy
4. **Reuse Existing Assets**: Leverage already-implemented prompts and infrastructure
5. **Performance-Conscious**: Track token usage and provide cost estimates

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Semantic Field Extraction System                     │
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Domain     │───▶│  Strategy    │───▶│  Extraction  │          │
│  │  Detector    │    │  Selector    │    │   Engine     │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                   │                   │
│                                                   ▼                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              Extraction Flow (Two-Stage)                       │ │
│  │                                                                │ │
│  │  Stage 1: Algorithm Extraction                                │ │
│  │  Document → Rule/NER → Mapping Table → Schema Field Hits      │ │
│  │                                                                │ │
│  │  Stage 2: LLM Semantic Extraction                             │ │
│  │  Unmapped Fields + Schemas → LLM → Schema Field Hits          │ │
│  │                                                                │ │
│  │  Merge: Combine Hits → Rank Schemas → Filter (>40%)           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                   │                   │
│                                                   ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Schema Matching & Ranking                        │  │
│  │  • Field-to-Schema Mapping                                    │  │
│  │  • Hit Count Aggregation                                      │  │
│  │  • Schema Ranking by Coverage                                 │  │
│  │  • Completeness Filtering (>40%)                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                   │                   │
│                                                   ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Existing Infrastructure (Reused)                      │  │
│  │  • LLM Client (qwen_client.js)                                │  │
│  │  • Prompt Builders (extract_fields.js)                        │  │
│  │  • Rule/NER Extractors                                        │  │
│  │  • Schema Matcher (schema_matcher.js)                         │  │
│  │  • Mapping Table (mapping_based_normalizer.js)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Architecture

### 2.1 Component Structure

The system consists of three new components integrated with existing infrastructure:

#### 2.1.1 Domain Detector
**Purpose**: Fast, rule-based domain detection without LLM calls

**Input**: CKB content (text + metadata)
**Output**: Domain classification (travel, medical, government, legal, financial, general)

**Algorithm**:
- Keyword matching against domain-specific dictionaries
- Metadata analysis (document type, source)
- Confidence scoring based on keyword density
- Execution time: < 10ms (requirement NFR-4.1.2)

#### 2.1.2 Strategy Selector
**Purpose**: Choose extraction strategy based on domain and configuration

**Input**: Domain classification, user options, configuration
**Output**: Extraction strategy (rule-first, llm-first, semantic-only, hybrid)

**Strategy Definitions**:
- **rule-first**: Rule+NER → LLM fallback (current default)
- **llm-first**: LLM → Rule+NER fallback (for high-quality needs)
- **semantic-only**: LLM with semantic prompts only (for travel domain)
- **hybrid**: Rule+NER + LLM semantic extraction in parallel

#### 2.1.3 Extraction Engine (Enhanced)
**Purpose**: Execute extraction using selected strategy

**Enhancements to existing `field_extractor.js`**:
- Add `domain` parameter to `extractFields()`
- Add `strategy` parameter to `extractFields()`
- Add `schema` parameter for schema-aware extraction
- Implement strategy execution logic
- Track token usage per strategy

### 2.2 Data Flow

```
Input: CKB + Options + Available Schemas
       │
       ▼
┌──────────────────┐
│ Domain Detection │ (< 10ms, no LLM)
└────────┬─────────┘
         │ domain: "travel"
         ▼
┌──────────────────┐
│Strategy Selection│ (< 5ms, config lookup)
└────────┬─────────┘
         │ strategy: "semantic-only"
         ▼
┌────────────────────────────────────────┐
│  Stage 1: Algorithm Extraction         │
│  • Rule+NER Extraction                 │
│  • Mapping Table Lookup                │
│  • Schema Field Hit Counting           │
└────────┬───────────────────────────────┘
         │ algorithm_hits: {schema1: 3, schema2: 1}
         │ unmapped_fields: ["景点", "导游"]
         ▼
┌────────────────────────────────────────┐
│  Stage 2: LLM Semantic Extraction      │
│  • LLM with unmapped fields + schemas  │
│  • Schema field hit detection          │
│  • Semantic field name extraction      │
└────────┬───────────────────────────────┘
         │ llm_hits: {schema1: 2, schema3: 4}
         │ semantic_fields: [{name: "景点名称", ...}]
         ▼
┌────────────────────────────────────────┐
│  Merge & Rank Schemas                  │
│  • Combine hit counts                  │
│  • Calculate coverage percentage       │
│  • Rank schemas by coverage            │
│  • Filter schemas (coverage > 40%)     │
└────────┬───────────────────────────────┘
         │
         ▼
Output: {
  fields: [...],           // Semantic fields
  schemaRanking: [...],    // Ranked schemas
  topSchemas: [...]        // Schemas with >40% coverage
}
```

### 2.3 Integration Points

**Existing Components (Reused)**:
- `kg/field_extractor/field_extractor.js` - Enhanced with new parameters
- `kg/field_extractor/llm_extractor.js` - Add semantic prompt selection
- `kg/prompts/extract_fields.js` - Already has semantic prompts
- `kg/utils/qwen_client.js` - LLM client (no changes)
- `kg/utils/token_tracker.js` - Token tracking (no changes)

**New Components**:
- `kg/field_extractor/domain_detector.js` - Domain detection
- `kg/field_extractor/strategy_selector.js` - Strategy selection
- `kg/field_extractor/extraction_config.js` - Configuration management
- `kg/field_extractor/schema_field_matcher.js` - Map fields to schema fields
- `kg/field_extractor/schema_ranker.js` - Rank schemas by field coverage
- `kg/field_extractor/two_stage_extractor.js` - Orchestrate two-stage extraction

## 3. Components and Interfaces

### 3.1 Domain Detector

```javascript
/**
 * Detect document domain from CKB content
 * @param {Object} ckb - CKB object with content and metadata
 * @returns {Object} Domain classification result
 */
function detectDomain(ckb) {
  return {
    domain: 'travel',        // Domain name
    confidence: 0.95,        // Confidence score (0-1)
    keywords: ['旅游', '景点'], // Matched keywords
    executionTime: 5         // Execution time in ms
  };
}

/**
 * Get domain-specific keywords
 * @param {string} domain - Domain name
 * @returns {Array<string>} Keywords for the domain
 */
function getDomainKeywords(domain) {
  return DOMAIN_KEYWORDS[domain] || [];
}
```

**Domain Keyword Dictionaries**:
- **travel**: 旅游, 景点, 攻略, 目的地, 行程, 导游, 住宿, 交通
- **medical**: 医疗, 病人, 诊断, 治疗, 药物, 症状, 医院
- **government**: 政府, 政策, 法规, 公告, 通知, 文件
- **legal**: 法律, 合同, 诉讼, 判决, 律师, 法院
- **financial**: 金融, 投资, 股票, 基金, 银行, 贷款
- **general**: (default, no specific keywords)

### 3.2 Strategy Selector

```javascript
/**
 * Select extraction strategy based on domain and options
 * @param {string} domain - Detected domain
 * @param {Object} options - User options
 * @param {Object} config - System configuration
 * @returns {Object} Strategy selection result
 */
function selectStrategy(domain, options = {}, config = {}) {
  return {
    strategy: 'semantic-only',  // Selected strategy
    promptBuilder: 'travel',    // Prompt builder to use
    useLLM: true,              // Whether to use LLM
    useRules: false,           // Whether to use rules
    useNER: false,             // Whether to use NER
    reason: 'Travel domain defaults to semantic extraction'
  };
}

/**
 * Get default strategy for domain
 * @param {string} domain - Domain name
 * @returns {string} Default strategy name
 */
function getDefaultStrategy(domain) {
  return DEFAULT_STRATEGIES[domain] || 'rule-first';
}
```

**Strategy Configuration** (extraction_config.js):
```javascript
const DEFAULT_STRATEGIES = {
  travel: 'semantic-only',
  medical: 'hybrid',
  government: 'rule-first',
  legal: 'rule-first',
  financial: 'hybrid',
  general: 'rule-first'
};

const PROMPT_BUILDERS = {
  travel: 'buildTravelFieldExtractionPrompt',
  medical: 'buildSemanticFieldExtractionPrompt',
  government: 'buildFieldExtractionPrompt',
  legal: 'buildFieldExtractionPrompt',
  financial: 'buildSemanticFieldExtractionPrompt',
  general: 'buildFieldExtractionPrompt'
};
```

### 3.3 Enhanced Field Extractor

```javascript
/**
 * Extract fields from CKB (Enhanced)
 * @param {Object} ckb - CKB object
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Extracted fields
 */
async function extractFields(ckb, options = {}) {
  const {
    // Existing options
    useLLM = true,
    useRules = true,
    useNER = true,
    minFieldCount = 3,
    forceLLM = false,
    
    // New options
    domain = null,           // Override domain detection
    strategy = null,         // Override strategy selection
    schema = null,           // Target schema for validation
    enableDomainDetection = true,  // Enable automatic domain detection
    trackTokens = true       // Track token usage
  } = options;
  
  // Step 1: Domain Detection (if enabled and not overridden)
  let detectedDomain = domain;
  if (!detectedDomain && enableDomainDetection) {
    const domainResult = domainDetector.detectDomain(ckb);
    detectedDomain = domainResult.domain;
  }
  
  // Step 2: Strategy Selection (if not overridden)
  let selectedStrategy = strategy;
  if (!selectedStrategy) {
    const strategyResult = strategySelector.selectStrategy(
      detectedDomain, 
      options, 
      extractionConfig
    );
    selectedStrategy = strategyResult.strategy;
  }
  
  // Step 3: Execute extraction based on strategy
  const fields = await executeStrategy(
    ckb, 
    selectedStrategy, 
    detectedDomain, 
    schema, 
    options
  );
  
  return fields;
}

/**
 * Execute extraction strategy
 * @param {Object} ckb - CKB object
 * @param {string} strategy - Strategy name
 * @param {string} domain - Domain name
 * @param {Object} schema - Target schema (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Extracted fields
 */
async function executeStrategy(ckb, strategy, domain, schema, options) {
  switch (strategy) {
    case 'rule-first':
      return executeRuleFirst(ckb, options);
    
    case 'llm-first':
      return executeLLMFirst(ckb, domain, schema, options);
    
    case 'semantic-only':
      return executeSemanticOnly(ckb, domain, schema, options);
    
    case 'hybrid':
      return executeHybrid(ckb, domain, schema, options);
    
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}
```

### 3.4 LLM Extractor Enhancement

```javascript
/**
 * Extract fields with LLM using domain-specific prompt
 * @param {Object} ckb - CKB object
 * @param {Array} existingFields - Already extracted fields
 * @param {string} domain - Domain name
 * @param {Object} schema - Target schema (optional)
 * @returns {Promise<Array>} Extracted fields
 */
async function extractFieldsWithLLM(ckb, existingFields = [], domain = 'general', schema = null) {
  const text = ckb.content.text;
  
  // Select prompt builder based on domain
  const promptBuilder = getPromptBuilderForDomain(domain);
  
  // Build prompt with schema guidance if provided
  const prompt = promptBuilder(text, {
    existingFields,
    schema: schema ? schema.fields : null,
    maxFields: domain === 'travel' ? 50 : 30
  });
  
  // Call LLM
  const response = await qwenClient.chat(prompt);
  
  // Parse and validate response
  const fields = parseFieldsFromResponse(response);
  const { validFields } = validateExtractedFields(fields, text);
  
  // Validate against schema if provided
  if (schema) {
    return validateFieldsAgainstSchema(validFields, schema);
  }
  
  return validFields;
}

/**
 * Get prompt builder function for domain
 * @param {string} domain - Domain name
 * @returns {Function} Prompt builder function
 */
function getPromptBuilderForDomain(domain) {
  const builderName = PROMPT_BUILDERS[domain] || 'buildFieldExtractionPrompt';
  return extractFieldsPrompt[builderName];
}
```

### 3.5 Schema Field Matcher

```javascript
/**
 * Match extracted fields to schema fields using mapping table
 * @param {Array} fields - Extracted fields
 * @param {Array} schemas - Available schemas
 * @param {Object} mappingTable - Field mapping table
 * @returns {Object} Schema hit counts
 */
function matchFieldsToSchemas(fields, schemas, mappingTable) {
  const schemaHits = {};  // {schemaId: {fieldName: count}}
  const unmappedFields = [];
  
  for (const field of fields) {
    // Look up field in mapping table
    const mappings = mappingTable.lookup(field.name, field.value);
    
    if (mappings && mappings.length > 0) {
      // Field found in mapping table
      for (const mapping of mappings) {
        const schemaId = mapping.schemaId;
        const schemaField = mapping.schemaField;
        
        if (!schemaHits[schemaId]) {
          schemaHits[schemaId] = {};
        }
        schemaHits[schemaId][schemaField] = 
          (schemaHits[schemaId][schemaField] || 0) + 1;
      }
    } else {
      // Field not found in mapping table
      unmappedFields.push(field);
    }
  }
  
  return {
    schemaHits,      // Schema hit counts
    unmappedFields   // Fields not in mapping table
  };
}

/**
 * Match unmapped fields to schemas using LLM
 * @param {Array} unmappedFields - Fields not in mapping table
 * @param {Array} schemas - Available schemas
 * @param {string} domain - Domain name
 * @returns {Promise<Object>} LLM schema hit counts
 */
async function matchUnmappedFieldsWithLLM(unmappedFields, schemas, domain) {
  if (unmappedFields.length === 0) {
    return {};
  }
  
  // Build prompt for LLM to match fields to schemas
  const prompt = buildSchemaMatchingPrompt(unmappedFields, schemas, domain);
  
  // Call LLM
  const response = await qwenClient.chat(prompt);
  
  // Parse LLM response
  const llmHits = parseSchemaMatchingResponse(response);
  
  return llmHits;  // {schemaId: {fieldName: count}}
}

/**
 * Build prompt for LLM schema matching
 * @param {Array} fields - Unmapped fields
 * @param {Array} schemas - Available schemas
 * @param {string} domain - Domain name
 * @returns {string} Prompt for LLM
 */
function buildSchemaMatchingPrompt(fields, schemas, domain) {
  const fieldsStr = fields.map(f => `${f.name}: ${f.value}`).join('\n');
  const schemasStr = schemas.map(s => 
    `Schema: ${s.name}\nFields: ${s.fields.map(f => f.name).join(', ')}`
  ).join('\n\n');
  
  return `你是一个专业的字段匹配助手。请判断以下提取的字段属于哪些schema的哪些字段。

## 提取的字段
${fieldsStr}

## 可用的Schemas
${schemasStr}

## 任务
对于每个提取的字段，判断它最可能属于哪个schema的哪个字段。
输出JSON格式：
{
  "matches": [
    {
      "extractedField": "字段名",
      "schemaId": "schema_id",
      "schemaField": "schema字段名",
      "confidence": 0.9
    }
  ]
}`;
}
```

### 3.6 Schema Ranker

```javascript
/**
 * Rank schemas by field coverage
 * @param {Object} algorithmHits - Hits from algorithm extraction
 * @param {Object} llmHits - Hits from LLM extraction
 * @param {Array} schemas - Available schemas
 * @returns {Array} Ranked schemas with coverage
 */
function rankSchemas(algorithmHits, llmHits, schemas) {
  // Merge hit counts
  const mergedHits = mergeHitCounts(algorithmHits, llmHits);
  
  // Calculate coverage for each schema
  const schemaScores = [];
  
  for (const schema of schemas) {
    const hits = mergedHits[schema.id] || {};
    const hitCount = Object.keys(hits).length;
    const totalFields = schema.fields.length;
    const coverage = totalFields > 0 ? hitCount / totalFields : 0;
    
    schemaScores.push({
      schemaId: schema.id,
      schemaName: schema.name,
      hitCount,
      totalFields,
      coverage,
      hitFields: Object.keys(hits)
    });
  }
  
  // Sort by coverage (descending)
  schemaScores.sort((a, b) => b.coverage - a.coverage);
  
  return schemaScores;
}

/**
 * Merge hit counts from algorithm and LLM extraction
 * @param {Object} algorithmHits - Algorithm hits
 * @param {Object} llmHits - LLM hits
 * @returns {Object} Merged hit counts
 */
function mergeHitCounts(algorithmHits, llmHits) {
  const merged = {};
  
  // Add algorithm hits
  for (const [schemaId, fields] of Object.entries(algorithmHits)) {
    merged[schemaId] = { ...fields };
  }
  
  // Add LLM hits
  for (const [schemaId, fields] of Object.entries(llmHits)) {
    if (!merged[schemaId]) {
      merged[schemaId] = {};
    }
    for (const [fieldName, count] of Object.entries(fields)) {
      merged[schemaId][fieldName] = 
        (merged[schemaId][fieldName] || 0) + count;
    }
  }
  
  return merged;
}

/**
 * Filter schemas by coverage threshold
 * @param {Array} rankedSchemas - Ranked schemas
 * @param {number} threshold - Minimum coverage (0-1)
 * @returns {Array} Filtered schemas
 */
function filterSchemasByCoverage(rankedSchemas, threshold = 0.4) {
  return rankedSchemas.filter(s => s.coverage >= threshold);
}
```

### 3.7 Two-Stage Extractor

```javascript
/**
 * Extract fields using two-stage approach
 * @param {Object} ckb - CKB object
 * @param {Array} schemas - Available schemas
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extraction result with schema ranking
 */
async function extractWithTwoStages(ckb, schemas, options = {}) {
  const {
    domain = null,
    mappingTable = null,
    coverageThreshold = 0.4
  } = options;
  
  // Detect domain if not provided
  const detectedDomain = domain || domainDetector.detectDomain(ckb).domain;
  
  // Stage 1: Algorithm Extraction
  const algorithmFields = await executeAlgorithmExtraction(ckb, options);
  
  // Match algorithm fields to schemas using mapping table
  const { schemaHits: algorithmHits, unmappedFields } = 
    schemaFieldMatcher.matchFieldsToSchemas(
      algorithmFields, 
      schemas, 
      mappingTable
    );
  
  // Stage 2: LLM Semantic Extraction for unmapped fields
  const llmHits = await schemaFieldMatcher.matchUnmappedFieldsWithLLM(
    unmappedFields,
    schemas,
    detectedDomain
  );
  
  // Also extract semantic field names for unmapped fields
  const semanticFields = await extractSemanticFieldNames(
    ckb,
    unmappedFields,
    detectedDomain
  );
  
  // Merge and rank schemas
  const rankedSchemas = schemaRanker.rankSchemas(
    algorithmHits,
    llmHits,
    schemas
  );
  
  // Filter schemas by coverage threshold
  const topSchemas = schemaRanker.filterSchemasByCoverage(
    rankedSchemas,
    coverageThreshold
  );
  
  return {
    fields: [...algorithmFields, ...semanticFields],
    algorithmHits,
    llmHits,
    unmappedFields,
    schemaRanking: rankedSchemas,
    topSchemas
  };
}

/**
 * Execute algorithm-based extraction (Rule + NER)
 * @param {Object} ckb - CKB object
 * @param {Object} options - Options
 * @returns {Promise<Array>} Extracted fields
 */
async function executeAlgorithmExtraction(ckb, options) {
  const text = ckb.content.text;
  
  // Rule extraction
  const ruleFields = ruleExtractor.extractFields(text);
  
  // NER extraction
  const nerEntities = nerExtractor.extractEntities(text);
  const mergedFields = nerExtractor.mergeWithRuleFields(ruleFields, nerEntities);
  
  // Deduplicate
  return ruleExtractor.deduplicateFields(mergedFields);
}

/**
 * Extract semantic field names for unmapped fields
 * @param {Object} ckb - CKB object
 * @param {Array} unmappedFields - Unmapped fields
 * @param {string} domain - Domain name
 * @returns {Promise<Array>} Semantic fields
 */
async function extractSemanticFieldNames(ckb, unmappedFields, domain) {
  // Build semantic extraction prompt
  const promptBuilder = getPromptBuilderForDomain(domain);
  const prompt = promptBuilder(ckb.content.text, {
    existingFields: unmappedFields,
    maxFields: 30
  });
  
  // Call LLM
  const response = await qwenClient.chat(prompt);
  
  // Parse and validate
  const fields = parseFieldsFromResponse(response);
  const { validFields } = validateExtractedFields(fields, ckb.content.text);
  
  return validFields;
}
```

## 4. Data Models

### 4.1 Domain Classification Result

```javascript
{
  domain: 'travel',           // Domain name (string)
  confidence: 0.95,           // Confidence score (0-1)
  keywords: ['旅游', '景点'],  // Matched keywords (array)
  executionTime: 5,           // Execution time in ms (number)
  metadata: {                 // Additional metadata (object)
    keywordCount: 15,
    totalWords: 200,
    keywordDensity: 0.075
  }
}
```

### 4.2 Strategy Selection Result

```javascript
{
  strategy: 'semantic-only',  // Strategy name (string)
  promptBuilder: 'travel',    // Prompt builder identifier (string)
  useLLM: true,              // Use LLM extraction (boolean)
  useRules: false,           // Use rule extraction (boolean)
  useNER: false,             // Use NER extraction (boolean)
  reason: 'Travel domain defaults to semantic extraction',  // Explanation (string)
  config: {                  // Strategy configuration (object)
    maxFields: 50,
    minConfidence: 0.7
  }
}
```

### 4.3 Extraction Options (Enhanced)

```javascript
{
  // Existing options
  useLLM: true,              // Enable LLM extraction
  useRules: true,            // Enable rule extraction
  useNER: true,              // Enable NER extraction
  minFieldCount: 3,          // Minimum fields before LLM fallback
  forceLLM: false,           // Force LLM extraction
  
  // New options
  domain: 'travel',          // Override domain detection
  strategy: 'semantic-only', // Override strategy selection
  schema: schemaObject,      // Target schema for validation
  enableDomainDetection: true,  // Enable automatic domain detection
  trackTokens: true,         // Track token usage
  validateAgainstSchema: true   // Validate fields against schema
}
```

### 4.4 Extracted Field (Enhanced)

```javascript
{
  name: '目的地名称',         // Semantic field name (string)
  value: '杭州',             // Field value (string)
  type: 'location',         // Data type (string)
  confidence: 0.95,         // Confidence score (0-1)
  source: 'llm',            // Extraction source (string)
  domain: 'travel',         // Domain context (string)
  schemaField: 'destination', // Matched schema field (string, optional)
  metadata: {               // Additional metadata (object)
    strategy: 'semantic-only',
    promptBuilder: 'travel',
    tokenUsage: 150
  }
}
```

### 4.5 Extraction Configuration

```javascript
{
  defaultStrategies: {
    travel: 'semantic-only',
    medical: 'hybrid',
    government: 'rule-first',
    legal: 'rule-first',
    financial: 'hybrid',
    general: 'rule-first'
  },
  promptBuilders: {
    travel: 'buildTravelFieldExtractionPrompt',
    medical: 'buildSemanticFieldExtractionPrompt',
    general: 'buildFieldExtractionPrompt'
  },
  domainKeywords: {
    travel: ['旅游', '景点', '攻略', '目的地', '行程'],
    medical: ['医疗', '病人', '诊断', '治疗', '药物'],
    // ... other domains
  },
  strategyConfig: {
    'semantic-only': {
      useLLM: true,
      useRules: false,
      useNER: false,
      maxFields: 50
    },
    'rule-first': {
      useLLM: true,
      useRules: true,
      useNER: true,
      minFieldCount: 3
    }
    // ... other strategies
  }
}
```

### 4.6 Schema Hit Counts

```javascript
{
  schemaId: 'travel_destination_001',  // Schema identifier (string)
  fields: {                            // Field hit counts (object)
    '目的地名称': 2,                    // Field name: hit count
    '景点名称': 5,
    '预算范围': 1,
    '行程天数': 1
  }
}
```

### 4.7 Schema Ranking Result

```javascript
{
  schemaId: 'travel_destination_001',  // Schema identifier (string)
  schemaName: '旅游目的地',             // Schema display name (string)
  hitCount: 4,                         // Number of fields hit (number)
  totalFields: 8,                      // Total fields in schema (number)
  coverage: 0.5,                       // Coverage percentage (0-1)
  hitFields: [                         // List of hit field names (array)
    '目的地名称',
    '景点名称',
    '预算范围',
    '行程天数'
  ]
}
```

### 4.8 Two-Stage Extraction Result

```javascript
{
  fields: [                            // All extracted fields (array)
    {
      name: '目的地名称',
      value: '杭州',
      type: 'location',
      confidence: 0.95,
      source: 'algorithm'              // 'algorithm' or 'llm'
    },
    {
      name: '景点名称',
      value: '西湖',
      type: 'entity',
      confidence: 0.95,
      source: 'llm'
    }
  ],
  algorithmHits: {                     // Schema hits from algorithm (object)
    'travel_destination_001': {
      '目的地名称': 1,
      '预算范围': 1
    }
  },
  llmHits: {                           // Schema hits from LLM (object)
    'travel_destination_001': {
      '景点名称': 3,
      '行程天数': 1
    }
  },
  unmappedFields: [                    // Fields not in mapping table (array)
    {
      name: '景点',
      value: '西湖',
      type: 'entity'
    }
  ],
  schemaRanking: [                     // All schemas ranked by coverage (array)
    {
      schemaId: 'travel_destination_001',
      schemaName: '旅游目的地',
      hitCount: 4,
      totalFields: 8,
      coverage: 0.5,
      hitFields: ['目的地名称', '景点名称', '预算范围', '行程天数']
    },
    {
      schemaId: 'travel_guide_002',
      schemaName: '旅游攻略',
      hitCount: 2,
      totalFields: 10,
      coverage: 0.2,
      hitFields: ['目的地', '推荐理由']
    }
  ],
  topSchemas: [                        // Schemas with coverage > threshold (array)
    {
      schemaId: 'travel_destination_001',
      schemaName: '旅游目的地',
      hitCount: 4,
      totalFields: 8,
      coverage: 0.5,
      hitFields: ['目的地名称', '景点名称', '预算范围', '行程天数']
    }
  ]
}
```


## 5. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Domain Detection Accuracy
*For any* document with sufficient domain-specific keywords (keyword density > 5%), the domain detector should correctly classify the document into the appropriate domain (travel, medical, government, legal, financial, or general).

**Validates: Requirements 2.1.1**

### Property 2: Strategy Selection Consistency
*For any* detected domain and configuration, the strategy selector should return a valid strategy that matches the configured default for that domain, and the strategy should be one of the supported types (rule-first, llm-first, semantic-only, hybrid).

**Validates: Requirements 2.1.2, 2.2.2**

### Property 3: Semantic Field Names
*For any* travel document extraction using semantic strategy, all extracted field names should be semantic (e.g., "目的地名称", "预算范围", "最佳时间") and not generic type labels (e.g., "区域", "数值", "时间").

**Validates: Requirements 2.1.4**

### Property 4: Strategy Execution Completeness
*For any* supported extraction strategy (rule-first, llm-first, semantic-only, hybrid), the extraction engine should be able to execute that strategy without errors and return a valid array of fields.

**Validates: Requirements 2.2.1**

### Property 5: Schema-Aware Prompt Construction
*For any* schema provided to the extractor, the generated LLM prompt should include all schema field names as guidance for the extraction process.

**Validates: Requirements 2.3.2**

### Property 6: Schema Validation
*For any* set of extracted fields and a target schema, the validation function should verify each field against the schema and return validation results indicating which fields match schema definitions.

**Validates: Requirements 2.3.3**

### Property 7: Field Name Normalization
*For any* extracted field name that is similar to a schema field name (edit distance < 3 or semantic similarity > 0.8), the normalizer should map the extracted field name to the exact schema field name.

**Validates: Requirements 2.3.4**

### Property 8: Token Usage Tracking
*For any* extraction operation with token tracking enabled, the system should record the token usage and associate it with the extraction strategy used.

**Validates: Requirements 2.4.1**

### Property 9: Semantic Prompt Selection
*For any* extraction using a semantic strategy (semantic-only or hybrid), the system should use a semantic prompt builder (buildSemanticFieldExtractionPrompt or buildTravelFieldExtractionPrompt) rather than the generic prompt builder.

**Validates: Requirements 2.4.2**

### Property 10: Batch Extraction Completeness
*For any* array of CKB objects provided to the batch extraction function, the function should return extraction results for all CKBs, with each result containing either extracted fields or an error message.

**Validates: Requirements 2.4.3**

### Property 11: Cache Effectiveness
*For any* CKB that is extracted twice with the same options, the second extraction should use cached results and not make a redundant LLM call, resulting in zero additional token usage.

**Validates: Requirements 2.4.4**

### Property 12: Backward Compatibility
*For any* existing code that calls extractFields() without the new parameters (domain, strategy, schema), the function should execute using the default "rule-first" strategy and return results in the same format as before.

**Validates: Requirements NFR-4.4.1, NFR-4.4.2**

### Property 13: Domain Detection Performance
*For any* CKB document, the domain detection should complete within 10ms without making any LLM calls.

**Validates: Requirements NFR-4.1.2**

### Property 14: Strategy Selection Performance
*For any* domain and configuration, the strategy selection should complete within 5ms.

**Validates: Requirements NFR-4.1.3**

### Property 15: Two-Stage Extraction Completeness
*For any* CKB and available schemas, the two-stage extraction should return both algorithm-extracted fields and LLM-extracted semantic fields, along with schema ranking results.

**Validates: Requirements 2.1.1, 2.1.2, 2.1.4**

### Property 16: Schema Hit Counting Accuracy
*For any* set of extracted fields and mapping table, the schema field matcher should correctly count hits for each schema based on mapping table lookups.

**Validates: Requirements 2.3.3**

### Property 17: Unmapped Field Detection
*For any* set of extracted fields and mapping table, all fields that are not found in the mapping table should be identified as unmapped fields for LLM processing.

**Validates: Requirements 2.1.4, 3.3.1**

### Property 18: Schema Ranking Correctness
*For any* algorithm hits and LLM hits, the schema ranker should correctly merge the hit counts and rank schemas by coverage percentage in descending order.

**Validates: Requirements 2.3.3**

### Property 19: Coverage Threshold Filtering
*For any* ranked schemas and coverage threshold, only schemas with coverage >= threshold should be included in the top schemas list.

**Validates: Requirements 2.3.3**

### Property 20: LLM Schema Matching
*For any* unmapped fields and available schemas, the LLM schema matcher should return valid schema field mappings with confidence scores.

**Validates: Requirements 2.1.4, 2.3.2, 3.3.2**

## 6. Error Handling

### 6.1 Domain Detection Errors

**Error Scenarios**:
- Empty or null CKB content
- CKB with no recognizable keywords
- Ambiguous domain (multiple domains with similar confidence)

**Handling Strategy**:
```javascript
function detectDomain(ckb) {
  try {
    // Validate input
    if (!ckb || !ckb.content || !ckb.content.text) {
      return {
        domain: 'general',
        confidence: 1.0,
        keywords: [],
        reason: 'Empty content defaults to general domain'
      };
    }
    
    // Detect domain
    const result = performDomainDetection(ckb);
    
    // Handle ambiguous results
    if (result.confidence < 0.6) {
      return {
        domain: 'general',
        confidence: 1.0,
        keywords: result.keywords,
        reason: 'Low confidence defaults to general domain'
      };
    }
    
    return result;
  } catch (error) {
    console.error('Domain detection error:', error);
    return {
      domain: 'general',
      confidence: 1.0,
      keywords: [],
      error: error.message
    };
  }
}
```

### 6.2 Strategy Selection Errors

**Error Scenarios**:
- Unknown domain
- Invalid strategy override
- Missing configuration

**Handling Strategy**:
```javascript
function selectStrategy(domain, options = {}, config = {}) {
  try {
    // Validate domain
    const validDomain = SUPPORTED_DOMAINS.includes(domain) ? domain : 'general';
    
    // Check for strategy override
    if (options.strategy) {
      if (!SUPPORTED_STRATEGIES.includes(options.strategy)) {
        throw new Error(`Invalid strategy: ${options.strategy}`);
      }
      return buildStrategyResult(options.strategy, validDomain);
    }
    
    // Get default strategy from config
    const defaultStrategy = config.defaultStrategies?.[validDomain] || 'rule-first';
    
    return buildStrategyResult(defaultStrategy, validDomain);
  } catch (error) {
    console.error('Strategy selection error:', error);
    // Fallback to safe default
    return buildStrategyResult('rule-first', 'general');
  }
}
```

### 6.3 Extraction Errors

**Error Scenarios**:
- LLM API failure
- Invalid LLM response format
- Schema validation failure
- Token budget exceeded

**Handling Strategy**:
```javascript
async function executeSemanticOnly(ckb, domain, schema, options) {
  try {
    // Check token budget
    if (options.tokenBudget && tokenTracker.getRemainingBudget() < 100) {
      throw new Error('Token budget exceeded');
    }
    
    // Extract with LLM
    const fields = await llmExtractor.extractFieldsWithLLM(
      ckb, 
      [], 
      domain, 
      schema
    );
    
    // Validate results
    if (!Array.isArray(fields) || fields.length === 0) {
      console.warn('Semantic extraction returned no fields, falling back to rule-based');
      return executeRuleFirst(ckb, options);
    }
    
    return fields;
  } catch (error) {
    console.error('Semantic extraction error:', error);
    
    // Record error
    performanceMonitor.recordError({
      type: 'semantic_extraction_error',
      module: 'field_extractor',
      operation: 'executeSemanticOnly',
      message: error.message,
      ckb_id: ckb.ckb_id
    });
    
    // Fallback to rule-based extraction
    console.log('Falling back to rule-based extraction');
    return executeRuleFirst(ckb, options);
  }
}
```

### 6.4 Schema Validation Errors

**Error Scenarios**:
- Invalid schema format
- Missing required schema fields
- Field type mismatch

**Handling Strategy**:
```javascript
function validateFieldsAgainstSchema(fields, schema) {
  try {
    // Validate schema format
    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      console.warn('Invalid schema format, skipping validation');
      return fields;
    }
    
    const validatedFields = [];
    const warnings = [];
    
    for (const field of fields) {
      const schemaField = findMatchingSchemaField(field, schema);
      
      if (schemaField) {
        // Field matches schema
        validatedFields.push({
          ...field,
          schemaField: schemaField.name,
          validated: true
        });
      } else {
        // Field doesn't match schema
        warnings.push(`Field "${field.name}" not found in schema`);
        validatedFields.push({
          ...field,
          validated: false
        });
      }
    }
    
    if (warnings.length > 0) {
      console.warn('Schema validation warnings:', warnings);
    }
    
    return validatedFields;
  } catch (error) {
    console.error('Schema validation error:', error);
    // Return fields without validation
    return fields;
  }
}
```

## 7. Testing Strategy

### 7.1 Testing Approach

This feature requires a **dual testing approach** combining unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both types of tests are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### 7.2 Property-Based Testing

**Framework**: Use `fast-check` library for JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `// Feature: semantic-field-extraction, Property N: [property text]`

**Property Test Examples**:

```javascript
// Feature: semantic-field-extraction, Property 1: Domain Detection Accuracy
test('domain detection correctly classifies documents with sufficient keywords', () => {
  fc.assert(
    fc.property(
      fc.record({
        domain: fc.constantFrom('travel', 'medical', 'government'),
        keywordCount: fc.integer({ min: 10, max: 50 })
      }),
      ({ domain, keywordCount }) => {
        // Generate document with domain keywords
        const ckb = generateCKBWithKeywords(domain, keywordCount);
        
        // Detect domain
        const result = domainDetector.detectDomain(ckb);
        
        // Verify correct classification
        return result.domain === domain && result.confidence > 0.6;
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: semantic-field-extraction, Property 3: Semantic Field Names
test('travel extraction produces semantic field names', () => {
  fc.assert(
    fc.property(
      generateTravelCKB(),
      async (ckb) => {
        // Extract with semantic strategy
        const fields = await extractFields(ckb, {
          domain: 'travel',
          strategy: 'semantic-only'
        });
        
        // Verify all field names are semantic
        const genericTypes = ['区域', '数值', '时间', '单位', '指标'];
        return fields.every(f => !genericTypes.includes(f.name));
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: semantic-field-extraction, Property 11: Cache Effectiveness
test('repeated extraction uses cache', () => {
  fc.assert(
    fc.property(
      generateRandomCKB(),
      async (ckb) => {
        // First extraction
        const tokensBefore = tokenTracker.getTotalTokens();
        await extractFields(ckb, { domain: 'travel' });
        const tokensAfterFirst = tokenTracker.getTotalTokens();
        const firstCallTokens = tokensAfterFirst - tokensBefore;
        
        // Second extraction (should use cache)
        await extractFields(ckb, { domain: 'travel' });
        const tokensAfterSecond = tokenTracker.getTotalTokens();
        const secondCallTokens = tokensAfterSecond - tokensAfterFirst;
        
        // Verify cache was used (no additional tokens)
        return secondCallTokens === 0 && firstCallTokens > 0;
      }
    ),
    { numRuns: 100 }
  );
});
```

### 7.3 Unit Testing

**Focus Areas**:
- Domain keyword matching edge cases
- Strategy configuration loading
- Error handling and fallback behavior
- Schema validation logic
- Prompt builder selection

**Unit Test Examples**:

```javascript
describe('Domain Detector', () => {
  test('empty content defaults to general domain', () => {
    const ckb = { content: { text: '' } };
    const result = domainDetector.detectDomain(ckb);
    expect(result.domain).toBe('general');
    expect(result.confidence).toBe(1.0);
  });
  
  test('travel keywords trigger travel domain', () => {
    const ckb = {
      content: {
        text: '杭州旅游攻略，主要景点有西湖、灵隐寺，行程4天3晚'
      }
    };
    const result = domainDetector.detectDomain(ckb);
    expect(result.domain).toBe('travel');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  
  test('ambiguous content defaults to general', () => {
    const ckb = {
      content: {
        text: '这是一段普通的文本，没有明确的领域特征'
      }
    };
    const result = domainDetector.detectDomain(ckb);
    expect(result.domain).toBe('general');
  });
});

describe('Strategy Selector', () => {
  test('travel domain defaults to semantic-only', () => {
    const result = strategySelector.selectStrategy('travel');
    expect(result.strategy).toBe('semantic-only');
  });
  
  test('general domain defaults to rule-first', () => {
    const result = strategySelector.selectStrategy('general');
    expect(result.strategy).toBe('rule-first');
  });
  
  test('strategy override works', () => {
    const result = strategySelector.selectStrategy('travel', {
      strategy: 'hybrid'
    });
    expect(result.strategy).toBe('hybrid');
  });
  
  test('invalid strategy throws error', () => {
    expect(() => {
      strategySelector.selectStrategy('travel', {
        strategy: 'invalid-strategy'
      });
    }).toThrow('Invalid strategy');
  });
});

describe('Extraction Engine', () => {
  test('semantic-only uses semantic prompt', async () => {
    const ckb = createTravelCKB();
    const promptSpy = jest.spyOn(extractFieldsPrompt, 'buildTravelFieldExtractionPrompt');
    
    await extractFields(ckb, {
      domain: 'travel',
      strategy: 'semantic-only'
    });
    
    expect(promptSpy).toHaveBeenCalled();
  });
  
  test('backward compatibility: no options uses rule-first', async () => {
    const ckb = createGenericCKB();
    const fields = await extractFields(ckb);
    
    // Should work without errors
    expect(Array.isArray(fields)).toBe(true);
  });
});
```

### 7.4 Integration Testing

**Test Scenarios**:
1. End-to-end extraction with real travel documents
2. Schema-aware extraction with validation
3. Batch extraction with multiple domains
4. Token tracking across multiple extractions
5. Cache behavior with repeated extractions

**Integration Test Example**:

```javascript
describe('Semantic Field Extraction Integration', () => {
  test('travel document extraction produces complete semantic fields', async () => {
    const travelText = `
      苏杭四日游，人均800多点，冬天去最合适。
      主要景点有西湖、乌镇西栅、南浔古镇。
      风景优美，古镇风情浓郁。建议坐高铁前往。
    `;
    
    const ckb = {
      ckb_id: 'test-001',
      content: { text: travelText }
    };
    
    const fields = await extractFields(ckb, {
      enableDomainDetection: true,
      trackTokens: true
    });
    
    // Verify semantic field names
    const fieldNames = fields.map(f => f.name);
    expect(fieldNames).toContain('目的地名称');
    expect(fieldNames).toContain('景点名称');
    expect(fieldNames).toContain('预算范围');
    expect(fieldNames).toContain('最佳时间');
    
    // Verify no generic type labels
    expect(fieldNames).not.toContain('区域');
    expect(fieldNames).not.toContain('数值');
    expect(fieldNames).not.toContain('时间');
    
    // Verify token tracking
    const stats = tokenTracker.getStats();
    expect(stats.totalTokens).toBeGreaterThan(0);
  });
  
  test('schema-aware extraction validates fields', async () => {
    const schema = {
      name: 'travel_destination',
      fields: [
        { name: '目的地名称', type: 'location' },
        { name: '景点名称', type: 'entity' },
        { name: '预算范围', type: 'number' }
      ]
    };
    
    const ckb = createTravelCKB();
    
    const fields = await extractFields(ckb, {
      domain: 'travel',
      schema: schema,
      validateAgainstSchema: true
    });
    
    // Verify fields are validated
    const validatedFields = fields.filter(f => f.validated);
    expect(validatedFields.length).toBeGreaterThan(0);
    
    // Verify schema field mapping
    const mappedFields = fields.filter(f => f.schemaField);
    expect(mappedFields.length).toBeGreaterThan(0);
  });
});
```

### 7.5 Performance Testing

**Performance Requirements**:
- Domain detection: < 10ms
- Strategy selection: < 5ms
- Semantic extraction: < 5 seconds per CKB
- Token usage: < 2000 tokens per CKB

**Performance Test Example**:

```javascript
describe('Performance Requirements', () => {
  test('domain detection completes within 10ms', () => {
    const ckb = createLargeCKB(5000); // 5000 characters
    
    const startTime = Date.now();
    domainDetector.detectDomain(ckb);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(10);
  });
  
  test('strategy selection completes within 5ms', () => {
    const startTime = Date.now();
    strategySelector.selectStrategy('travel');
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5);
  });
  
  test('semantic extraction uses reasonable tokens', async () => {
    const ckb = createTravelCKB();
    
    const tokensBefore = tokenTracker.getTotalTokens();
    await extractFields(ckb, { domain: 'travel' });
    const tokensUsed = tokenTracker.getTotalTokens() - tokensBefore;
    
    expect(tokensUsed).toBeLessThan(2000);
  });
});
```

### 7.6 Test Data

**Test Data Requirements**:
- Real travel documents from production
- Synthetic documents with known field values
- Edge cases: empty content, very long content, ambiguous domains
- Multiple languages (focus on Chinese first)

**Test Data Generation**:

```javascript
function generateTravelCKB() {
  return fc.record({
    ckb_id: fc.uuid(),
    content: fc.record({
      text: fc.string().chain(baseText => {
        // Add travel keywords
        const keywords = ['旅游', '景点', '攻略', '目的地'];
        const keyword = fc.constantFrom(...keywords);
        return fc.tuple(fc.constant(baseText), keyword).map(
          ([text, kw]) => `${text} ${kw} 杭州 西湖 4天3晚 800元`
        );
      })
    })
  });
}

function createTravelCKB() {
  return {
    ckb_id: 'travel-001',
    doc_id: 'doc-001',
    content: {
      text: '苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。'
    }
  };
}
```

## 8. Implementation Notes

### 8.1 Phased Implementation

**Phase 1: Core Infrastructure** (Priority: High)
- Implement domain_detector.js
- Implement strategy_selector.js
- Implement extraction_config.js
- Add new parameters to extractFields()

**Phase 2: Strategy Execution** (Priority: High)
- Implement executeSemanticOnly()
- Implement executeHybrid()
- Enhance llm_extractor.js with domain support
- Add prompt builder selection logic

**Phase 3: Schema Integration** (Priority: Medium)
- Implement schema validation
- Implement field name normalization
- Add schema-aware prompt construction

**Phase 4: Optimization** (Priority: Medium)
- Implement caching for repeated extractions
- Add token budget management
- Optimize prompt sizes

**Phase 5: Testing & Documentation** (Priority: High)
- Write property-based tests
- Write unit tests
- Write integration tests
- Update API documentation

### 8.2 Migration Strategy

**Backward Compatibility**:
- All existing code continues to work without changes
- New features are opt-in via options parameter
- Default behavior remains "rule-first" strategy

**Migration Path for Existing Code**:

```javascript
// Old code (still works)
const fields = await extractFields(ckb);

// New code (opt-in to semantic extraction)
const fields = await extractFields(ckb, {
  enableDomainDetection: true  // Enable new features
});

// Explicit domain and strategy
const fields = await extractFields(ckb, {
  domain: 'travel',
  strategy: 'semantic-only'
});

// Schema-aware extraction
const fields = await extractFields(ckb, {
  domain: 'travel',
  schema: travelSchema,
  validateAgainstSchema: true
});
```

### 8.3 Configuration Management

**Configuration File** (extraction_config.json):

```json
{
  "defaultStrategies": {
    "travel": "semantic-only",
    "medical": "hybrid",
    "government": "rule-first",
    "legal": "rule-first",
    "financial": "hybrid",
    "general": "rule-first"
  },
  "promptBuilders": {
    "travel": "buildTravelFieldExtractionPrompt",
    "medical": "buildSemanticFieldExtractionPrompt",
    "government": "buildFieldExtractionPrompt",
    "legal": "buildFieldExtractionPrompt",
    "financial": "buildSemanticFieldExtractionPrompt",
    "general": "buildFieldExtractionPrompt"
  },
  "domainKeywords": {
    "travel": ["旅游", "景点", "攻略", "目的地", "行程", "导游", "住宿", "交通"],
    "medical": ["医疗", "病人", "诊断", "治疗", "药物", "症状", "医院", "医生"],
    "government": ["政府", "政策", "法规", "公告", "通知", "文件", "部门"],
    "legal": ["法律", "合同", "诉讼", "判决", "律师", "法院", "条款"],
    "financial": ["金融", "投资", "股票", "基金", "银行", "贷款", "利率"],
    "general": []
  },
  "strategyConfig": {
    "semantic-only": {
      "useLLM": true,
      "useRules": false,
      "useNER": false,
      "maxFields": 50,
      "minConfidence": 0.7
    },
    "rule-first": {
      "useLLM": true,
      "useRules": true,
      "useNER": true,
      "minFieldCount": 3,
      "minConfidence": 0.7
    },
    "llm-first": {
      "useLLM": true,
      "useRules": true,
      "useNER": true,
      "llmFirst": true,
      "minConfidence": 0.8
    },
    "hybrid": {
      "useLLM": true,
      "useRules": true,
      "useNER": true,
      "parallel": true,
      "minConfidence": 0.7
    }
  },
  "performance": {
    "domainDetectionTimeout": 10,
    "strategySelectionTimeout": 5,
    "extractionTimeout": 5000,
    "maxTokensPerCKB": 2000
  }
}
```

### 8.4 Monitoring and Metrics

**Metrics to Track**:
- Domain detection accuracy (by domain)
- Strategy selection distribution (by domain)
- Field extraction completeness (fields per CKB)
- Token usage (by strategy)
- Extraction time (by strategy)
- Cache hit rate
- Error rate (by error type)

**Monitoring Implementation**:

```javascript
// Track domain detection
performanceMonitor.recordMetric({
  metric: 'domain_detection',
  domain: result.domain,
  confidence: result.confidence,
  executionTime: result.executionTime
});

// Track strategy selection
performanceMonitor.recordMetric({
  metric: 'strategy_selection',
  domain: domain,
  strategy: result.strategy,
  executionTime: Date.now() - startTime
});

// Track extraction
performanceMonitor.recordMetric({
  metric: 'field_extraction',
  domain: domain,
  strategy: strategy,
  fieldCount: fields.length,
  tokenUsage: tokensUsed,
  executionTime: Date.now() - startTime
});
```

### 8.5 Future Enhancements

**Not in Scope for This Spec** (see Requirements 7.2):
- Active learning to improve extraction over time
- User feedback loop for field corrections
- Automatic prompt optimization based on results
- Support for structured document formats (tables, forms)
- Multi-language support beyond Chinese
- Custom NER models for semantic extraction
- Automatic schema generation from extracted fields

These enhancements can be addressed in future specs once the core semantic extraction system is stable and validated.

