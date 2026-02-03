# Schema Data Model Documentation

## Overview

The Schema model has been updated to support enhanced functionality for the Schema-Driven Knowledge Graph system. This document describes the new fields and their usage.

## Schema Model Structure

### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | String | Yes | UUID | Unique identifier |
| `name` | String | Yes | - | Unique schema name (e.g., "EITV", "Travel-Photo") |
| `entityType` | String | Yes | - | Entity type this schema generates (e.g., "EventEntity", "TravelEntity") |
| `scene` | String | No | null | **NEW** Scene/category classification (e.g., "科研/政府", "旅行/休闲", "摄影") |
| `coreFields` | String | Yes | - | JSON string of core field definitions |
| `threshold` | Float | Yes | - | Completeness threshold for entity instantiation (0-1) |
| `relations` | String | No | null | JSON string of relation templates |
| `exampleDescription` | String | No | null | **NEW** Example description showing how to trigger this schema |
| `description` | String | No | null | **NEW** Detailed description of the schema's purpose and usage |
| `version` | String | Yes | - | Schema version (e.g., "1.0") |
| `active` | Boolean | Yes | true | **NEW** Whether the schema is active and should participate in matching |
| `createdAt` | DateTime | Yes | now() | Creation timestamp |
| `updatedAt` | DateTime | Yes | now() | Last update timestamp |

### Indexes

- `name` - Unique index for fast lookup by schema name
- `entityType` - Index for filtering by entity type
- `scene` - **NEW** Index for filtering by scene/category
- `active` - **NEW** Index for filtering active/inactive schemas

## New Fields Details

### 1. `scene` (场景分类)

**Purpose**: Categorize schemas by domain or use case for easier management and filtering.

**Examples**:
- `"科研/政府"` - Research and government domains
- `"旅行/休闲"` - Travel and leisure
- `"摄影"` - Photography
- `"后期"` - Post-processing
- `"运动"` - Sports
- `"个人生活"` - Personal life
- `"娱乐"` - Entertainment

**Usage**:
```javascript
// Query schemas by scene
const researchSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '科研' },
    active: true
  }
});

// Query schemas for travel domain
const travelSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '旅行' }
  }
});
```

**Requirements**: Validates Requirement 17.1, 3.1, 3.12

### 2. `exampleDescription` (示例描述)

**Purpose**: Provide concrete examples of text that would trigger this schema, helping users understand when the schema applies.

**Examples**:
- EITV Schema: `"A区2022年地下水位下降0.8米"`
- Travel-Photo Schema: `"青森美术馆 → 2026-01-20 → 赏雪场景"`
- Shooting-Info Schema: `"A7M4 + 35mm f1.8, ISO800"`

**Usage**:
```javascript
// Create schema with example
const schema = await prisma.schema.create({
  data: {
    name: 'EITV',
    entityType: 'EventEntity',
    scene: '科研/政府',
    exampleDescription: 'A区2022年地下水位下降0.8米',
    // ... other fields
  }
});

// Display example in UI
console.log(`Example: ${schema.exampleDescription}`);
```

**Requirements**: Validates Requirement 17.2

### 3. `description` (详细描述)

**Purpose**: Provide detailed explanation of the schema's purpose, use cases, and how it contributes to knowledge graph construction.

**Examples**:
- EITV Schema: `"用于记录某个实体在某个时间点的指标数值，便于统计、趋势分析和图谱构建"`
- Travel-Photo Schema: `"记录旅行照片及拍摄信息"`
- Shooting-Info Schema: `"记录一次拍摄的基础参数信息"`

**Usage**:
```javascript
// Create schema with description
const schema = await prisma.schema.create({
  data: {
    name: 'EITV',
    entityType: 'EventEntity',
    description: '用于记录某个实体在某个时间点的指标数值，便于统计、趋势分析和图谱构建',
    // ... other fields
  }
});

// Display in schema management UI
console.log(`Description: ${schema.description}`);
```

**Requirements**: Validates Requirement 17.2

### 4. `active` (启用状态)

**Purpose**: Control whether a schema participates in matching without deleting it, preserving historical data while preventing new matches.

**Default**: `true` (schemas are active by default)

**Usage**:
```javascript
// Disable a schema (Requirement 17.11)
await prisma.schema.update({
  where: { id: schemaId },
  data: { active: false }
});

// Enable a schema (Requirement 17.12)
await prisma.schema.update({
  where: { id: schemaId },
  data: { active: true }
});

// Query only active schemas
const activeSchemas = await prisma.schema.findMany({
  where: { active: true }
});

// Query inactive schemas
const inactiveSchemas = await prisma.schema.findMany({
  where: { active: false }
});

// Filter by scene and active status
const activeResearchSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '科研' },
    active: true
  }
});
```

**Benefits**:
- Preserve historical data when disabling schemas
- Prevent new entity generation from disabled schemas
- Allow temporary schema deactivation for testing
- Support gradual schema rollout (enable/disable as needed)

**Requirements**: Validates Requirement 17.11, 17.12

## Migration

The schema changes have been applied via Prisma migration:

```bash
# Migration file
prisma/migrations/20260130060826_add_schema_fields/migration.sql
```

### Migration Details

The migration adds:
1. Four new columns to the `schemas` table:
   - `scene` (TEXT, nullable)
   - `example_description` (TEXT, nullable)
   - `description` (TEXT, nullable)
   - `active` (BOOLEAN, default true)

2. Two new indexes:
   - `schemas_scene_idx` on `scene` column
   - `schemas_active_idx` on `active` column

### Applying the Migration

```bash
# Apply migration
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

## Backward Compatibility

The new fields are **optional** (nullable) except for `active` which has a default value of `true`. This ensures:

1. **Existing schemas continue to work**: Schemas created before this update will have:
   - `scene = null`
   - `exampleDescription = null`
   - `description = null`
   - `active = true` (default)

2. **No breaking changes**: All existing code continues to function without modification.

3. **Gradual adoption**: New fields can be populated incrementally as schemas are updated.

## Testing

Comprehensive unit tests have been added in `kg/schema/schema_model.test.js`:

- ✅ Schema creation with all new fields
- ✅ Schema creation without optional fields
- ✅ Default value for `active` field
- ✅ Querying by scene
- ✅ Querying by active status
- ✅ Combined queries (scene + active)
- ✅ Updating individual fields
- ✅ Toggling active status
- ✅ Index performance
- ✅ Unique constraints
- ✅ Required field validation

Run tests:
```bash
npm test -- kg/schema/schema_model.test.js
```

## API Integration

The new fields should be integrated into Schema API endpoints:

### GET /api/knowledge-graph/schemas

Support filtering by scene and active status:
```javascript
// Query parameters
?scene=科研/政府&active=true
```

### POST /api/knowledge-graph/schemas

Accept new fields in request body:
```json
{
  "name": "EITV",
  "entityType": "EventEntity",
  "scene": "科研/政府",
  "coreFields": [...],
  "threshold": 0.75,
  "exampleDescription": "A区2022年地下水位下降0.8米",
  "description": "用于记录某个实体在某个时间点的指标数值",
  "version": "1.0",
  "active": true
}
```

### PUT /api/knowledge-graph/schemas/:id/enable

Enable a schema:
```javascript
await prisma.schema.update({
  where: { id },
  data: { active: true }
});
```

### PUT /api/knowledge-graph/schemas/:id/disable

Disable a schema:
```javascript
await prisma.schema.update({
  where: { id },
  data: { active: false }
});
```

## Schema Loader Integration

The Schema Loader (`kg/schema/schema_loader.js`) should be updated to:

1. Parse `scene` from SchemaList.md
2. Parse `exampleDescription` from SchemaList.md
3. Parse `description` from SchemaList.md
4. Set `active = true` by default for imported schemas

Example:
```javascript
const schema = {
  schema_id: `schema_${id}`,
  schema_name: schemaName,
  entity_type: inferEntityType(schemaName, scene),
  scene: scene,  // NEW
  core_fields: coreFields,
  threshold: 0.75,
  relations: [],
  example_description: exampleDesc,  // NEW
  description: description,  // NEW
  version: '1.0',
  active: true  // NEW
};
```

## Schema Matcher Integration

The Schema Matcher should respect the `active` field:

```javascript
// Only match against active schemas
const activeSchemas = await prisma.schema.findMany({
  where: { active: true }
});

// Perform matching only on active schemas
const matches = matchSchemas(fields, activeSchemas);
```

## Requirements Validation

This implementation validates the following requirements:

- ✅ **Requirement 17.1**: Schema definition includes scene field
- ✅ **Requirement 3.1**: Schema definition includes scene, core_fields, threshold, relations
- ✅ **Requirement 17.2**: Schema includes example_description and description
- ✅ **Requirement 17.11**: Support disabling schemas (active = false)
- ✅ **Requirement 17.12**: Support enabling schemas (active = true)
- ✅ **Requirement 3.12**: Support querying schemas by scene

## Next Steps

1. ✅ Update Prisma schema
2. ✅ Create and apply migration
3. ✅ Write unit tests
4. ⏳ Update Schema Loader to populate new fields
5. ⏳ Update Schema Matcher to respect `active` field
6. ⏳ Update Schema API endpoints
7. ⏳ Update Schema management UI to display new fields
8. ⏳ Import SchemaList.md with new fields

## References

- Requirements Document: `.kiro/specs/schema-driven-knowledge-graph/requirements.md`
- Design Document: `.kiro/specs/schema-driven-knowledge-graph/design.md`
- Tasks: `.kiro/specs/schema-driven-knowledge-graph/tasks.md`
- Prisma Schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/20260130060826_add_schema_fields/migration.sql`
- Unit Tests: `kg/schema/schema_model.test.js`
