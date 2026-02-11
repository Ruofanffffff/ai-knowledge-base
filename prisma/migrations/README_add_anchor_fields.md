# Anchor Fields Data Migration

## Overview

This migration script populates the `anchorFingerprint` and `anchorFields` columns for existing `KGEntity` records in the database. The schema migration (adding the columns) has already been applied via Prisma migrations. This script performs the **data migration** to populate those fields.

## What This Script Does

1. **Reads existing entities** from the `kg_entities` table
2. **Infers anchor data** from entity attributes and schema configuration
3. **Generates anchor fingerprints** using the anchor generation algorithm
4. **Updates entities** with the inferred anchor data
5. **Reports statistics** on success, skips, and errors

## Prerequisites

- ✅ Prisma schema migration already applied (columns exist)
- ✅ Schemas configured with `anchor_fields` in database
- ✅ Node.js and dependencies installed
- ✅ Database accessible

## Usage

### Basic Usage

```bash
# Dry run (recommended first step)
node prisma/migrations/add_anchor_fields.js --dry-run

# Actual migration
node prisma/migrations/add_anchor_fields.js

# Verbose output
node prisma/migrations/add_anchor_fields.js --verbose

# Custom batch size
node prisma/migrations/add_anchor_fields.js --batch-size=50
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Simulate migration without making changes | false |
| `--verbose` | Show detailed logging for each entity | false |
| `--batch-size=N` | Process N entities at a time | 100 |

## Migration Process

### Step 1: Pre-Migration Check

```bash
# Check current state
node prisma/migrations/add_anchor_fields.js --dry-run
```

Expected output:
```
Total entities in database: 75
Entities needing migration: 75
```

### Step 2: Run Migration

```bash
# Run actual migration
node prisma/migrations/add_anchor_fields.js
```

The script will:
- Process entities in batches (default: 100)
- Generate anchor fingerprints based on schema configuration
- Update entities with anchor data
- Report progress and statistics

### Step 3: Verify Results

After migration completes, check the summary:

```
Migration Summary
================================================================================
Total Processed: 75
Successfully Updated: 70
Skipped: 5
Errors: 0

Entities with anchor fingerprint: 70
Entities without anchor fingerprint: 5
Anchor coverage: 93.33%
```

## How Anchor Inference Works

The script infers anchor data using this strategy:

1. **Parse entity schemas**: Extract schema information from entity's `schemas` field
2. **Load schema definition**: Fetch schema from database to get `anchor_fields` configuration
3. **Extract anchor values**: Get field values from entity's `attributes` field
4. **Generate fingerprint**: Use `anchor_generator.js` to create deterministic fingerprint
5. **Store anchor data**: Update entity with `anchorFingerprint` and `anchorFields`

### Example

For an entity with:
- Schema: "地下水位变化事件"
- Attributes: `{ "区域": "阿里C区", "指标": "水位", "时间": "2025-01" }`
- Schema anchor_fields: `[{ name: "区域" }, { name: "指标" }]`

The script generates:
- `anchorFingerprint`: `"PostProcessingEntity|c_zone|水位"`
- `anchorFields`: `{"区域": "阿里C区", "指标": "水位"}`

## Entities That May Be Skipped

Entities are skipped if:

1. **Already has anchor fingerprint**: Entity was already migrated
2. **Schema not found**: Schema name in entity doesn't exist in database
3. **No anchor_fields configured**: Schema has no anchor configuration
4. **Missing schema information**: Entity has no `schemas` field
5. **Missing anchor values**: Required anchor field values are missing

This is **normal and expected** for:
- Legacy entities created before anchor system
- Test entities with incomplete data
- Entities using deprecated schemas

## Troubleshooting

### Issue: "Schema not found in database"

**Cause**: Entity references a schema that doesn't exist in the `schemas` table.

**Solution**:
1. Check if schema was deleted or renamed
2. Update entity's `schemas` field to reference correct schema
3. Or accept that entity will be skipped

### Issue: "Schema has no anchor_fields configured"

**Cause**: Schema exists but doesn't have `anchor_fields` configuration.

**Solution**:
1. Run schema configuration script: `node kg/schema/batch_configure_anchors.js`
2. Or manually configure anchor_fields for the schema
3. Re-run migration

### Issue: "Missing required anchor field values"

**Cause**: Entity's attributes don't contain values for anchor fields.

**Solution**:
1. Check entity's `attributes` field
2. Verify anchor_fields configuration is correct
3. Update entity attributes if needed
4. Or accept that entity will be skipped

### Issue: Migration fails with error

**Cause**: Database connection issue, permission problem, or code error.

**Solution**:
1. Check database connection
2. Verify Prisma client is up to date: `npx prisma generate`
3. Check error logs for specific issue
4. Contact support if needed

## Performance

- **Batch processing**: Processes 100 entities at a time (configurable)
- **Small delays**: 100ms delay between batches to avoid overwhelming database
- **Typical speed**: ~1000 entities per minute
- **Memory usage**: Low (processes in batches)

For large databases (>10,000 entities):
```bash
# Use smaller batch size to reduce memory usage
node prisma/migrations/add_anchor_fields.js --batch-size=50
```

## Safety Features

### Dry Run Mode

Always test with `--dry-run` first:
```bash
node prisma/migrations/add_anchor_fields.js --dry-run --verbose
```

This shows what would happen without making changes.

### Idempotent

The script is **idempotent** - safe to run multiple times:
- Skips entities that already have anchor fingerprints
- No duplicate updates
- Can be interrupted and resumed

### No Data Loss

The script only **adds** data, never removes:
- Existing entity data is preserved
- Only `anchorFingerprint` and `anchorFields` are updated
- Original attributes remain unchanged

## Integration with Deployment

This script is part of the anchor-driven entity synthesis deployment:

1. **Schema migration** (already done): Add columns via Prisma
2. **Data migration** (this script): Populate anchor data
3. **Application deployment**: Deploy new code using anchor system
4. **Verification**: Run tests and verify anchor coverage

See also:
- `.kiro/specs/anchor-driven-entity-synthesis/migrations/deploy-migration.js`
- `.kiro/specs/anchor-driven-entity-synthesis/DEPLOYMENT_GUIDE.md`

## Rollback

If you need to clear anchor data:

```sql
-- Clear anchor fingerprints
UPDATE kg_entities SET anchor_fingerprint = NULL, anchor_fields = NULL;
```

Then re-run migration if needed.

## Monitoring

After migration, monitor:

1. **Anchor coverage**: Percentage of entities with anchors
2. **Query performance**: Check if anchor-based queries are fast
3. **Application logs**: Watch for anchor-related errors
4. **Entity merging**: Verify entities are merging correctly

## Support

For issues or questions:
- Check this README
- Review `.kiro/specs/anchor-driven-entity-synthesis/design.md`
- Check TROUBLESHOOTING.md
- Contact development team

---

**Version**: 1.0  
**Last Updated**: 2026-02-08  
**Status**: Production Ready
