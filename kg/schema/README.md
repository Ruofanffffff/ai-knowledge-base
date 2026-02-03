# Schema Management Module

This module handles CRUD operations for schema definitions in the knowledge graph system. Schemas define how entities are recognized and constructed from CKB (Contextual Knowledge Block) data.

## Overview

The Schema Manager provides:
- **Schema Validation**: Ensures schema definitions are well-formed
- **CRUD Operations**: Create, Read, Update, Delete schemas
- **Query Methods**: Find schemas by ID, name, or entity type
- **Example Schemas**: Pre-defined schemas for common entity types

## Schema Structure

A schema defines how to recognize and construct entities from extracted fields:

```javascript
{
  schema_name: string,      // Unique schema identifier
  entity_type: string,      // Type of entity this schema creates
  core_fields: [            // Fields required to construct entity
    {
      name: string,         // Field name
      weight: number,       // Importance weight (0-1)
      required: boolean     // Whether field is mandatory
    }
  ],
  threshold: number,        // Completeness threshold (0-1) to trigger entity creation
  relations: [              // Optional: Built-in relations to create
    {
      type: string,         // Relation type
      target_field: string, // Field containing target entity
      direction: string     // 'outgoing' or 'incoming'
    }
  ],
  version: string          // Schema version (e.g., '1.0.0')
}
```

## Validation Rules

The Schema Manager enforces these validation rules:

1. **Required Fields**:
   - `schema_name` (string, unique)
   - `entity_type` (string)
   - `core_fields` (non-empty array)
   - `threshold` (number between 0 and 1)

2. **Core Fields**:
   - Each field must have `name` (string), `weight` (0-1), and `required` (boolean)
   - Weights must sum to 1.0 (±0.01 tolerance)

3. **Relations** (optional):
   - Each relation must have `type`, `target_field`, and `direction`
   - Direction must be 'outgoing' or 'incoming'

## Usage Examples

### Creating a Schema

```javascript
const schemaManager = require('./kg/schema/schema_manager');

const schema = {
  schema_name: '地下水位变化事件',
  entity_type: 'EventEntity',
  core_fields: [
    { name: '区域', weight: 0.3, required: true },
    { name: '时间', weight: 0.2, required: true },
    { name: '指标', weight: 0.2, required: true },
    { name: '数值', weight: 0.2, required: false },
    { name: '单位', weight: 0.1, required: false }
  ],
  threshold: 0.75,
  relations: [
    { type: '发生于', target_field: '区域', direction: 'outgoing' },
    { type: '发生时间', target_field: '时间', direction: 'outgoing' }
  ]
};

const schemaId = await schemaManager.createSchema(schema);
console.log('Created schema:', schemaId);
```

### Retrieving Schemas

```javascript
// Get by ID
const schema = await schemaManager.getSchema(schemaId);

// Get by name
const schema = await schemaManager.getSchemaByName('地下水位变化事件');

// List all schemas
const allSchemas = await schemaManager.listSchemas();

// Filter by entity type
const eventSchemas = await schemaManager.listSchemas({ 
  entityType: 'EventEntity' 
});

// Get schemas by entity type
const schemas = await schemaManager.getSchemasByEntityType('EventEntity');
```

### Updating a Schema

```javascript
await schemaManager.updateSchema(schemaId, {
  threshold: 0.8,
  version: '1.1.0'
});
```

### Deleting a Schema

```javascript
await schemaManager.deleteSchema(schemaId);
```

### Checking Schema Existence

```javascript
const exists = await schemaManager.schemaExists('地下水位变化事件');
if (exists) {
  console.log('Schema already exists');
}
```

## Example Schemas

The module includes 8 pre-defined example schemas:

1. **地下水位变化事件** (Groundwater Level Change Event)
2. **区域实体** (Location Entity)
3. **指标实体** (Indicator Entity)
4. **项目实体** (Project Entity)
5. **人员实体** (Person Entity)
6. **组织实体** (Organization Entity)
7. **文档实体** (Document Entity)
8. **设备实体** (Equipment Entity)

See `example_schemas.js` for complete definitions.

## Initializing Default Schemas

To populate the database with example schemas:

```bash
node kg/schema/init_schemas.js
```

This script will:
- Check for existing schemas (skip if already present)
- Create all example schemas
- Display a summary of results

## Schema Completeness Calculation

When fields are extracted from a CKB, the Schema Matcher calculates a completeness score:

```
Completeness = Σ(field_match_count × field_weight) × source_confidence
```

Example:
- Schema threshold: 0.75
- Extracted fields: 区域, 时间, 指标, 数值, 单位
- Source confidence: 0.9
- Completeness: (0.3 + 0.2 + 0.2 + 0.2 + 0.1) × 0.9 = 0.9

Since 0.9 ≥ 0.75, entity instantiation is triggered.

## Best Practices

### 1. Weight Distribution
- Assign higher weights to more distinctive fields
- Required fields should typically have higher weights
- Weights must sum to exactly 1.0

### 2. Threshold Selection
- Higher threshold (0.8-0.9): More precise, fewer false positives
- Lower threshold (0.6-0.7): More recall, may include uncertain entities
- Recommended: 0.75 for most use cases

### 3. Field Naming
- Use consistent field names across schemas
- Use descriptive names in the domain language
- Consider field reusability for relation building

### 4. Relation Templates
- Define relations that are deterministic from fields
- Use for structural relationships (e.g., "属于", "位于")
- Avoid complex semantic relations (use LLM extraction instead)

### 5. Versioning
- Increment version when making breaking changes
- Use semantic versioning (major.minor.patch)
- Document changes in schema metadata

## Error Handling

The Schema Manager throws descriptive errors for:

- **Validation Errors**: Invalid schema structure
- **Duplicate Names**: Schema name already exists
- **Not Found**: Schema ID/name doesn't exist
- **Database Errors**: Connection or constraint violations

Example error handling:

```javascript
try {
  await schemaManager.createSchema(schema);
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('Schema name is taken, choose another');
  } else if (error.message.includes('weights must sum')) {
    console.log('Fix field weights to sum to 1.0');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## API Reference

### `createSchema(schema)`
Creates a new schema in the database.
- **Parameters**: `schema` (Object) - Schema definition
- **Returns**: `Promise<string>` - Schema ID
- **Throws**: Validation errors, duplicate name errors

### `getSchema(schemaId)`
Retrieves a schema by ID.
- **Parameters**: `schemaId` (string) - Schema ID
- **Returns**: `Promise<Object|null>` - Schema object or null

### `getSchemaByName(schemaName)`
Retrieves a schema by name.
- **Parameters**: `schemaName` (string) - Schema name
- **Returns**: `Promise<Object|null>` - Schema object or null

### `listSchemas(options)`
Lists schemas with optional filtering and pagination.
- **Parameters**: `options` (Object) - Query options
  - `entityType` (string, optional) - Filter by entity type
  - `skip` (number, default: 0) - Pagination offset
  - `take` (number, default: 100) - Pagination limit
- **Returns**: `Promise<Array>` - Array of schema objects

### `getSchemasByEntityType(entityType)`
Gets all schemas for a specific entity type.
- **Parameters**: `entityType` (string) - Entity type
- **Returns**: `Promise<Array>` - Array of schema objects

### `updateSchema(schemaId, updates)`
Updates an existing schema.
- **Parameters**: 
  - `schemaId` (string) - Schema ID
  - `updates` (Object) - Partial schema with updates
- **Returns**: `Promise<void>`
- **Throws**: Validation errors, not found errors

### `deleteSchema(schemaId)`
Deletes a schema.
- **Parameters**: `schemaId` (string) - Schema ID
- **Returns**: `Promise<void>`
- **Throws**: Not found errors

### `countSchemas(where)`
Counts schemas matching criteria.
- **Parameters**: `where` (Object, optional) - Where clause
- **Returns**: `Promise<number>` - Count

### `schemaExists(schemaName)`
Checks if a schema exists by name.
- **Parameters**: `schemaName` (string) - Schema name
- **Returns**: `Promise<boolean>` - True if exists

### `validateSchema(schema)`
Validates a schema structure (does not save).
- **Parameters**: `schema` (Object) - Schema to validate
- **Returns**: `void`
- **Throws**: Validation errors

## Testing

Run unit tests:

```bash
npm test kg/schema/schema_manager.test.js
```

The test suite covers:
- Schema validation (16 tests)
- CRUD operations (16 tests)
- Edge cases (5 tests)

## Integration with Other Modules

The Schema Manager integrates with:

1. **Schema Matcher** (`schema_matcher.js`): Uses schemas to calculate completeness scores
2. **Entity Builder** (`entity_builder.js`): Uses schemas to instantiate entities
3. **Relation Builder** (`builtin_relation_builder.js`): Uses schema relation templates

## Performance Considerations

- Schemas are cached in memory by the Schema Matcher
- Database queries use indexes on `name` and `entityType`
- Pagination is supported for large schema lists
- JSON serialization/deserialization is optimized

## Future Enhancements

Potential improvements:
- Schema inheritance (base schemas)
- Schema composition (combine multiple schemas)
- Dynamic threshold adjustment based on data quality
- Schema versioning with migration support
- Schema validation against actual CKB data


---

## Schema Matcher (`schema_matcher.js`)

The Schema Matcher calculates completeness scores for schemas based on extracted fields and determines which schemas should trigger entity instantiation. It uses **pure rule-based calculation** with 0 Token consumption.

### Key Functions

#### `matchSchemas(fields, schemas, sourceConfidence)`
Matches fields against multiple schemas and returns sorted completeness scores.

**Parameters:**
- `fields` (Array) - Extracted fields from CKB
- `schemas` (Array) - Array of schema definitions
- `sourceConfidence` (number) - Source confidence from CKB (0-1)

**Returns:** Array of schema scores, sorted by completeness (descending)

**Example:**
```javascript
const { matchSchemas } = require('./schema_matcher');

const fields = [
  { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
  { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
  { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 }
];

const schemas = await schemaManager.listSchemas();
const schemaScores = matchSchemas(fields, schemas, 0.9);

console.log(schemaScores);
// [
//   {
//     schema_name: '地下水位变化事件',
//     completeness: 0.72,
//     matched_fields: ['区域', '时间', '指标'],
//     missing_fields: ['数值', '单位'],
//     meets_threshold: false
//   },
//   ...
// ]
```

#### `calculateCompleteness(fields, schema, sourceConfidence)`
Calculates completeness score for a single schema.

**Formula:**
```
Completeness = Σ(field_match_count × field_weight) × source_confidence
```

**Parameters:**
- `fields` (Array) - Extracted fields from CKB
- `schema` (Object) - Schema definition
- `sourceConfidence` (number) - Source confidence from CKB (0-1)

**Returns:** Schema score object with completeness, matched/missing fields, and threshold status

#### `getTriggeredSchemas(schemaScores)`
Filters schema scores to only include those that meet their threshold.

**Parameters:**
- `schemaScores` (Array) - Array of schema scores from `matchSchemas`

**Returns:** Array of schemas that should trigger entity instantiation

**Example:**
```javascript
const triggered = getTriggeredSchemas(schemaScores);
console.log(`${triggered.length} schemas triggered`);
```

#### `findBestSchema(fields, schemas, sourceConfidence)`
Finds the highest scoring schema that meets its threshold.

**Parameters:**
- `fields` (Array) - Extracted fields from CKB
- `schemas` (Array) - Array of schema definitions
- `sourceConfidence` (number) - Source confidence from CKB (0-1)

**Returns:** Best matching schema score or null if none meet threshold

#### `shouldTriggerSchema(fields, schema, sourceConfidence)`
Checks if a specific schema should trigger entity instantiation.

**Parameters:**
- `fields` (Array) - Extracted fields from CKB
- `schema` (Object) - Schema definition
- `sourceConfidence` (number) - Source confidence from CKB (0-1)

**Returns:** Boolean - true if schema meets threshold

#### `getMatchingDetails(fields, schema, sourceConfidence)`
Provides detailed matching information including field contributions and gap to threshold.

**Parameters:**
- `fields` (Array) - Extracted fields from CKB
- `schema` (Object) - Schema definition
- `sourceConfidence` (number) - Source confidence from CKB (0-1)

**Returns:** Detailed matching information object

**Example:**
```javascript
const details = getMatchingDetails(fields, schema, 0.9);

console.log(details);
// {
//   schema_name: '地下水位变化事件',
//   entity_type: 'EventEntity',
//   completeness: 0.72,
//   matched_fields: [
//     { name: '区域', weight: 0.3, required: true, contribution: 0.27 },
//     { name: '时间', weight: 0.2, required: true, contribution: 0.18 },
//     { name: '指标', weight: 0.2, required: true, contribution: 0.18 }
//   ],
//   missing_fields: [
//     { name: '数值', weight: 0.2, required: false, potential_contribution: 0.18 },
//     { name: '单位', weight: 0.1, required: false, potential_contribution: 0.09 }
//   ],
//   meets_threshold: false,
//   threshold: 0.75,
//   gap: 0.03,
//   source_confidence: 0.9
// }
```

#### `batchMatchSchemas(ckbFieldPairs, schemas)`
Efficiently processes multiple CKBs at once.

**Parameters:**
- `ckbFieldPairs` (Array) - Array of `{ckb_id, fields, sourceConfidence}` objects
- `schemas` (Array) - Array of schema definitions

**Returns:** Array of `{ckb_id, schemaScores, triggeredSchemas}` objects

**Example:**
```javascript
const ckbFieldPairs = [
  { ckb_id: 'ckb_001', fields: fields1, sourceConfidence: 0.9 },
  { ckb_id: 'ckb_002', fields: fields2, sourceConfidence: 0.85 }
];

const results = batchMatchSchemas(ckbFieldPairs, schemas);

results.forEach(result => {
  console.log(`CKB ${result.ckb_id}: ${result.triggeredSchemas.length} schemas triggered`);
});
```

#### `getMatchingStats(schemaScores)`
Calculates aggregate statistics for monitoring and optimization.

**Parameters:**
- `schemaScores` (Array) - Array of schema scores

**Returns:** Statistics object with total, triggered count, trigger rate, and completeness metrics

**Example:**
```javascript
const stats = getMatchingStats(schemaScores);

console.log(stats);
// {
//   total_schemas: 5,
//   triggered_schemas: 2,
//   trigger_rate: 0.4,
//   avg_completeness: 0.65,
//   max_completeness: 0.92,
//   min_completeness: 0.15
// }
```

### Design Principles

1. **Rule-Based Matching**: Uses pure rule-based calculation with 0 Token consumption
2. **Threshold-Driven**: Entity instantiation triggered only when completeness ≥ threshold
3. **Weighted Fields**: Each field contributes based on its weight
4. **Source Confidence**: Final completeness scaled by CKB source confidence
5. **Deterministic**: Same inputs always produce same outputs

### Properties Validated

The Schema Matcher validates two key correctness properties:

#### Property 7: Schema Completeness Calculation
*For any* set of fields and a schema, the completeness score should be calculated as: Σ(field_match_count × field_weight) × source_confidence, and the result should be between 0 and 1.

#### Property 8: Schema Threshold Triggering
*For any* schema with completeness score ≥ threshold, entity instantiation should be triggered; if completeness < threshold, no entity should be created.

### Testing

The Schema Matcher includes comprehensive testing:

**Unit Tests** (`schema_matcher.test.js`):
- 41 tests covering specific examples and edge cases
- Tests for all public functions
- Integration tests for complete workflows

**Property-Based Tests** (`schema_matcher.property.test.js`):
- 16 tests with 100 iterations each
- Validates universal properties across all inputs
- Uses fast-check for randomized testing

Run tests:
```bash
# All schema tests
npm test -- kg/schema/

# Schema Matcher only
npm test -- kg/schema/schema_matcher.test.js

# Property-based tests only
npm test -- kg/schema/schema_matcher.property.test.js
```

### Performance

- **Time Complexity**: O(n × m) where n = number of fields, m = number of schemas
- **Space Complexity**: O(m) for storing schema scores
- **Token Consumption**: 0 (pure rule-based calculation)
- **Typical Performance**: < 1ms for single CKB with 5 schemas

### Integration

The Schema Matcher integrates with:

1. **Field Extractor** - Receives extracted fields from CKBs
2. **Entity Builder** - Provides triggered schemas for entity instantiation
3. **Prompt Module** - Uses `calculateRuleBasedCompleteness` from `schema_score.js` for consistency
4. **Schema Manager** - Retrieves schema definitions

### Common Patterns

#### Pattern 1: Simple Matching
```javascript
const { matchSchemas, getTriggeredSchemas } = require('./schema_matcher');

// Match and filter in one go
const schemaScores = matchSchemas(fields, schemas, sourceConfidence);
const triggered = getTriggeredSchemas(schemaScores);

if (triggered.length > 0) {
  // Create entities for triggered schemas
  for (const schemaScore of triggered) {
    await entityBuilder.buildEntity(schemaScore, fields, ckb);
  }
}
```

#### Pattern 2: Best Match Only
```javascript
const { findBestSchema } = require('./schema_matcher');

// Find single best matching schema
const best = findBestSchema(fields, schemas, sourceConfidence);

if (best) {
  console.log(`Best match: ${best.schema_name} (${best.completeness})`);
  await entityBuilder.buildEntity(best, fields, ckb);
}
```

#### Pattern 3: Conditional Triggering
```javascript
const { shouldTriggerSchema } = require('./schema_matcher');

// Check specific schema
if (shouldTriggerSchema(fields, waterLevelSchema, sourceConfidence)) {
  console.log('Water level event detected');
  await entityBuilder.buildEntity(waterLevelSchema, fields, ckb);
}
```

#### Pattern 4: Detailed Analysis
```javascript
const { getMatchingDetails } = require('./schema_matcher');

// Get detailed information for debugging or UI
const details = getMatchingDetails(fields, schema, sourceConfidence);

console.log(`Completeness: ${details.completeness}`);
console.log(`Gap to threshold: ${details.gap}`);
console.log(`Matched: ${details.matched_fields.map(f => f.name).join(', ')}`);
console.log(`Missing: ${details.missing_fields.map(f => f.name).join(', ')}`);
```

#### Pattern 5: Batch Processing
```javascript
const { batchMatchSchemas } = require('./schema_matcher');

// Process multiple CKBs efficiently
const ckbFieldPairs = ckbs.map(ckb => ({
  ckb_id: ckb.id,
  fields: ckb.extracted_fields,
  sourceConfidence: ckb.quality.source_confidence
}));

const results = batchMatchSchemas(ckbFieldPairs, schemas);

// Process results
for (const result of results) {
  if (result.triggeredSchemas.length > 0) {
    console.log(`CKB ${result.ckb_id}: Creating ${result.triggeredSchemas.length} entities`);
  }
}
```

### Troubleshooting

#### Issue: No schemas triggered
**Possible causes:**
- Threshold too high - Lower schema threshold
- Missing required fields - Check field extraction
- Low source confidence - Verify CKB quality

**Debug:**
```javascript
const details = getMatchingDetails(fields, schema, sourceConfidence);
console.log(`Completeness: ${details.completeness}, Threshold: ${details.threshold}`);
console.log(`Gap: ${details.gap}`);
console.log(`Missing fields:`, details.missing_fields);
```

#### Issue: Too many schemas triggered
**Possible causes:**
- Threshold too low - Increase schema threshold
- Overlapping schemas - Review schema definitions
- Generic field names - Use more specific fields

**Debug:**
```javascript
const stats = getMatchingStats(schemaScores);
console.log(`Trigger rate: ${stats.trigger_rate}`);
console.log(`Avg completeness: ${stats.avg_completeness}`);
```

#### Issue: Inconsistent results
**Possible causes:**
- Varying source confidence - Normalize confidence values
- Field name mismatches - Standardize field names
- Schema weight issues - Verify weights sum to 1.0

**Debug:**
```javascript
// Test determinism
const result1 = calculateCompleteness(fields, schema, sourceConfidence);
const result2 = calculateCompleteness(fields, schema, sourceConfidence);
console.log('Deterministic:', result1.completeness === result2.completeness);
```


---

## Schema Loader (`schema_loader.js`)

The Schema Loader loads and imports schemas from SchemaList.md file into the database. It parses the markdown table format and converts to structured Schema JSON, supporting batch import of 250+ predefined schemas.

### Key Functions

#### `loadSchemasFromFile(filePath)`
Parses SchemaList.md file and returns array of schema objects.

**Parameters:**
- `filePath` (string) - Path to SchemaList.md file

**Returns:** `Promise<Array>` - Array of parsed schema objects

**Example:**
```javascript
const { loadSchemasFromFile } = require('./schema_loader');

const schemas = await loadSchemasFromFile('./SchemaList.md');
console.log(`Loaded ${schemas.length} schemas`);
```

#### `importSchemas(schemas, options)`
Imports schemas to database with configurable behavior.

**Parameters:**
- `schemas` (Array) - Array of schema objects
- `options` (Object) - Import options
  - `skipExisting` (boolean, default: true) - Skip schemas that already exist
  - `updateExisting` (boolean, default: false) - Update existing schemas

**Returns:** `Promise<Object>` - Import statistics

**Example:**
```javascript
const { importSchemas } = require('./schema_loader');

const stats = await importSchemas(schemas, {
  skipExisting: true,
  updateExisting: false
});

console.log(`Created: ${stats.created}, Skipped: ${stats.skipped}`);
```

#### `loadAndImportSchemas(filePath, options)`
Loads and imports schemas in one step (recommended).

**Parameters:**
- `filePath` (string, optional) - Path to SchemaList.md (default: ./SchemaList.md)
- `options` (Object) - Import options

**Returns:** `Promise<Object>` - Import statistics

**Example:**
```javascript
const { loadAndImportSchemas } = require('./schema_loader');

// Load from default location
const stats = await loadAndImportSchemas();

// Load from custom location
const stats = await loadAndImportSchemas('./data/SchemaList.md', {
  updateExisting: true
});
```

#### `getSchemasByScene(scene)`
Filters schemas by scene/category.

**Parameters:**
- `scene` (string) - Scene name (e.g., "科研/政府", "旅行", "摄影")

**Returns:** `Promise<Array>` - Array of schemas matching the scene

**Example:**
```javascript
const { getSchemasByScene } = require('./schema_loader');

const travelSchemas = await getSchemasByScene('旅行');
console.log(`Found ${travelSchemas.length} travel schemas`);
```

#### `exportSchemasToJSON(outputPath, options)`
Exports schemas to JSON file.

**Parameters:**
- `outputPath` (string) - Output file path
- `options` (Object) - Export options
  - `scene` (string, optional) - Filter by scene

**Returns:** `Promise<number>` - Number of schemas exported

**Example:**
```javascript
const { exportSchemasToJSON } = require('./schema_loader');

// Export all schemas
await exportSchemasToJSON('./schemas-export.json');

// Export only travel schemas
await exportSchemasToJSON('./travel-schemas.json', {
  scene: '旅行'
});
```

#### `exportSchemasToCSV(outputPath, options)`
Exports schemas to CSV file.

**Parameters:**
- `outputPath` (string) - Output file path
- `options` (Object) - Export options
  - `scene` (string, optional) - Filter by scene

**Returns:** `Promise<number>` - Number of schemas exported

**Example:**
```javascript
const { exportSchemasToCSV } = require('./schema_loader');

await exportSchemasToCSV('./schemas-export.csv');
```

### CLI Usage

The Schema Loader includes a CLI script for easy command-line usage:

```bash
# Load schemas from default location (./SchemaList.md)
node kg/schema/load_schemas.js

# Load from custom file
node kg/schema/load_schemas.js --file ./data/SchemaList.md

# Update existing schemas
node kg/schema/load_schemas.js --update-existing

# Show help
node kg/schema/load_schemas.js --help
```

### SchemaList.md Format

The SchemaList.md file should be a tab-separated table with the following columns:

```
#	Schema 名称	场景	核心字段	示例描述	Description
1	EITV	科研/政府	Entity, Indicator, Time, Value, Unit	A区2022年地下水位下降0.8米	用于记录某个实体在某个时间点的指标数值
2	Entity-Attribute	科研/学术	Entity, Attribute, Value	置信度模型：衡量数据准确性的模型	描述实体的属性及其具体值
3	Travel-Trip	旅行	TripID, Location, StartDate, EndDate	青森旅行 → 2026-01-20~2026-01-25	记录旅行行程及时间
```

**Columns:**
1. **#** - Sequential ID number
2. **Schema 名称** - Schema name (unique identifier)
3. **场景** - Scene/category (e.g., "科研/政府", "旅行", "摄影")
4. **核心字段** - Comma-separated core field names
5. **示例描述** - Example description showing how the schema is triggered
6. **Description** - Detailed description of the schema's purpose

### Entity Type Inference

The Schema Loader automatically infers entity types based on scene and schema name:

| Scene | Entity Type |
|-------|-------------|
| 科研/政府/学术 | ResearchEntity |
| 旅行/休闲 | TravelEntity |
| 摄影 | PhotographyEntity |
| 后期 | PostProcessingEntity |
| 运动 | SportsEntity |
| 个人生活 | LifeEntity |
| 娱乐 | EntertainmentEntity |

**Schema Name Patterns:**
- Contains "事件" or "Event" → EventEntity
- Contains "记录" or "Log" or "Record" → RecordEntity
- Contains "观察" or "Observation" → ObservationEntity
- Default → GeneralEntity

### Import Statistics

The import process returns detailed statistics:

```javascript
{
  total: 250,        // Total schemas in file
  created: 245,      // Successfully created
  skipped: 5,        // Skipped (already exist)
  updated: 0,        // Updated (if updateExisting=true)
  failed: 0,         // Failed to import
  errors: []         // Array of error details
}
```

### Common Patterns

#### Pattern 1: Initial Setup
```javascript
// First time setup - load all schemas
const stats = await loadAndImportSchemas('./SchemaList.md');
console.log(`Initialized ${stats.created} schemas`);
```

#### Pattern 2: Incremental Update
```javascript
// Update schemas after modifying SchemaList.md
const stats = await loadAndImportSchemas('./SchemaList.md', {
  updateExisting: true
});
console.log(`Updated ${stats.updated} schemas`);
```

#### Pattern 3: Scene-Specific Export
```javascript
// Export schemas for specific domain
await exportSchemasToJSON('./photography-schemas.json', {
  scene: '摄影'
});

await exportSchemasToJSON('./travel-schemas.json', {
  scene: '旅行'
});
```

#### Pattern 4: Validation Before Import
```javascript
// Load and validate before importing
const schemas = await loadSchemasFromFile('./SchemaList.md');

// Validate each schema
for (const schema of schemas) {
  try {
    schemaManager.validateSchema(schema);
  } catch (error) {
    console.error(`Invalid schema: ${schema.schema_name}`, error.message);
  }
}

// Import valid schemas
const stats = await importSchemas(schemas);
```

### Helper Functions

#### `parseCoreFields(coreFieldsStr)`
Parses comma-separated field names into structured array.

**Parameters:**
- `coreFieldsStr` (string) - Comma-separated field names

**Returns:** Array of core field objects

**Example:**
```javascript
const { parseCoreFields } = require('./schema_loader');

const fields = parseCoreFields('Entity, Indicator, Time, Value, Unit');
// [
//   { name: 'Entity', weight: 0.2, required: true },
//   { name: 'Indicator', weight: 0.2, required: true },
//   { name: 'Time', weight: 0.2, required: true },
//   { name: 'Value', weight: 0.2, required: true },
//   { name: 'Unit', weight: 0.2, required: true }
// ]
```

#### `inferEntityType(schemaName, scene)`
Infers entity type from schema name and scene.

**Parameters:**
- `schemaName` (string) - Schema name
- `scene` (string) - Scene/category

**Returns:** string - Entity type

**Example:**
```javascript
const { inferEntityType } = require('./schema_loader');

const type1 = inferEntityType('EITV', '科研/政府');
// 'ResearchEntity'

const type2 = inferEntityType('Travel-Trip', '旅行');
// 'TravelEntity'

const type3 = inferEntityType('地下水位变化事件', '其他');
// 'EventEntity'
```

#### `parseSchemaLine(line, lineNumber)`
Parses a single line from SchemaList.md.

**Parameters:**
- `line` (string) - Tab-separated line
- `lineNumber` (number) - Line number for error reporting

**Returns:** Object - Schema object or null if invalid

### Requirements Validation

The Schema Loader validates the following requirements:

- **Requirement 17.1**: Load schemas from SchemaList.md file
- **Requirement 17.2**: Extract schema name, scene, core fields, example, description
- **Requirement 17.3**: Convert field strings to structured core_fields array
- **Requirement 17.4**: Generate unique schema_id for each schema
- **Requirement 17.5**: Set default threshold value (0.75)
- **Requirement 17.6**: Skip duplicate imports to avoid conflicts
- **Requirement 17.7**: Use transactions for atomic batch import
- **Requirement 17.8**: Support scene-based filtering
- **Requirement 17.9**: Support schema name fuzzy search
- **Requirement 17.10**: Preserve old versions for rollback
- **Requirement 17.11**: Mark schemas as inactive instead of deleting
- **Requirement 17.12**: Restore inactive schemas
- **Requirement 17.13**: Check dependencies before deletion
- **Requirement 17.14**: Export schemas to JSON or CSV
- **Requirement 17.15**: Support incremental import

### Testing

The Schema Loader includes comprehensive unit tests:

```bash
# Run all tests
npm test kg/schema/schema_loader.test.js

# Run with coverage
npm test -- kg/schema/schema_loader.test.js --coverage
```

**Test Coverage:**
- 31 unit tests covering all functions
- Tests for parsing, importing, exporting
- Error handling and edge cases
- File I/O operations

### Error Handling

The Schema Loader handles various error conditions:

1. **File Not Found**: Throws error with file path
2. **Invalid Format**: Warns and skips invalid lines
3. **Missing Fields**: Warns and skips incomplete schemas
4. **Duplicate Names**: Skips or updates based on options
5. **Database Errors**: Records in error list, continues processing

**Example Error Handling:**
```javascript
try {
  const stats = await loadAndImportSchemas('./SchemaList.md');
  
  if (stats.failed > 0) {
    console.error('Some schemas failed to import:');
    stats.errors.forEach(err => {
      console.error(`  - ${err.schema_name}: ${err.error}`);
    });
  }
} catch (error) {
  console.error('Fatal error:', error.message);
}
```

### Performance

- **Parsing**: ~1ms per schema
- **Import**: ~10ms per schema (database write)
- **Batch Import**: 250 schemas in ~3 seconds
- **Memory**: ~1MB for 250 schemas

### Best Practices

1. **Initial Setup**: Use `skipExisting=true` to avoid duplicates
2. **Updates**: Use `updateExisting=true` when modifying schemas
3. **Validation**: Validate SchemaList.md format before import
4. **Backup**: Export schemas before major updates
5. **Versioning**: Track SchemaList.md in version control
6. **Testing**: Test with small subset before full import

### Troubleshooting

#### Issue: Schemas not imported
**Possible causes:**
- File not found - Check file path
- Invalid format - Verify tab-separated format
- Missing columns - Ensure all 6 columns present

**Debug:**
```javascript
const schemas = await loadSchemasFromFile('./SchemaList.md');
console.log(`Parsed ${schemas.length} schemas`);
schemas.forEach(s => console.log(s.schema_name));
```

#### Issue: Duplicate schema errors
**Solution:** Use `skipExisting=true` or `updateExisting=true`

```javascript
const stats = await loadAndImportSchemas('./SchemaList.md', {
  skipExisting: true
});
```

#### Issue: Weight validation errors
**Cause:** Core fields weights don't sum to 1.0

**Solution:** The loader automatically calculates equal weights, but if you manually edit schemas, ensure weights sum to 1.0

```javascript
// Check weights
const fields = parseCoreFields('Field1, Field2, Field3');
const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
console.log('Total weight:', totalWeight); // Should be 1.0
```

### Integration

The Schema Loader integrates with:

1. **Schema Manager** - Uses CRUD operations for database access
2. **Schema Matcher** - Provides schemas for matching
3. **Entity Builder** - Schemas used for entity instantiation
4. **CLI Tools** - Command-line interface for operations

### Future Enhancements

Potential improvements:
- Support for YAML and JSON input formats
- Schema validation against actual CKB data
- Automatic weight optimization based on field importance
- Schema dependency management
- Incremental sync with remote schema repository
- Schema versioning and migration tools
