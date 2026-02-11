/**
 * Anchor Fields Data Migration Script
 * 
 * This script migrates existing KGEntity records to include anchorFingerprint and anchorFields.
 * It attempts to infer anchor data from existing entity information.
 * 
 * Usage:
 *   node prisma/migrations/add_anchor_fields.js [--dry-run] [--batch-size=100] [--verbose]
 * 
 * Options:
 *   --dry-run       Simulate migration without making changes
 *   --batch-size=N  Process N entities at a time (default: 100)
 *   --verbose       Show detailed logging
 */

const { PrismaClient } = require('@prisma/client');

// Import anchor generation utilities
const { generateAnchorFingerprint, generateEntityId } = require('../../kg/entity/anchor_generator');
const { extractAnchorFieldsFromEntity } = require('./add_anchor_fields_helpers');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  batchSize: 100
};

// Parse batch size
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
if (batchSizeArg) {
  options.batchSize = parseInt(batchSizeArg.split('=')[1], 10);
}

const prisma = new PrismaClient();

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Verbose log (only shown if --verbose flag is set)
 */
function vlog(message, level = 'DEBUG') {
  if (options.verbose) {
    log(message, level);
  }
}

/**
 * Infer anchor fingerprint from existing entity data
 * 
 * Strategy:
 * 1. Parse the entity's schemas field to get schema information
 * 2. Load the schema definition from database
 * 3. Extract anchor fields from entity attributes
 * 4. Generate anchor fingerprint using anchor_generator
 * 
 * @param {Object} entity - KGEntity record
 * @returns {Promise<Object|null>} { anchorFingerprint, anchorFields } or null if cannot infer
 */
async function inferAnchorFromEntity(entity) {
  try {
    // Parse schemas field
    const schemas = JSON.parse(entity.schemas || '[]');
    
    if (schemas.length === 0) {
      vlog(`Entity ${entity.id} has no schemas, skipping`, 'WARN');
      return null;
    }
    
    // Get the first (primary) schema
    const primarySchema = schemas[0];
    const schemaName = primarySchema.schema_name || primarySchema.name;
    
    if (!schemaName) {
      vlog(`Entity ${entity.id} has invalid schema data, skipping`, 'WARN');
      return null;
    }
    
    // Load schema definition from database
    const schemaRecord = await prisma.schema.findFirst({
      where: { name: schemaName }
    });
    
    if (!schemaRecord) {
      vlog(`Schema ${schemaName} not found in database, skipping entity ${entity.id}`, 'WARN');
      return null;
    }
    
    // Parse schema configuration
    const anchorFieldsConfig = schemaRecord.anchorFields 
      ? JSON.parse(schemaRecord.anchorFields) 
      : null;
    
    if (!anchorFieldsConfig || anchorFieldsConfig.length === 0) {
      vlog(`Schema ${schemaName} has no anchor_fields configured, skipping entity ${entity.id}`, 'WARN');
      return null;
    }
    
    // Parse entity attributes
    const attributes = JSON.parse(entity.attributes || '{}');
    
    // Create a schema instance-like object for anchor generation
    const schemaInstance = {
      entity_type: entity.type,
      schema_name: schemaName,
      schema_id: schemaRecord.id,
      fields: attributes,
      confidence: entity.confidence
    };
    
    // Parse core fields for schema definition
    const coreFields = JSON.parse(schemaRecord.coreFields || '[]');
    
    const schemaDefinition = {
      schema_name: schemaName,
      schema_id: schemaRecord.id,
      entity_type: schemaRecord.entityType,
      core_fields: coreFields,
      anchor_fields: anchorFieldsConfig
    };
    
    // Generate anchor fingerprint
    const anchorFingerprint = generateAnchorFingerprint(schemaInstance, schemaDefinition);
    
    // Extract anchor field values using the dedicated function
    const anchorFields = extractAnchorFieldsFromEntity(entity, schemaDefinition);
    
    vlog(`Generated anchor for entity ${entity.id}: ${anchorFingerprint}`, 'DEBUG');
    
    return {
      anchorFingerprint,
      anchorFields: JSON.stringify(anchorFields)
    };
    
  } catch (error) {
    vlog(`Error inferring anchor for entity ${entity.id}: ${error.message}`, 'ERROR');
    return null;
  }
}

/**
 * Migrate a batch of entities
 * 
 * @param {Array<Object>} entities - Batch of entities to migrate
 * @returns {Promise<Object>} Migration statistics
 */
async function migrateBatch(entities) {
  const stats = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const entity of entities) {
    stats.processed++;
    
    try {
      // Skip if already has anchor fingerprint
      if (entity.anchorFingerprint) {
        vlog(`Entity ${entity.id} already has anchor fingerprint, skipping`, 'DEBUG');
        stats.skipped++;
        continue;
      }
      
      // Infer anchor data
      const anchorData = await inferAnchorFromEntity(entity);
      
      if (!anchorData) {
        vlog(`Could not infer anchor for entity ${entity.id}, skipping`, 'WARN');
        stats.skipped++;
        continue;
      }
      
      // Update entity
      if (!options.dryRun) {
        await prisma.kGEntity.update({
          where: { id: entity.id },
          data: {
            anchorFingerprint: anchorData.anchorFingerprint,
            anchorFields: anchorData.anchorFields
          }
        });
        
        vlog(`Updated entity ${entity.id} with anchor: ${anchorData.anchorFingerprint}`, 'DEBUG');
      } else {
        vlog(`[DRY RUN] Would update entity ${entity.id} with anchor: ${anchorData.anchorFingerprint}`, 'DEBUG');
      }
      
      stats.updated++;
      
    } catch (error) {
      log(`Error migrating entity ${entity.id}: ${error.message}`, 'ERROR');
      stats.errors++;
    }
  }
  
  return stats;
}

/**
 * Main migration function
 */
async function migrateAnchorFields() {
  log('='.repeat(80), 'INFO');
  log('Anchor Fields Data Migration', 'INFO');
  log('='.repeat(80), 'INFO');
  log(`Dry Run: ${options.dryRun}`, 'INFO');
  log(`Batch Size: ${options.batchSize}`, 'INFO');
  log(`Verbose: ${options.verbose}`, 'INFO');
  log('', 'INFO');
  
  try {
    // Step 1: Count total entities
    const totalCount = await prisma.kGEntity.count();
    log(`Total entities in database: ${totalCount}`, 'INFO');
    
    if (totalCount === 0) {
      log('No entities to migrate', 'INFO');
      return;
    }
    
    // Step 2: Count entities without anchor fingerprint
    const needsMigrationCount = await prisma.kGEntity.count({
      where: {
        anchorFingerprint: null
      }
    });
    
    log(`Entities needing migration: ${needsMigrationCount}`, 'INFO');
    
    if (needsMigrationCount === 0) {
      log('All entities already have anchor fingerprints', 'INFO');
      return;
    }
    
    log('', 'INFO');
    
    // Step 3: Process in batches
    const totalStats = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
    
    let offset = 0;
    let batchNumber = 1;
    
    while (offset < needsMigrationCount) {
      log(`Processing batch ${batchNumber} (offset: ${offset})...`, 'INFO');
      
      // Fetch batch
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: null
        },
        take: options.batchSize,
        skip: offset
      });
      
      if (entities.length === 0) {
        break;
      }
      
      // Migrate batch
      const batchStats = await migrateBatch(entities);
      
      // Update totals
      totalStats.processed += batchStats.processed;
      totalStats.updated += batchStats.updated;
      totalStats.skipped += batchStats.skipped;
      totalStats.errors += batchStats.errors;
      
      log(`Batch ${batchNumber} complete: ${batchStats.updated} updated, ${batchStats.skipped} skipped, ${batchStats.errors} errors`, 'INFO');
      
      offset += options.batchSize;
      batchNumber++;
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Step 4: Summary
    log('', 'INFO');
    log('='.repeat(80), 'INFO');
    log('Migration Summary', 'INFO');
    log('='.repeat(80), 'INFO');
    log(`Total Processed: ${totalStats.processed}`, 'INFO');
    log(`Successfully Updated: ${totalStats.updated}`, 'INFO');
    log(`Skipped: ${totalStats.skipped}`, 'INFO');
    log(`Errors: ${totalStats.errors}`, 'INFO');
    
    if (options.dryRun) {
      log('', 'INFO');
      log('DRY RUN: No changes were made to the database', 'INFO');
    }
    
    // Step 5: Verification
    if (!options.dryRun && totalStats.updated > 0) {
      log('', 'INFO');
      log('Verifying migration...', 'INFO');
      
      const withAnchor = await prisma.kGEntity.count({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      
      const withoutAnchor = await prisma.kGEntity.count({
        where: {
          anchorFingerprint: null
        }
      });
      
      log(`Entities with anchor fingerprint: ${withAnchor}`, 'INFO');
      log(`Entities without anchor fingerprint: ${withoutAnchor}`, 'INFO');
      
      const coverage = totalCount > 0 ? ((withAnchor / totalCount) * 100).toFixed(2) : 0;
      log(`Anchor coverage: ${coverage}%`, 'INFO');
    }
    
    log('', 'INFO');
    log('✓ Migration completed successfully!', 'INFO');
    
    if (totalStats.errors > 0) {
      log('', 'WARN');
      log(`⚠️  ${totalStats.errors} entities had errors during migration`, 'WARN');
      log('Review the logs above for details', 'WARN');
    }
    
    if (totalStats.skipped > 0) {
      log('', 'INFO');
      log(`ℹ️  ${totalStats.skipped} entities were skipped`, 'INFO');
      log('Common reasons:', 'INFO');
      log('  - Schema not found in database', 'INFO');
      log('  - Schema has no anchor_fields configured', 'INFO');
      log('  - Entity has no schema information', 'INFO');
      log('  - Missing required anchor field values', 'INFO');
    }
    
    process.exit(0);
    
  } catch (error) {
    log('='.repeat(80), 'ERROR');
    log('✗ Migration failed!', 'ERROR');
    log('='.repeat(80), 'ERROR');
    log(`Error: ${error.message}`, 'ERROR');
    log(error.stack, 'ERROR');
    
    process.exit(1);
    
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAnchorFields();
