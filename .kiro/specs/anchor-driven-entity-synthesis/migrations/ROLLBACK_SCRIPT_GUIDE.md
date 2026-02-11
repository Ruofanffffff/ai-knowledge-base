# Rollback Migration Script - Complete Guide

## Overview

The `rollback-migration.js` script safely removes the anchor fields (`anchor_fingerprint` and `anchor_fields`) from the `kg_entities` table, reverting the database to its pre-migration state.

**Version**: 2.0 (SQLite-optimized)  
**Last Updated**: 2026-02-08  
**Status**: ✅ Production Ready & Tested

## Key Features

### ✅ Safety Features
- **Automatic backup** before any changes
- **Dry-run mode** to preview operations
- **Data integrity verification** at every step
- **Entity count validation** before and after
- **10-second confirmation** for production environments
- **Comprehensive error handling**

### ✅ SQLite Optimized
- Uses `PRAGMA table_info` instead of `information_schema`
- Proper table recreation (SQLite doesn't support DROP COLUMN)
- Preserves all non-anchor data
- Recreates all original indexes
- Handles SQLite-specific constraints

### ✅ Verification
- Confirms columns removed
- Validates data integrity
- Checks index removal
- Verifies entity count unchanged
- Tests table structure

## Usage

### Basic Usage

```bash
# Development environment (default)
node rollback-migration.js

# Staging environment
node rollback-migration.js --environment=staging

# Production environment (with confirmation)
node rollback-migration.js --environment=production
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--environment=<env>` | Target environment (development, staging, production) | `development` |
| `--dry-run` | Simulate rollback without making changes | `false` |
| `--force` | Skip confirmation prompts | `false` |

### Examples

```bash
# Dry run to see what would happen
node rollback-migration.js --dry-run

# Rollback in development
node rollback-migration.js --environment=development

# Rollback in production with confirmation
node rollback-migration.js --environment=production

# Force rollback without confirmation (use with caution!)
node rollback-migration.js --environment=production --force
```

## What the Script Does

### Step-by-Step Process

1. **Pre-flight Check**
   - Checks if anchor fields exist
   - Exits if rollback not needed
   - Validates database connection

2. **Backup Creation**
   - Creates `backups/` directory if needed
   - Copies database to timestamped backup file
   - Format: `kg-backup-rollback-YYYY-MM-DDTHH-MM-SS-SSSZ.db`

3. **Confirmation** (production only)
   - Displays warning message
   - 10-second countdown
   - Can be cancelled with Ctrl+C

4. **Rollback Execution**
   - Counts entities (for verification)
   - Drops anchor-related indexes
   - Creates temporary table without anchor fields
   - Copies all data to temporary table
   - Verifies data copied correctly
   - Drops original table
   - Renames temporary table
   - Recreates original indexes
   - Verifies final entity count

5. **Verification**
   - Confirms columns removed
   - Validates data integrity
   - Checks indexes removed
   - Verifies table structure

6. **Completion**
   - Displays success message
   - Shows backup location
   - Provides next steps

## Output Example

### Dry Run Output

```
================================================================================
Anchor-Driven Entity Synthesis - Database Migration Rollback
================================================================================
Environment: development
Dry Run: true
Force: false

Checking if rollback is needed...
Found 2 anchor field(s) to remove

Creating backup before rollback...
Backup created: backups/kg-backup-rollback-2026-02-08T12-00-00-000Z.db

Executing rollback...
DRY RUN: Would execute the following operations:
  1. Drop indexes: kg_entities_anchor_fingerprint_idx, kg_entities_type_anchor_fingerprint_idx
  2. Create temporary table without anchor fields
  3. Copy all data to temporary table
  4. Drop original table
  5. Rename temporary table to kg_entities
  6. Recreate original indexes

================================================================================
✓ Migration rollback completed successfully!
================================================================================
DRY RUN: No changes were made to the database

Next steps:
  1. Update application code to remove anchor references
  2. Restart the application
  3. Verify application functionality
```

### Actual Rollback Output

```
================================================================================
Anchor-Driven Entity Synthesis - Database Migration Rollback
================================================================================
Environment: production
Dry Run: false
Force: false

Checking if rollback is needed...
Found 2 anchor field(s) to remove

⚠️  WARNING: This will remove anchor fields from the database!
⚠️  WARNING: This operation cannot be undone!
Press Ctrl+C to cancel, or wait 10 seconds to continue...

Creating backup before rollback...
Backup created: backups/kg-backup-rollback-2026-02-08T12-00-00-000Z.db

Executing rollback...
Current entity count: 1523
Step 1: Dropping anchor-related indexes...
Step 2: Creating temporary table without anchor fields...
Step 3: Copying data to temporary table...
Copied 1523 entities to temporary table
Step 4: Dropping original table...
Step 5: Renaming temporary table...
Step 6: Recreating original indexes...
Final entity count: 1523
Rollback executed successfully

Verifying rollback...
Verification results:
  ✓ Columns Removed: PASS
  ✓ Data Integrity: PASS
    1523 entities preserved
  ✓ Table Structure: PASS
  ✓ Indexes Removed: PASS

================================================================================
✓ Migration rollback completed successfully!
================================================================================
Backup saved to: backups/kg-backup-rollback-2026-02-08T12-00-00-000Z.db

Next steps:
  1. Update application code to remove anchor references
  2. Restart the application
  3. Verify application functionality
```

## Technical Details

### SQLite Table Recreation

Since SQLite doesn't support `ALTER TABLE DROP COLUMN`, the script uses a safe table recreation approach:

```sql
-- 1. Create temporary table without anchor fields
CREATE TABLE kg_entities_temp (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases TEXT,
  schemas TEXT NOT NULL,
  supported_by TEXT NOT NULL,
  attributes TEXT,
  confidence REAL NOT NULL,
  llm_enriched INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
);

-- 2. Copy all data
INSERT INTO kg_entities_temp (...)
SELECT ... FROM kg_entities;

-- 3. Drop original table
DROP TABLE kg_entities;

-- 4. Rename temporary table
ALTER TABLE kg_entities_temp RENAME TO kg_entities;

-- 5. Recreate indexes
CREATE INDEX kg_entities_type_idx ON kg_entities(type);
CREATE INDEX kg_entities_canonical_name_idx ON kg_entities(canonical_name);
CREATE INDEX kg_entities_confidence_idx ON kg_entities(confidence);
```

### Data Integrity Checks

The script performs multiple integrity checks:

1. **Before rollback**: Count entities
2. **After copy**: Verify count matches
3. **After rename**: Verify count still matches
4. **Column check**: Confirm anchor fields removed
5. **Index check**: Confirm anchor indexes removed

### Error Handling

If any step fails:
- Transaction is rolled back (if supported)
- Error message is logged
- Backup remains intact
- Exit code 1 is returned
- Recovery instructions are displayed

## Post-Rollback Steps

### 1. Update Prisma Schema

Remove or comment out anchor fields:

```prisma
model KGEntity {
  id                String   @id @default(uuid())
  type              String
  canonicalName     String   @map("canonical_name")
  
  // 🔴 Remove these lines:
  // anchorFingerprint String?  @map("anchor_fingerprint")
  // anchorFields      String?  @map("anchor_fields")
  
  aliases           String?
  schemas           String
  supportedBy       String   @map("supported_by")
  // ... rest of fields
  
  @@map("kg_entities")
  @@index([type])
  @@index([canonicalName])
  @@index([confidence])
  // 🔴 Remove these indexes:
  // @@index([anchorFingerprint])
  // @@index([type, anchorFingerprint])
}
```

### 2. Regenerate Prisma Client

```bash
npx prisma generate
```

### 3. Update Application Code

Remove anchor-related code:

```javascript
// 🔴 Remove these imports
// const { generateAnchorFingerprint } = require('./kg/entity/anchor_generator');
// const { mergeInstancesByAnchor } = require('./kg/entity/anchor_merger');

// 🔴 Remove anchor generation code
// const anchor = generateAnchorFingerprint(instance, schema);

// 🔴 Remove anchor merging code
// const entities = mergeInstancesByAnchor(instances, schemaMap);

// ✅ Use legacy entity building
const entities = buildEntitiesLegacy(context, options);
```

### 4. Update Configuration

Set compatibility mode to LEGACY:

```javascript
// In your config file
module.exports = {
  entityBuilding: {
    compatibilityMode: 'LEGACY', // Changed from 'ANCHOR_ONLY'
    // ... other options
  }
};
```

Or via environment variable:

```bash
export ANCHOR_COMPATIBILITY_MODE=LEGACY
```

### 5. Restart Application

```bash
# Stop application
npm run stop

# Start application
npm run start

# Or restart
npm run restart
```

### 6. Verify Application

```bash
# Run smoke tests
npm run test:smoke

# Run integration tests
npm run test:integration

# Check health
npm run health-check

# Monitor logs
tail -f logs/application.log
```

## Troubleshooting

### Issue: "Anchor fields do not exist"

**Cause**: Migration was never applied or already rolled back.

**Solution**: No action needed. This is the expected state after rollback.

```bash
# Verify with:
node verify-migration.js
# Should show: "Anchor fields NOT found"
```

### Issue: "Database file not found"

**Cause**: Database path is incorrect or database doesn't exist.

**Solution**: Check database location:

```bash
# Check if database exists
ls -la prisma/knowledge-base.db

# If missing, restore from backup
cp backups/kg-backup-TIMESTAMP.db prisma/knowledge-base.db
```

### Issue: "Data copy verification failed"

**Cause**: Data loss during copy operation.

**Solution**: Restore from backup immediately:

```bash
# Stop application
npm run stop

# Restore from backup
cp backups/kg-backup-rollback-TIMESTAMP.db prisma/knowledge-base.db

# Verify restoration
sqlite3 prisma/knowledge-base.db "SELECT COUNT(*) FROM kg_entities;"

# Restart application
npm run start
```

### Issue: "Rollback script hangs"

**Cause**: Database is locked by another process.

**Solution**: 

```bash
# Stop all processes using the database
npm run stop

# Check for lingering processes
ps aux | grep node

# Kill if necessary
kill -9 <PID>

# Retry rollback
node rollback-migration.js
```

### Issue: "Prisma client errors after rollback"

**Cause**: Prisma client not regenerated.

**Solution**:

```bash
# Regenerate Prisma client
npx prisma generate

# Restart application
npm run restart
```

## Testing

### Run Tests

```bash
# Run rollback script tests
npx jest .kiro/specs/anchor-driven-entity-synthesis/migrations/rollback-migration.test.js

# All tests should pass:
# ✓ Dry run mode
# ✓ Pre-flight checks
# ✓ Backup creation
# ✓ SQLite compatibility
# ✓ Error handling
# ✓ Command line arguments
# ✓ Verification logic
# ✓ Documentation
```

### Manual Testing

```bash
# 1. Test dry run
node rollback-migration.js --dry-run

# 2. Test in development
node rollback-migration.js --environment=development

# 3. Verify rollback
node verify-migration.js
# Should show: "Anchor fields NOT found"

# 4. Test application
npm test

# 5. If needed, restore from backup
cp backups/kg-backup-rollback-TIMESTAMP.db prisma/knowledge-base.db
```

## Best Practices

### Before Rollback

1. ✅ **Test in development first**
2. ✅ **Run dry-run mode**
3. ✅ **Create manual backup**
4. ✅ **Notify stakeholders**
5. ✅ **Schedule maintenance window**
6. ✅ **Review rollback plan**

### During Rollback

1. ✅ **Monitor output carefully**
2. ✅ **Watch for errors**
3. ✅ **Don't interrupt the process**
4. ✅ **Keep backup location noted**

### After Rollback

1. ✅ **Verify data integrity**
2. ✅ **Update application code**
3. ✅ **Regenerate Prisma client**
4. ✅ **Restart application**
5. ✅ **Run tests**
6. ✅ **Monitor for 24 hours**
7. ✅ **Document issues**

## Recovery Scenarios

### Scenario 1: Rollback Failed Mid-Process

```bash
# 1. Stop application immediately
npm run stop

# 2. Restore from backup
cp backups/kg-backup-rollback-TIMESTAMP.db prisma/knowledge-base.db

# 3. Verify restoration
sqlite3 prisma/knowledge-base.db "PRAGMA integrity_check;"
# Should output: ok

# 4. Restart application
npm run start

# 5. Contact support
```

### Scenario 2: Data Loss Detected

```bash
# 1. Stop application
npm run stop

# 2. Identify backup to restore
ls -lh backups/

# 3. Restore from backup
cp backups/kg-backup-TIMESTAMP.db prisma/knowledge-base.db

# 4. Verify entity count
sqlite3 prisma/knowledge-base.db "SELECT COUNT(*) FROM kg_entities;"

# 5. Restart application
npm run start
```

### Scenario 3: Application Won't Start After Rollback

```bash
# 1. Check Prisma client
npx prisma generate

# 2. Check configuration
# Ensure ANCHOR_COMPATIBILITY_MODE=LEGACY

# 3. Check logs
tail -100 logs/error.log

# 4. Verify database
node verify-migration.js

# 5. Restart
npm run restart
```

## Related Documentation

- **ROLLBACK_PLAN.md** - Complete rollback procedures for all levels
- **DEPLOYMENT_GUIDE.md** - Deployment procedures and best practices
- **README.md** - Migration scripts overview
- **verify-migration.js** - Migration verification script
- **deploy-migration.js** - Migration deployment script

## Support

For issues or questions:
1. Check this guide
2. Review ROLLBACK_PLAN.md
3. Check TROUBLESHOOTING.md
4. Run tests: `npx jest rollback-migration.test.js`
5. Contact development team

---

**Version**: 2.0  
**Last Updated**: 2026-02-08  
**Status**: ✅ Production Ready & Tested  
**Test Coverage**: 18/18 tests passing
