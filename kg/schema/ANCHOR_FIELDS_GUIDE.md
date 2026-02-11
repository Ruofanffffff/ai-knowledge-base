# Anchor Fields Configuration Guide

## Overview

This guide explains how to configure `anchor_fields` and `anchor_config` for schemas in the anchor-driven entity synthesis system. Anchor fields determine how schema instances are merged into entities based on semantic identity.

## Core Concepts

### What are Anchor Fields?

**Anchor fields** are the fields used to generate a unique fingerprint for entity identity. When multiple schema instances have the same anchor fingerprint, they are merged into a single entity.

**Key Principle**: The knowledge graph is not a "collection of schemas" but rather "schemas continuously overlapping on the same semantic anchors."

### Anchor Fingerprint

An anchor fingerprint is a normalized, deterministic string that uniquely identifies an entity:

```
EntityType|normalized_value1|normalized_value2|...
```

Example:
```
EventEntity|ali_c_zone|groundwater_level|2025-01
```

## Configuration Structure

### Schema with Anchor Configuration

```javascript
{
  schema_name: "地下水位变化事件",
  entity_type: "EventEntity",
  core_fields: [
    { name: "区域", weight: 0.3, required: true },
    { name: "时间", weight: 0.2, required: true },
    { name: "指标", weight: 0.2, required: true },
    { name: "数值", weight: 0.2, required: false },
    { name: "单位", weight: 0.1, required: false }
  ],
  threshold: 0.75,
  
  // 🆕 Anchor Fields Configuration
  anchor_fields: [
    { 
      name: "区域", 
      normalization_strategy: "location", 
      priority: 1 
    },
    { 
      name: "指标", 
      normalization_strategy: "indicator", 
      priority: 2 
    },
    { 
      name: "时间", 
      normalization_strategy: "time_month", 
      priority: 3 
    }
  ],
  
  // 🆕 Anchor Configuration
  anchor_config: {
    time_granularity: "month",
    allow_fuzzy_match: false,
    conflict_strategy: "llm_advisory"
  }
}
```

## Anchor Fields Configuration

### Field Structure

Each anchor field has the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Field name (must exist in core_fields) |
| `normalization_strategy` | string | Yes | How to normalize the field value |
| `priority` | number | No | Priority order (lower = higher priority) |

### Normalization Strategies

#### 1. `time_month` - Month-level Time Normalization

Normalizes dates to year-month format.

**Input Examples**:
- `"2025-01-15"` → `"2025-01"`
- `"2025年1月"` → `"2025-01"`
- `"January 2025"` → `"2025-01"`

**Use Cases**:
- Monthly reports
- Monthly statistics
- Events that occur within a month

**Example**:
```javascript
anchor_fields: [
  { name: "时间", normalization_strategy: "time_month" }
]
```

#### 2. `time_year` - Year-level Time Normalization

Normalizes dates to year format.

**Input Examples**:
- `"2025-01-15"` → `"2025"`
- `"2025年"` → `"2025"`

**Use Cases**:
- Annual reports
- Yearly statistics
- Long-term trends

**Example**:
```javascript
anchor_fields: [
  { name: "年份", normalization_strategy: "time_year" }
]
```

#### 3. `time_day` - Day-level Time Normalization

Normalizes dates to year-month-day format.

**Input Examples**:
- `"2025-01-15"` → `"2025-01-15"`
- `"2025年1月15日"` → `"2025-01-15"`

**Use Cases**:
- Daily events
- Precise timestamps
- Travel logs

**Example**:
```javascript
anchor_fields: [
  { name: "日期", normalization_strategy: "time_day" }
]
```

#### 4. `location` - Location Normalization

Normalizes location names to a standard format.

**Input Examples**:
- `"阿里C区"` → `"ali_c_zone"`
- `"青森美术馆"` → `"aomori_museum"`
- `"Central Park"` → `"central_park"`

**Use Cases**:
- Geographic locations
- Venues
- Regions

**Example**:
```javascript
anchor_fields: [
  { name: "区域", normalization_strategy: "location" }
]
```

#### 5. `indicator` - Indicator/Metric Normalization

Normalizes indicator or metric names.

**Input Examples**:
- `"地下水位"` → `"groundwater_level"`
- `"温度"` → `"temperature"`
- `"降雨量"` → `"rainfall"`

**Use Cases**:
- Measurement indicators
- Performance metrics
- Statistical measures

**Example**:
```javascript
anchor_fields: [
  { name: "指标", normalization_strategy: "indicator" }
]
```

#### 6. `lowercase` - Simple Lowercase Normalization

Converts text to lowercase and trims whitespace.

**Input Examples**:
- `"Camera Model"` → `"camera model"`
- `"  Sony A7M4  "` → `"sony a7m4"`

**Use Cases**:
- Product names
- Simple identifiers
- Case-insensitive matching

**Example**:
```javascript
anchor_fields: [
  { name: "相机", normalization_strategy: "lowercase" }
]
```

#### 7. `default` - Default Normalization

Only trims whitespace, preserves original case.

**Input Examples**:
- `"  Project Name  "` → `"Project Name"`

**Use Cases**:
- When exact matching is needed
- Proper nouns
- Case-sensitive identifiers

**Example**:
```javascript
anchor_fields: [
  { name: "项目名称", normalization_strategy: "default" }
]
```

## Anchor Config Options

### `time_granularity`

Specifies the time granularity for time-based anchors.

**Valid Values**: `"day"`, `"month"`, `"year"`

**Example**:
```javascript
anchor_config: {
  time_granularity: "month"
}
```

### `allow_fuzzy_match`

Whether to allow fuzzy matching for anchor fields.

**Type**: boolean  
**Default**: `false`

**Example**:
```javascript
anchor_config: {
  allow_fuzzy_match: false
}
```

### `conflict_strategy`

Strategy for handling conflicts when merging instances.

**Valid Values**:
- `"auto"` - Automatically merge, use highest confidence value
- `"llm_advisory"` - Use LLM to provide merge suggestions
- `"manual"` - Require manual review

**Example**:
```javascript
anchor_config: {
  conflict_strategy: "llm_advisory"
}
```

## Entity Type Examples

### EventEntity (事件实体)

Events typically need location, time, and indicator anchors.

```javascript
{
  entity_type: "EventEntity",
  anchor_fields: [
    { name: "区域", normalization_strategy: "location", priority: 1 },
    { name: "指标", normalization_strategy: "indicator", priority: 2 },
    { name: "时间", normalization_strategy: "time_month", priority: 3 }
  ],
  anchor_config: {
    time_granularity: "month",
    conflict_strategy: "llm_advisory"
  }
}
```

**Anchor Example**: `EventEntity|ali_c_zone|groundwater_level|2025-01`

### LocationEntity (地点实体)

Locations typically only need the location name as anchor.

```javascript
{
  entity_type: "LocationEntity",
  anchor_fields: [
    { name: "区域名称", normalization_strategy: "location", priority: 1 }
  ],
  anchor_config: {
    allow_fuzzy_match: false,
    conflict_strategy: "auto"
  }
}
```

**Anchor Example**: `LocationEntity|ali_c_zone`

### TravelEntity (旅行实体)

Travel entities need location and precise time.

```javascript
{
  entity_type: "TravelEntity",
  anchor_fields: [
    { name: "Location", normalization_strategy: "location", priority: 1 },
    { name: "Timestamp", normalization_strategy: "time_day", priority: 2 }
  ],
  anchor_config: {
    time_granularity: "day",
    conflict_strategy: "auto"
  }
}
```

**Anchor Example**: `TravelEntity|aomori_museum|2026-01-20`

### PhotographyEntity (摄影实体)

Photography entities need equipment and time.

```javascript
{
  entity_type: "PhotographyEntity",
  anchor_fields: [
    { name: "Camera", normalization_strategy: "lowercase", priority: 1 },
    { name: "Lens", normalization_strategy: "lowercase", priority: 2 },
    { name: "Timestamp", normalization_strategy: "time_day", priority: 3 }
  ],
  anchor_config: {
    time_granularity: "day",
    conflict_strategy: "auto"
  }
}
```

**Anchor Example**: `PhotographyEntity|a7m4|35mm_f1.8|2026-01-20`

### ProjectEntity (项目实体)

Projects need name and start time.

```javascript
{
  entity_type: "ProjectEntity",
  anchor_fields: [
    { name: "项目名称", normalization_strategy: "lowercase", priority: 1 },
    { name: "开始时间", normalization_strategy: "time_month", priority: 2 }
  ],
  anchor_config: {
    time_granularity: "month",
    conflict_strategy: "llm_advisory"
  }
}
```

**Anchor Example**: `ProjectEntity|water_monitoring_project|2025-01`

## Best Practices

### 1. Choose Appropriate Anchor Fields

**Good**: Fields that uniquely identify the entity
```javascript
anchor_fields: [
  { name: "区域", normalization_strategy: "location" },
  { name: "时间", normalization_strategy: "time_month" }
]
```

**Bad**: Too many fields (over-specification)
```javascript
anchor_fields: [
  { name: "区域", normalization_strategy: "location" },
  { name: "时间", normalization_strategy: "time_month" },
  { name: "数值", normalization_strategy: "default" },  // ❌ Values change
  { name: "单位", normalization_strategy: "default" }   // ❌ Too specific
]
```

### 2. Use Appropriate Time Granularity

- **Day**: For precise events (travel, photos)
- **Month**: For periodic reports, statistics
- **Year**: For annual summaries, long-term trends

### 3. Set Priorities Correctly

Lower priority number = higher importance:

```javascript
anchor_fields: [
  { name: "区域", priority: 1 },      // Most important
  { name: "指标", priority: 2 },      // Second
  { name: "时间", priority: 3 }       // Third
]
```

### 4. Choose Conflict Strategy Wisely

- **auto**: For simple, low-risk merges
- **llm_advisory**: For complex cases needing judgment
- **manual**: For critical data requiring human review

## Validation

Use the schema validator to check your configuration:

```javascript
const { validateSchema } = require('./schema_validator');

const schema = {
  schema_name: "My Schema",
  entity_type: "EventEntity",
  core_fields: [...],
  anchor_fields: [...],
  anchor_config: {...}
};

const result = validateSchema(schema);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Common Mistakes

### ❌ Mistake 1: Anchor field not in core_fields

```javascript
core_fields: [
  { name: "区域", weight: 0.5, required: true }
],
anchor_fields: [
  { name: "地点", normalization_strategy: "location" }  // ❌ Not in core_fields
]
```

**Fix**: Use the same field name:
```javascript
anchor_fields: [
  { name: "区域", normalization_strategy: "location" }  // ✅ Matches core_fields
]
```

### ❌ Mistake 2: Wrong normalization strategy

```javascript
anchor_fields: [
  { name: "时间", normalization_strategy: "location" }  // ❌ Wrong strategy
]
```

**Fix**: Use appropriate strategy:
```javascript
anchor_fields: [
  { name: "时间", normalization_strategy: "time_month" }  // ✅ Correct
]
```

### ❌ Mistake 3: Empty anchor_fields

```javascript
anchor_fields: []  // ❌ At least one field required
```

**Fix**: Add at least one anchor field:
```javascript
anchor_fields: [
  { name: "区域", normalization_strategy: "location" }  // ✅
]
```

## Testing Your Configuration

After configuring anchor fields, test with sample data:

```javascript
const { generateAnchorFingerprint } = require('../entity/anchor_generator');

const instance = {
  schema_name: "地下水位变化事件",
  entity_type: "EventEntity",
  fields: {
    区域: "阿里C区",
    时间: "2025-01-15",
    指标: "地下水位"
  }
};

const schema = {
  anchor_fields: [
    { name: "区域", normalization_strategy: "location" },
    { name: "指标", normalization_strategy: "indicator" },
    { name: "时间", normalization_strategy: "time_month" }
  ]
};

const fingerprint = generateAnchorFingerprint(instance, schema);
console.log(fingerprint);
// Expected: "EventEntity|ali_c_zone|groundwater_level|2025-01"
```

## Migration Guide

If you have existing schemas without anchor configuration:

1. **Analyze your entity type** - What makes it unique?
2. **Choose anchor fields** - Select 1-3 fields that identify the entity
3. **Select normalization strategies** - Match field types to strategies
4. **Set time granularity** - Choose appropriate time precision
5. **Choose conflict strategy** - Based on data criticality
6. **Validate** - Use schema validator
7. **Test** - Generate sample fingerprints

## References

- [Anchor Generator Implementation](../entity/anchor_generator.js)
- [Schema Validator](./schema_validator.js)
- [Design Document](../../.kiro/specs/anchor-driven-entity-synthesis/design.md)
- [Example Schemas](./example_schemas.js)
