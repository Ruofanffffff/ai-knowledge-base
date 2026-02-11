/**
 * Anchor-Driven Entity Synthesis - Database Migration Deployment Script
 * 
 * This script safely deploys the anchor fields migration to the database.
 * It includes pre-flight checks, migration execution, and post-migration validation.
 * 
 * Usage:
 *   node deploy-migration.js [--environment=<env>] [--dry-run] [--force]
 * 
 * Options:
 *   --environment=<env>  Target environment (development, staging, production)
 *   --dry-run           Simulate migration without applying changes
 *   --force             Skip confirmation prompts
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
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
 * Pre-flight checks before migration
 */
async function preFlightChecks() {
  log('Running pre-flight checks...', 'INFO');
  
  const checks = [];
  
  // Check 1: Database connection
  try {
    await prisma.$connect();
    checks.push({ name: 'Database Connection', status: 'PASS' });
  } catch (error) {
    checks.push({ name: 'Database Connection', status: 'FAIL', error: error.message });
  }
  
  // Check 2: Check if migration already applied
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'kg_entities' 
      AND column_name IN ('anchor_fingerprint', 'anchor_fields')
    `;
    
    if (result.length > 0) {
      checks.push({ 
        name: 'Migration Status', 
        status: 'WARN', 
        message: 'Anchor fields already exist in database' 
      });
    } else {
      checks.push({ name: 'Migration Status', status: 'PASS' });
    }
  } catch (error) {
    checks.push({ name: 'Migration Status', status: 'FAIL', error: error.message });
  }
  
  // Check 3: Backup exists
  const backupPath = path.join(__dirname, '../../backups');
  if (fs.existsSync(backupPath)) {
    checks.push({ name: 'Backup Directory', status: 'PASS' });
  } else {
    checks.push({ 
      name: 'Backup Directory', 
      status: 'WARN', 
      message: 'Backup directory does not exist' 
    });
  }
  
  // Check 4: Disk space
  try {
    const stats = fs.statfsSync(process.cwd());
    const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 ** 3);
    
    if (freeSpaceGB > 1) {
      checks.push({ name: 'Disk Space', status: 'PASS', message: `${freeSpaceGB.toFixed(2)} GB free` });
    } else {
      checks.push({ 
        name: 'Disk Space', 
        status: 'WARN', 
        message: `Only ${freeSpaceGB.toFixed(2)} GB free` 
      });
    }
  } catch (error) {
    checks.push({ name: 'Disk Space', status: 'SKIP', message: 'Could not check disk space' });
  }
  
  // Print results
  log('Pre-flight check results:', 'INFO');
  checks.forEach(check => {
    const icon = check.status === 'PASS' ? '✓' : check.status === 'FAIL' ? '✗' : '⚠';
    log(`  ${icon} ${check.name}: ${check.status}`, check.status);
    if (check.message) log(`    ${check.message}`, 'INFO');
    if (check.error) log(`    Error: ${check.error}`, 'ERROR');
  });
  
  // Check for failures
  const failures = checks.filter(c => c.status === 'FAIL');
  if (failures.length > 0) {
    throw new Error(`Pre-flight checks failed: ${failures.length} check(s) failed`);
  }
  
  return checks;
}

/**
 * Create database backup
 */
async function createBackup() {
  log('Creating database backup...', 'INFO');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../../backups');
  const backupFile = path.join(backupDir, `kg-backup-${timestamp}.db`);
  
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
 * Apply Prisma migration
 */
async function applyMigration() {
  log('Applying Prisma migration...', 'INFO');
  
  try {
    if (options.dryRun) {
      log('DRY RUN: Would execute: npx prisma migrate deploy', 'INFO');
      return { success: true, dryRun: true };
    }
    
    const output = execSync('npx prisma migrate deploy', {
      cwd: path.join(__dirname, '../../..'),
      encoding: 'utf-8'
    });
    
    log('Migration output:', 'INFO');
    log(output, 'INFO');
    
    return { success: true, output };
  } catch (error) {
    log(`Migration failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Verify migration success
 */
async function verifyMigration() {
  log('Verifying migration...', 'INFO');
  
  const verifications = [];
  
  // Verify 1: Columns exist
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kg_entities' 
      AND column_name IN ('anchor_fingerprint', 'anchor_fields')
    `;
    
    if (columns.length === 2) {
      verifications.push({ name: 'Columns Created', status: 'PASS' });
    } else {
      verifications.push({ 
        name: 'Columns Created', 
        status: 'FAIL', 
        message: `Expected 2 columns, found ${columns.length}` 
      });
    }
  } catch (error) {
    verifications.push({ name: 'Columns Created', status: 'FAIL', error: error.message });
  }
  
  // Verify 2: Indexes exist
  try {
    const indexes = await prisma.$queryRaw`
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND tbl_name = 'kg_entities'
      AND name LIKE '%anchor%'
    `;
    
    if (indexes.length >= 2) {
      verifications.push({ name: 'Indexes Created', status: 'PASS' });
    } else {
      verifications.push({ 
        name: 'Indexes Created', 
        status: 'WARN', 
        message: `Expected 2+ indexes, found ${indexes.length}` 
      });
    }
  } catch (error) {
    verifications.push({ name: 'Indexes Created', status: 'FAIL', error: error.message });
  }
  
  // Verify 3: Existing data intact
  try {
    const count = await prisma.kGEntity.count();
    verifications.push({ 
      name: 'Data Integrity', 
      status: 'PASS', 
      message: `${count} entities found` 
    });
  } catch (error) {
    verifications.push({ name: 'Data Integrity', status: 'FAIL', error: error.message });
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
    throw new Error(`Migration verification failed: ${failures.length} check(s) failed`);
  }
  
  return verifications;
}

/**
 * Main deployment function
 */
async function deployMigration() {
  log('='.repeat(80), 'INFO');
  log('Anchor-Driven Entity Synthesis - Database Migration Deployment', 'INFO');
  log('='.repeat(80), 'INFO');
  log(`Environment: ${options.environment}`, 'INFO');
  log(`Dry Run: ${options.dryRun}`, 'INFO');
  log(`Force: ${options.force}`, 'INFO');
  log('', 'INFO');
  
  try {
    // Step 1: Pre-flight checks
    await preFlightChecks();
    log('', 'INFO');
    
    // Step 2: Confirmation
    if (!options.force && !options.dryRun) {
      log('⚠️  WARNING: This will modify the database schema!', 'WARN');
      log('Press Ctrl+C to cancel, or wait 5 seconds to continue...', 'WARN');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Step 3: Create backup
    const backupFile = await createBackup();
    log('', 'INFO');
    
    // Step 4: Apply migration
    const migrationResult = await applyMigration();
    log('', 'INFO');
    
    // Step 5: Verify migration
    if (!options.dryRun) {
      await verifyMigration();
      log('', 'INFO');
    }
    
    // Success
    log('='.repeat(80), 'INFO');
    log('✓ Migration deployment completed successfully!', 'INFO');
    log('='.repeat(80), 'INFO');
    
    if (backupFile) {
      log(`Backup saved to: ${backupFile}`, 'INFO');
    }
    
    if (options.dryRun) {
      log('DRY RUN: No changes were made to the database', 'INFO');
    }
    
    log('', 'INFO');
    log('Next steps:', 'INFO');
    log('  1. Verify application functionality', 'INFO');
    log('  2. Monitor performance metrics', 'INFO');
    log('  3. Check logs for any issues', 'INFO');
    
    process.exit(0);
  } catch (error) {
    log('='.repeat(80), 'ERROR');
    log('✗ Migration deployment failed!', 'ERROR');
    log('='.repeat(80), 'ERROR');
    log(`Error: ${error.message}`, 'ERROR');
    log('', 'ERROR');
    log('Rollback instructions:', 'ERROR');
    log('  1. Stop the application', 'ERROR');
    log('  2. Run: node rollback-migration.js', 'ERROR');
    log('  3. Restore from backup if needed', 'ERROR');
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run deployment
deployMigration();
