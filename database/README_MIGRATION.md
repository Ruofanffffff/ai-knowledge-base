# Database Migration Guide

## Overview

This guide explains how to use the `migrateDocumentsTable.js` migration script to add file deduplication support to the documents table.

## What This Migration Does

The migration adds the following to the `documents` table:

1. **New Columns:**
   - `hash VARCHAR(64)` - Stores SHA-256 hash of file content for duplicate detection
   - `size INTEGER` - Stores file size in bytes

2. **New Indexes:**
   - `idx_documents_hash` - Index on hash column for fast content duplicate detection
   - `idx_documents_user_filename` - Composite index on (user_id, title) for fast filename duplicate detection

## Usage

### Apply Migration (Add Columns and Indexes)

```bash
node database/migrateDocumentsTable.js up
```

This will:
- Add `hash` and `size` columns to the documents table
- Create indexes for optimized duplicate detection queries
- Preserve all existing data

### Rollback Migration (Remove Columns and Indexes)

```bash
node database/migrateDocumentsTable.js down
```

This will:
- Remove the `hash` and `size` columns
- Drop the created indexes
- Preserve all other existing data

**Note:** SQLite doesn't support `DROP COLUMN` directly, so the rollback recreates the table without the new columns.

## Before Running Migration

1. **Backup your database:**
   ```bash
   cp data/users.db data/users.db.backup
   ```

2. **Ensure the application is stopped** to avoid conflicts

3. **Verify database path** in `initUserDB.js` is correct

## After Running Migration

1. **Verify the migration:**
   ```bash
   sqlite3 data/users.db "PRAGMA table_info(documents);"
   ```
   
   You should see `hash` and `size` columns in the output.

2. **Check indexes:**
   ```bash
   sqlite3 data/users.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='documents';"
   ```
   
   You should see `idx_documents_hash` and `idx_documents_user_filename`.

3. **Restart the application**

## Programmatic Usage

You can also use the migration functions programmatically:

```javascript
const { applyMigration, rollbackMigration } = require('./database/migrateDocumentsTable');
const { initDatabase } = require('./database/initUserDB');

const db = initDatabase();

// Apply migration
applyMigration(db)
  .then(() => console.log('Migration applied successfully'))
  .catch(err => console.error('Migration failed:', err));

// Or rollback
rollbackMigration(db)
  .then(() => console.log('Rollback completed successfully'))
  .catch(err => console.error('Rollback failed:', err));
```

## Troubleshooting

### "duplicate column name" Error

If you see this error, the columns already exist. The migration script handles this gracefully and will skip adding duplicate columns.

### Migration Fails Midway

If the migration fails:

1. Check the error message for details
2. Restore from backup if needed:
   ```bash
   cp data/users.db.backup data/users.db
   ```
3. Fix the issue and try again

### Rollback Fails

If rollback fails:

1. Restore from backup:
   ```bash
   cp data/users.db.backup data/users.db
   ```
2. Check database integrity:
   ```bash
   sqlite3 data/users.db "PRAGMA integrity_check;"
   ```

## Impact on Existing Data

- **Existing documents:** Will have `NULL` values for `hash` and `size` columns
- **New uploads:** Will populate these columns automatically
- **Backward compatibility:** The application will work with both old and new documents
- **Optional:** You can run a background job to calculate hashes for existing files

## Performance Considerations

- The indexes will improve query performance for duplicate detection
- Hash calculation for large files uses streaming to avoid memory issues
- Duplicate detection queries should complete in < 50ms with the indexes

## Related Files

- `database/initUserDB.js` - Database initialization
- `services/fileHashService.js` - Hash calculation service (to be implemented)
- `services/deduplicationService.js` - Duplicate detection service (to be implemented)
- `services/documentStorageService.js` - Document storage service (to be implemented)
