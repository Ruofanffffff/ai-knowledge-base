# Migration: Add Evidence Fields

## Overview

This migration adds the `evidence` field to both `KGEntity` and `KGRelation` tables to support the CKB Intelligent Chunking feature's evidence localization system.

## Changes

### KGEntity Table
- **Added Field**: `evidence` (TEXT, nullable)
- **Purpose**: Store evidence location information for entities
- **Format**: JSON string

### KGRelation Table
- **Added Field**: `evidence` (TEXT, nullable)
- **Purpose**: Store evidence location information for relations
- **Format**: JSON string

## Evidence Data Structure

### Entity Evidence
```json
{
  "type": "entity",
  "entityId": "entity_123",
  "entityName": "阿里C区_水位_2025-01",
  "locations": [
    {
      "ckbId": "ckb_456",
      "chunkId": "chunk_2",
      "start": 45,
      "end": 58,
      "matchedText": "阿里C区水位"
    }
  ],
  "confidence": 0.85
}
```

### Relation Evidence
```json
{
  "type": "relation",
  "relationId": "rel_789",
  "relationType": "affects",
  "sourceEntity": "阿里C区_水位_2025-01",
  "targetEntity": "地下水位",
  "locations": [
    {
      "ckbId": "ckb_456",
      "chunkId": "chunk_3",
      "start": 120,
      "end": 180,
      "matchedText": "阿里C区水位影响地下水位",
      "sourcePos": 120,
      "targetPos": 135,
      "distance": 15
    }
  ],
  "confidence": 0.90
}
```

## Running the Migration

### Apply Migration (Up)
```bash
node prisma/migrations/add_evidence_fields.js up
```

### Rollback Migration (Down)
```bash
node prisma/migrations/add_evidence_fields.js down
```

**Note**: SQLite does not support `DROP COLUMN`, so rollback requires manual table recreation or using `npx prisma migrate reset` (which will delete all data).

## Alternative: Using Prisma Migrate

If you prefer to use Prisma's built-in migration system:

```bash
# Generate migration
npx prisma migrate dev --name add_evidence_fields

# Apply migration to production
npx prisma migrate deploy
```

## Testing the Migration

After running the migration, verify the changes:

```bash
# Check the schema
npx prisma db pull

# Inspect the database
sqlite3 prisma/knowledge-base.db ".schema kg_entities"
sqlite3 prisma/knowledge-base.db ".schema kg_relations"
```

## Backward Compatibility

- The `evidence` field is **nullable**, so existing entities and relations will have `NULL` values
- The system gracefully handles missing evidence data
- No data migration is required for existing records
- Evidence will be populated for new entities/relations created after this migration

## Related Files

- `prisma/schema.prisma` - Updated schema definition
- `kg/ckb/evidence_locator.js` - Evidence locator implementation
- `kg/entity/entity_builder.js` - Entity builder with evidence integration
- `kg/relation/semantic_relation_builder.js` - Relation builder with evidence integration
- `routes/knowledgeGraphRoutes.js` - API endpoints for evidence retrieval

## Requirements

This migration implements:
- **Requirement 3.5**: Evidence information storage in database
- **Design Section**: Enhanced Entity/Relation Evidence Model

## Next Steps

After applying this migration:
1. Run tests to verify database schema changes
2. Test evidence storage and retrieval
3. Verify API endpoints work correctly
4. Update Entity Builder to store evidence
5. Update Relation Builder to store evidence
