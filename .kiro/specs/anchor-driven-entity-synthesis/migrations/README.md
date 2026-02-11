# Anchor-Driven Entity Synthesis - Database Migration Scripts

This directory contains scripts for deploying, verifying, and rolling back the anchor fields database migration.

## Overview

The anchor fields migration adds two new columns to the `kg_entities` table:
- `anchor_fingerprint` (String, nullable) - The deterministic anchor fingerprint for entity identification
- `anchor_fields` (String, nullable) - JSON string containing the anchor field values

It also creates two indexes:
- `anchor_fingerprint` - Single column index for fast anchor lookups
- `type + anchor_fingerprint` - Composite index for type-specific anchor queries

## Scripts

### 1. deploy-migration.js

Deploys the anchor fields migration to the database with safety checks.

**Usage**:
```bash
# Development
node deploy-migration.js --environment=development

# Staging
node deploy-migration.js --environment=staging

# Production (with confirmation)
node deploy-migration.js --environment=production

# Dry run (simulate without changes)
node deploy-migration.js --dry-run

# Force (skip confirmation)
node deploy-migration.js --force
```

**Features**:
- Pre-flight checks (database connection, disk space, existing migration)
- Automatic database backup
- Migration execution via Prisma
- Post-migration verification
- Detailed logging

**Pre-flight Checks**:
- ✓ Database connection
- ✓ Migration status (checks if already applied)
- ✓ Backup directory exists
- ✓ Sufficient disk space

**Post-migration Verification**:
- ✓ Columns created
- ✓ Indexes created
- ✓ Data integrity preserved

### 2. rollback-migration.js

Rolls back the anchor fields migration, removing the added columns.

**Usage**:
```bash
# Development
node rollback-migration.js --environment=development

# Staging
node rollback-migration.js --environment=staging

# Production (with extended confirmation)
node rollback-migration.js --environment=production

# Dry run (simulate without changes)
node rollback-migration.js --dry-run

# Force (skip confirmation)
node rollback-migration.js --force
```

**Features**:
- Checks if rollback is needed
- Automatic database backup before rollback
- Safe table recreation (preserves all other data)
- Post-rollback verification
- 10-second confirmation delay for production

**⚠️ Warning**: Rollback will remove all anchor fingerprints and anchor fields data. This operation cannot be undone (except by restoring from backup).

### 3. verify-migration.js

Verifies that the migration was applied correctly and the database is healthy.

**Usage**:
```bash
# Basic verification
node verify-migration.js

# Verbose output
node verify-migration.js --verbose
```

**Verification Checks**:
1. ✓ Database connection
2. ✓ anchor_fingerprint column exists
3. ✓ anchor_fields column exists
4. ✓ Anchor fingerprint index exists
5. ✓ Composite index exists
6. ✓ Data integrity (entity count, anchor coverage)
7. ✓ Query performance
8. ✓ Schema configuration

**Exit Codes**:
- `0` - All checks passed
- `1` - One or more checks failed

## Deployment Workflow

### Development Environment

```bash
# 1. Deploy migration
node deploy-migration.js --environment=development

# 2. Verify migration
node verify-migration.js --verbose

# 3. Test application
npm test

# 4. If issues occur, rollback
node rollback-migration.js --environment=development
```

### Staging Environment

```bash
# 1. Dry run first
node deploy-migration.js --environment=staging --dry-run

# 2. Deploy migration
node deploy-migration.js --environment=staging

# 3. Verify migration
node verify-migration.js

# 4. Run integration tests
npm run test:integration

# 5. Monitor for 24 hours
# Check logs, metrics, and performance

# 6. If issues occur, rollback
node rollback-migration.js --environment=staging
```

### Production Environment

```bash
# 1. Ensure staging is successful
# 2. Schedule maintenance window
# 3. Notify stakeholders

# 4. Create manual backup
cp prisma/knowledge-base.db backups/manual-backup-$(date +%Y%m%d-%H%M%S).db

# 5. Dry run
node deploy-migration.js --environment=production --dry-run

# 6. Deploy migration (with 5-second confirmation)
node deploy-migration.js --environment=production

# 7. Verify migration
node verify-migration.js

# 8. Restart application
npm run restart:production

# 9. Smoke tests
npm run test:smoke

# 10. Monitor closely
# Watch error logs, performance metrics, user reports

# 11. If critical issues, rollback immediately
node rollback-migration.js --environment=production --force
```

## Backup and Recovery

### Automatic Backups

Both `deploy-migration.js` and `rollback-migration.js` automatically create backups before making changes:

```
backups/
  kg-backup-2026-02-08T12-00-00-000Z.db
  kg-backup-rollback-2026-02-08T12-30-00-000Z.db
```

### Manual Backup

```bash
# Create manual backup
mkdir -p backups
cp prisma/knowledge-base.db backups/manual-backup-$(date +%Y%m%d-%H%M%S).db
```

### Restore from Backup

```bash
# 1. Stop application
npm run stop

# 2. Restore database
cp backups/kg-backup-TIMESTAMP.db prisma/knowledge-base.db

# 3. Restart application
npm run start

# 4. Verify
node verify-migration.js
```

## Troubleshooting

### Migration Already Applied

If you see "Anchor fields already exist in database":
- This is expected if migration was already run
- Run `verify-migration.js` to check health
- No action needed unless verification fails

### Migration Failed

If deployment fails:
1. Check error message in logs
2. Verify database connection
3. Check disk space
4. Review Prisma migration logs
5. Restore from backup if needed
6. Contact support

### Rollback Failed

If rollback fails:
1. **DO NOT PANIC**
2. Stop the application immediately
3. Restore from backup:
   ```bash
   cp backups/kg-backup-rollback-TIMESTAMP.db prisma/knowledge-base.db
   ```
4. Verify restoration:
   ```bash
   node verify-migration.js
   ```
5. Contact support

### Verification Warnings

Warnings are non-critical but should be reviewed:
- **No entities have anchor fingerprints**: Expected for new migration, will populate as new entities are created
- **Query took longer than expected**: May indicate index issues, monitor performance
- **No schemas have anchor_fields configured**: Run schema configuration script

### Performance Issues

If queries are slow after migration:
1. Check indexes exist: `node verify-migration.js --verbose`
2. Analyze query plans
3. Consider running `ANALYZE` on SQLite
4. Monitor anchor generation performance

## Safety Features

### Pre-flight Checks
- Validates database connection
- Checks if migration already applied
- Verifies sufficient disk space
- Ensures backup directory exists

### Automatic Backups
- Created before every migration/rollback
- Timestamped for easy identification
- Stored in `backups/` directory

### Confirmation Prompts
- 5-second delay for production deployments
- 10-second delay for production rollbacks
- Can be skipped with `--force` flag

### Dry Run Mode
- Simulates migration without changes
- Shows SQL that would be executed
- Safe for testing

### Verification
- Automatic post-migration verification
- Checks columns, indexes, and data integrity
- Standalone verification script

## Best Practices

1. **Always test in development first**
2. **Run dry-run before production deployment**
3. **Create manual backup before production changes**
4. **Schedule maintenance window for production**
5. **Monitor closely after deployment**
6. **Keep backups for at least 30 days**
7. **Document any issues encountered**
8. **Have rollback plan ready**

## Support

For issues or questions:
- Check TROUBLESHOOTING.md
- Review DEPLOYMENT_CHECKLIST.md
- Consult IMPLEMENTATION_COMPLETE_SUMMARY.md
- Contact development team

---

**Version**: 1.0  
**Last Updated**: 2026-02-08  
**Status**: Production Ready
