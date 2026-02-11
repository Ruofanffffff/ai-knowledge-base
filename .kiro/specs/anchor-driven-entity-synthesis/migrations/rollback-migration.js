/**
 * Anchor-Driven Entity Synthesis - Database Migration Rollback Script
 * 
 * This script safely rolls back the anchor fields migration.
 * It removes the anchor_fingerprint and anchor_fields columns from kg_entities table.
 * 
 * Usage:
 *   node rollback-migration.js [--environment=<env>] [--dry-run] [--force]
 * 
 * Options:
 *   --environment=<env>  Target environment (development, staging, production)
 *   --dry-run           Simulate rollback without applying changes
 *   --force             Skip confirmation prompts
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  environment: 'development',
  dryRun: false,
  force: false
};

args.forEach(arg => {
  if (arg.startsWith('--environment=')) {
    options.environment = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--force') {
    options.force = true;
  }
});

const prisma = new PrismaClient();

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Check if rollback is needed
 */
async function checkRollbackNeeded() {
  log('Checking if rollback is needed...', 'INFO');
  
  try {
    // SQLite-specific: Use PRAGMA table_info to check columns
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(kg_entities)`);
    
    const anchorColumns = tableInfo.filter(col => 
      col.name === 'anchor_fingerprint' || col.name === 'anchor_fields'
    );
    
    if (anchorColumns.length === 0) {
      log('Anchor fields do not exist - rollback not needed', 'INFO');
      return false;
    }
    
    log(`Found ${anchorColumns.length} anchor field(s) to remove`, 'INFO');
    return true;
  } catch (error) {
    log(`Error checking columns: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Create backup before rollback
 */
async function createBackup() {
  log('Creating backup before rollback...', 'INFO');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../../backups');
  const backupFile = path.join(backupDir, `kg-backup-rollback-${timestamp}.db`);
  
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Copy database file (SQLite)
  const dbPath = path.join(__dirname, '../../../prisma/knowledge-base.db');
  
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupFile);
    log(`Backup created: ${backupFile}`, 'INFO');
    return backupFile;
  } else {
    log('Database file not found, skipping backup', 'WARN');
    return null;
  }
}

/**
 * Execute rollback SQL
 */
async function executeRollback() {
  log('Executing rollback...', 'INFO');
  
  if (options.dryRun) {
    log('DRY RUN: Would execute the following operations:', 'INFO');
    log('  1. Drop indexes: kg_entities_anchor_fingerprint_idx, kg_entities_type_anchor_fingerprint_idx', 'INFO');
    log('  2. Create temporary table without anchor fields', 'INFO');
    log('  3. Copy all data to temporary table', 'INFO');
    log('  4. Drop original table', 'INFO');
    log('  5. Rename temporary table to kg_entities', 'INFO');
    log('  6. Recreate original indexes', 'INFO');
    return { success: true, dryRun: true };
  }
  
  try {
    // Get current entity count for verification
    const beforeCount = await prisma.kGEntity.count();
    log(`Current entity count: ${beforeCount}`, 'INFO');
    
    log('Step 1: Dropping anchor-related indexes...', 'INFO');
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS kg_entities_anchor_fingerprint_idx`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS kg_entities_type_anchor_fingerprint_idx`);
    
    log('Step 2: Creating temporary table without anchor fields...', 'INFO');
    await prisma.$executeRawUnsafe(`
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
      )
    `);
    
    log('Step 3: Copying data to temporary table...', 'INFO');
    await prisma.$executeRawUnsafe(`
      INSERT INTO kg_entities_temp (
        id, type, canonical_name, aliases, schemas, supported_by,
        attributes, confidence, llm_enriched, created_at, updated_at
      )
      SELECT 
        id, type, canonical_name, aliases, schemas, supported_by,
        attributes, confidence, llm_enriched, created_at, updated_at
      FROM kg_entities
    `);
    
    // Verify data copied correctly
    const tempCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM kg_entities_temp`);
    const copiedCount = tempCount[0].count;
    log(`Copied ${copiedCount} entities to temporary table`, 'INFO');
    
    if (copiedCount !== beforeCount) {
      throw new Error(`Data copy verification failed: expected ${beforeCount}, got ${copiedCount}`);
    }
    
    log('Step 4: Dropping original table...', 'INFO');
    await prisma.$executeRawUnsafe(`DROP TABLE kg_entities`);
    
    log('Step 5: Renaming temporary table...', 'INFO');
    await prisma.$executeRawUnsafe(`ALTER TABLE kg_entities_temp RENAME TO kg_entities`);
    
    log('Step 6: Recreating original indexes...', 'INFO');
    await prisma.$executeRawUnsafe(`CREATE INDEX kg_entities_type_idx ON kg_entities(type)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX kg_entities_canonical_name_idx ON kg_entities(canonical_name)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX kg_entities_confidence_idx ON kg_entities(confidence)`);
    
    // Verify final count
    const afterCount = await prisma.kGEntity.count();
    log(`Final entity count: ${afterCount}`, 'INFO');
    
    if (afterCount !== beforeCount) {
      throw new Error(`Final verification failed: expected ${beforeCount}, got ${afterCount}`);
    }
    
    log('Rollback executed successfully', 'INFO');
    return { success: true, entitiesPreserved: afterCount };
  } catch (error) {
    log(`Rollback failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Verify rollback success
 */
async function verifyRollback() {
  log('Verifying rollback...', 'INFO');
  
  const verifications = [];
  
  // Verify 1: Columns removed
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(kg_entities)`);
    
    const anchorColumns = tableInfo.filter(col => 
      col.name === 'anchor_fingerprint' || col.name === 'anchor_fields'
    );
    
    if (anchorColumns.length === 0) {
      verifications.push({ name: 'Columns Removed', status: 'PASS' });
    } else {
      verifications.push({ 
        name: 'Columns Removed', 
        status: 'FAIL', 
        message: `${anchorColumns.length} column(s) still exist: ${anchorColumns.map(c => c.name).join(', ')}` 
      });
    }
  } catch (error) {
    verifications.push({ name: 'Columns Removed', status: 'FAIL', error: error.message });
  }
  
  // Verify 2: Data intact
  try {
    const count = await prisma.kGEntity.count();
    verifications.push({ 
      name: 'Data Integrity', 
      status: 'PASS', 
      message: `${count} entities preserved` 
    });
  } catch (error) {
    verifications.push({ name: 'Data Integrity', status: 'FAIL', error: error.message });
  }
  
  // Verify 3: Table structure
  try {
    const sample = await prisma.kGEntity.findFirst();
    if (sample) {
      // Check that anchor fields are not present
      if (sample.anchorFingerprint !== undefined || sample.anchorFields !== undefined) {
        verifications.push({ 
          name: 'Table Structure', 
          status: 'FAIL',
          message: 'Anchor fields still accessible in Prisma model' 
        });
      } else {
        verifications.push({ name: 'Table Structure', status: 'PASS' });
      }
    } else {
      verifications.push({ 
        name: 'Table Structure', 
        status: 'WARN', 
        message: 'No entities found to verify structure' 
      });
    }
  } catch (error) {
    // This is expected if Prisma client hasn't been regenerated
    if (error.message.includes('Unknown field')) {
      verifications.push({ 
        name: 'Table Structure', 
        status: 'PASS',
        message: 'Anchor fields removed (Prisma client needs regeneration)' 
      });
    } else {
      verifications.push({ name: 'Table Structure', status: 'FAIL', error: error.message });
    }
  }
  
  // Verify 4: Indexes
  try {
    const indexes = await prisma.$queryRawUnsafe(`PRAGMA index_list(kg_entities)`);
    const anchorIndexes = indexes.filter(idx => 
      idx.name.includes('anchor')
    );
    
    if (anchorIndexes.length === 0) {
      verifications.push({ name: 'Indexes Removed', status: 'PASS' });
    } else {
      verifications.push({ 
        name: 'Indexes Removed', 
        status: 'FAIL', 
        message: `${anchorIndexes.length} anchor index(es) still exist` 
      });
    }
  } catch (error) {
    verifications.push({ name: 'Indexes Removed', status: 'FAIL', error: error.message });
  }
  
  // Print results
  log('Verification results:', 'INFO');
  verifications.forEach(check => {
    const icon = check.status === 'PASS' ? '✓' : check.status === 'FAIL' ? '✗' : '⚠';
    log(`  ${icon} ${check.name}: ${check.status}`, check.status);
    if (check.message) log(`    ${check.message}`, 'INFO');
    if (check.error) log(`    Error: ${check.error}`, 'ERROR');
  });
  
  // Check for failures
  const failures = verifications.filter(c => c.status === 'FAIL');
  if (failures.length > 0) {
    throw new Error(`Rollback verification failed: ${failures.length} check(s) failed`);
  }
  
  return verifications;
}

/**
 * Main rollback function
 */
async function rollbackMigration() {
  log('='.repeat(80), 'INFO');
  log('Anchor-Driven Entity Synthesis - Database Migration Rollback', 'INFO');
  log('='.repeat(80), 'INFO');
  log(`Environment: ${options.environment}`, 'INFO');
  log(`Dry Run: ${options.dryRun}`, 'INFO');
  log(`Force: ${options.force}`, 'INFO');
  log('', 'INFO');
  
  try {
    // Step 1: Check if rollback is needed
    const needed = await checkRollbackNeeded();
    if (!needed) {
      log('No rollback needed - exiting', 'INFO');
      process.exit(0);
    }
    log('', 'INFO');
    
    // Step 2: Confirmation
    if (!options.force && !options.dryRun) {
      log('⚠️  WARNING: This will remove anchor fields from the database!', 'WARN');
      log('⚠️  WARNING: This operation cannot be undone!', 'WARN');
      log('Press Ctrl+C to cancel, or wait 10 seconds to continue...', 'WARN');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Step 3: Create backup
    const backupFile = await createBackup();
    log('', 'INFO');
    
    // Step 4: Execute rollback
    await executeRollback();
    log('', 'INFO');
    
    // Step 5: Verify rollback
    if (!options.dryRun) {
      await verifyRollback();
      log('', 'INFO');
    }
    
    // Success
    log('='.repeat(80), 'INFO');
    log('✓ Migration rollback completed successfully!', 'INFO');
    log('='.repeat(80), 'INFO');
    
    if (backupFile) {
      log(`Backup saved to: ${backupFile}`, 'INFO');
    }
    
    if (options.dryRun) {
      log('DRY RUN: No changes were made to the database', 'INFO');
    }
    
    log('', 'INFO');
    log('Next steps:', 'INFO');
    log('  1. Update application code to remove anchor references', 'INFO');
    log('  2. Restart the application', 'INFO');
    log('  3. Verify application functionality', 'INFO');
    
    process.exit(0);
  } catch (error) {
    log('='.repeat(80), 'ERROR');
    log('✗ Migration rollback failed!', 'ERROR');
    log('='.repeat(80), 'ERROR');
    log(`Error: ${error.message}`, 'ERROR');
    log('', 'ERROR');
    log('Recovery instructions:', 'ERROR');
    log('  1. Stop the application immediately', 'ERROR');
    log('  2. Restore from backup', 'ERROR');
    log('  3. Contact support if needed', 'ERROR');
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run rollback
rollbackMigration();
