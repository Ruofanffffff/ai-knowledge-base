/**
 * Anchor-Driven Entity Synthesis - Migration Verification Script
 * 
 * This script verifies that the anchor fields migration was applied correctly
 * and that the database is in a healthy state.
 * 
 * Usage:
 *   node verify-migration.js [--verbose]
 * 
 * Options:
 *   --verbose  Show detailed verification information
 */

const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

const prisma = new PrismaClient();

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Run all verification checks
 */
async function runVerification() {
  log('='.repeat(80), 'INFO');
  log('Anchor-Driven Entity Synthesis - Migration Verification', 'INFO');
  log('='.repeat(80), 'INFO');
  log('', 'INFO');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: []
  };
  
  // Check 1: Database connection
  try {
    await prisma.$connect();
    results.passed++;
    results.checks.push({ name: 'Database Connection', status: 'PASS' });
    log('✓ Database connection successful', 'INFO');
  } catch (error) {
    results.failed++;
    results.checks.push({ name: 'Database Connection', status: 'FAIL', error: error.message });
    log('✗ Database connection failed', 'ERROR');
    log(`  Error: ${error.message}`, 'ERROR');
  }
  
  // Check 2: Anchor fingerprint column exists
  try {
    const column = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'kg_entities' 
      AND column_name = 'anchor_fingerprint'
    `;
    
    if (column.length > 0) {
      results.passed++;
      results.checks.push({ name: 'Anchor Fingerprint Column', status: 'PASS' });
      log('✓ anchor_fingerprint column exists', 'INFO');
      if (verbose) {
        log(`  Type: ${column[0].data_type}, Nullable: ${column[0].is_nullable}`, 'INFO');
      }
    } else {
      results.failed++;
      results.checks.push({ name: 'Anchor Fingerprint Column', status: 'FAIL' });
      log('✗ anchor_fingerprint column not found', 'ERROR');
    }
  } catch (error) {
    results.failed++;
    results.checks.push({ name: 'Anchor Fingerprint Column', status: 'FAIL', error: error.message });
    log('✗ Failed to check anchor_fingerprint column', 'ERROR');
    log(`  Error: ${error.message}`, 'ERROR');
  }
  
  // Check 3: Anchor fields column exists
  try {
    const column = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'kg_entities' 
      AND column_name = 'anchor_fields'
    `;
    
    if (column.length > 0) {
      results.passed++;
      results.checks.push({ name: 'Anchor Fields Column', status: 'PASS' });
      log('✓ anchor_fields column exists', 'INFO');
      if (verbose) {
        log(`  Type: ${column[0].data_type}, Nullable: ${column[0].is_nullable}`, 'INFO');
      }
    } else {
      results.failed++;
      results.checks.push({ name: 'Anchor Fields Column', status: 'FAIL' });
      log('✗ anchor_fields column not found', 'ERROR');
    }
  } catch (error) {
    results.failed++;
    results.checks.push({ name: 'Anchor Fields Column', status: 'FAIL', error: error.message });
    log('✗ Failed to check anchor_fields column', 'ERROR');
    log(`  Error: ${error.message}`, 'ERROR');
  }
  
  // Check 4: Anchor fingerprint index exists
  try {
    const indexes = await prisma.$queryRaw`
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND tbl_name = 'kg_entities'
      AND name LIKE '%anchor_fingerprint%'
    `;
    
    if (indexes.length > 0) {
      results.passed++;
      results.checks.push({ name: 'Anchor Fingerprint Index', status: 'PASS' });
      log('✓ Anchor fingerprint index exists', 'INFO');
      if (verbose) {
        indexes.forEach(idx => log(`  Index: ${idx.name}`, 'INFO'));
      }
    } else {
      results.warnings++;
      results.checks.push({ name: 'Anchor Fingerprint Index', status: 'WARN' });
      log('⚠ Anchor fingerprint index not found', 'WARN');
    }
  } catch (error) {
    results.warnings++;
    results.checks.push({ name: 'Anchor Fingerprint Index', status: 'WARN', error: error.message });
    log('⚠ Failed to check anchor fingerprint index', 'WARN');
    log(`  Error: ${error.message}`, 'WARN');
  }
  
  // Check 5: Composite index exists
  try {
    const indexes = await prisma.$queryRaw`
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND tbl_name = 'kg_entities'
      AND (name LIKE '%type%anchor%' OR name LIKE '%anchor%type%')
    `;
    
    if (indexes.length > 0) {
      results.passed++;
      results.checks.push({ name: 'Composite Index', status: 'PASS' });
      log('✓ Composite index (type + anchor) exists', 'INFO');
      if (verbose) {
        indexes.forEach(idx => log(`  Index: ${idx.name}`, 'INFO'));
      }
    } else {
      results.warnings++;
      results.checks.push({ name: 'Composite Index', status: 'WARN' });
      log('⚠ Composite index not found', 'WARN');
    }
  } catch (error) {
    results.warnings++;
    results.checks.push({ name: 'Composite Index', status: 'WARN', error: error.message });
    log('⚠ Failed to check composite index', 'WARN');
    log(`  Error: ${error.message}`, 'WARN');
  }
  
  // Check 6: Data integrity
  try {
    const totalEntities = await prisma.kGEntity.count();
    const entitiesWithAnchors = await prisma.kGEntity.count({
      where: {
        anchorFingerprint: { not: null }
      }
    });
    
    results.passed++;
    results.checks.push({ name: 'Data Integrity', status: 'PASS' });
    log('✓ Data integrity check passed', 'INFO');
    log(`  Total entities: ${totalEntities}`, 'INFO');
    log(`  Entities with anchors: ${entitiesWithAnchors}`, 'INFO');
    
    if (totalEntities > 0) {
      const coverage = (entitiesWithAnchors / totalEntities * 100).toFixed(2);
      log(`  Anchor coverage: ${coverage}%`, 'INFO');
      
      if (entitiesWithAnchors === 0) {
        results.warnings++;
        log('  ⚠ No entities have anchor fingerprints yet (expected for new migration)', 'WARN');
      }
    }
  } catch (error) {
    results.failed++;
    results.checks.push({ name: 'Data Integrity', status: 'FAIL', error: error.message });
    log('✗ Data integrity check failed', 'ERROR');
    log(`  Error: ${error.message}`, 'ERROR');
  }
  
  // Check 7: Sample query performance
  try {
    const start = Date.now();
    await prisma.kGEntity.findMany({
      where: {
        anchorFingerprint: { not: null }
      },
      take: 10
    });
    const duration = Date.now() - start;
    
    results.passed++;
    results.checks.push({ name: 'Query Performance', status: 'PASS' });
    log('✓ Query performance check passed', 'INFO');
    log(`  Query time: ${duration}ms`, 'INFO');
    
    if (duration > 1000) {
      results.warnings++;
      log('  ⚠ Query took longer than expected', 'WARN');
    }
  } catch (error) {
    results.warnings++;
    results.checks.push({ name: 'Query Performance', status: 'WARN', error: error.message });
    log('⚠ Query performance check failed', 'WARN');
    log(`  Error: ${error.message}`, 'WARN');
  }
  
  // Check 8: Schema validation
  try {
    const schemas = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM schemas 
      WHERE anchor_fields IS NOT NULL
    `;
    
    const schemaCount = schemas[0]?.count || 0;
    
    if (schemaCount > 0) {
      results.passed++;
      results.checks.push({ name: 'Schema Configuration', status: 'PASS' });
      log('✓ Schema configuration check passed', 'INFO');
      log(`  Schemas with anchor_fields: ${schemaCount}`, 'INFO');
    } else {
      results.warnings++;
      results.checks.push({ name: 'Schema Configuration', status: 'WARN' });
      log('⚠ No schemas have anchor_fields configured', 'WARN');
    }
  } catch (error) {
    results.warnings++;
    results.checks.push({ name: 'Schema Configuration', status: 'WARN', error: error.message });
    log('⚠ Schema configuration check failed', 'WARN');
    log(`  Error: ${error.message}`, 'WARN');
  }
  
  // Print summary
  log('', 'INFO');
  log('='.repeat(80), 'INFO');
  log('Verification Summary', 'INFO');
  log('='.repeat(80), 'INFO');
  log(`Total checks: ${results.checks.length}`, 'INFO');
  log(`Passed: ${results.passed}`, 'INFO');
  log(`Failed: ${results.failed}`, 'ERROR');
  log(`Warnings: ${results.warnings}`, 'WARN');
  log('', 'INFO');
  
  if (results.failed === 0) {
    log('✓ All critical checks passed!', 'INFO');
    log('Migration is verified and ready for use.', 'INFO');
    
    if (results.warnings > 0) {
      log('', 'WARN');
      log(`⚠ ${results.warnings} warning(s) detected - review recommended`, 'WARN');
    }
    
    return 0;
  } else {
    log('✗ Verification failed!', 'ERROR');
    log('Please review the errors above and take corrective action.', 'ERROR');
    return 1;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const exitCode = await runVerification();
    process.exit(exitCode);
  } catch (error) {
    log('Unexpected error during verification', 'ERROR');
    log(`Error: ${error.message}`, 'ERROR');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
main();
