#!/usr/bin/env node

/**
 * Initialize Relation Types
 * 
 * Loads relation types from relation_types.json into the database.
 * Supports incremental updates and command-line options.
 * 
 * Usage:
 *   node kg/relation/init_relation_types.js [options]
 * 
 * Options:
 *   --file <path>      Path to relation types JSON file (default: ./relation_types.json)
 *   --update           Update existing relation types
 *   --skip-existing    Skip existing relation types (default)
 *   --force            Force overwrite all relation types
 *   --dry-run          Show what would be done without making changes
 *   --domain <domain>  Only load relation types from specific domain
 *   --help             Show help message
 */

const path = require('path');
const fs = require('fs').promises;
const relationTypeStore = require('./relation_type_store');
const relationTypeLoader = require('./relation_type_loader');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: path.join(__dirname, 'relation_types.json'),
    update: false,
    skipExisting: true,
    force: false,
    dryRun: false,
    domain: null,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--file':
        options.file = args[++i];
        break;
      case '--update':
        options.update = true;
        options.skipExisting = false;
        break;
      case '--skip-existing':
        options.skipExisting = true;
        options.update = false;
        break;
      case '--force':
        options.force = true;
        options.update = true;
        options.skipExisting = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--domain':
        options.domain = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.warn(`Unknown option: ${arg}`);
    }
  }
  
  return options;
}

// Show help message
function showHelp() {
  console.log(`
Initialize Relation Types

Loads relation types from relation_types.json into the database.

Usage:
  node kg/relation/init_relation_types.js [options]

Options:
  --file <path>      Path to relation types JSON file (default: ./relation_types.json)
  --update           Update existing relation types
  --skip-existing    Skip existing relation types (default)
  --force            Force overwrite all relation types
  --dry-run          Show what would be done without making changes
  --domain <domain>  Only load relation types from specific domain
  --help, -h         Show this help message

Examples:
  # Load all relation types (skip existing)
  node kg/relation/init_relation_types.js

  # Update existing relation types
  node kg/relation/init_relation_types.js --update

  # Force overwrite all relation types
  node kg/relation/init_relation_types.js --force

  # Load only life domain relation types
  node kg/relation/init_relation_types.js --domain life

  # Dry run to see what would be done
  node kg/relation/init_relation_types.js --dry-run
  `);
}

// Load relation types from file
async function loadRelationTypes(filePath, domain = null) {
  try {
    const loader = new relationTypeLoader();
    const types = await loader.loadFromFile(filePath);
    
    // Filter by domain if specified
    if (domain) {
      return types.filter(t => t.domain === domain);
    }
    
    return types;
  } catch (error) {
    throw new Error(`Failed to load relation types from ${filePath}: ${error.message}`);
  }
}

// Initialize relation types
async function initializeRelationTypes(options) {
  console.log('Initializing relation types...');
  console.log(`File: ${options.file}`);
  console.log(`Mode: ${options.force ? 'force' : options.update ? 'update' : 'skip-existing'}`);
  if (options.domain) {
    console.log(`Domain filter: ${options.domain}`);
  }
  if (options.dryRun) {
    console.log('DRY RUN - No changes will be made');
  }
  console.log('');
  
  // Load relation types from file
  const types = await loadRelationTypes(options.file, options.domain);
  console.log(`Loaded ${types.length} relation types from file`);
  
  const stats = {
    total: types.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };
  
  // Process each relation type
  for (const relationType of types) {
    try {
      // Check if relation type exists
      const existing = await relationTypeStore.findById(relationType.relationTypeId);
      
      if (existing) {
        if (options.force || options.update) {
          if (!options.dryRun) {
            await relationTypeStore.update(relationType.relationTypeId, relationType);
          }
          stats.updated++;
          console.log(`✓ Updated: ${relationType.relationTypeId} (${relationType.displayName})`);
        } else {
          stats.skipped++;
          console.log(`- Skipped: ${relationType.relationTypeId} (${relationType.displayName}) - already exists`);
        }
      } else {
        if (!options.dryRun) {
          await relationTypeStore.create(relationType);
        }
        stats.created++;
        console.log(`✓ Created: ${relationType.relationTypeId} (${relationType.displayName})`);
      }
    } catch (error) {
      stats.failed++;
      stats.errors.push({
        relationTypeId: relationType.relationTypeId,
        error: error.message
      });
      console.error(`✗ Failed: ${relationType.relationTypeId} - ${error.message}`);
    }
  }
  
  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Total:   ${stats.total}`);
  console.log(`  Created: ${stats.created}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Failed:  ${stats.failed}`);
  
  if (stats.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    stats.errors.forEach(err => {
      console.log(`  - ${err.relationTypeId}: ${err.error}`);
    });
  }
  
  if (options.dryRun) {
    console.log('');
    console.log('DRY RUN - No changes were made');
  }
  
  console.log('='.repeat(60));
  
  return stats;
}

// Verify initialization
async function verifyInitialization() {
  console.log('');
  console.log('Verifying initialization...');
  
  try {
    const stats = await relationTypeStore.getStats();
    
    console.log('Database statistics:');
    console.log(`  Total relation types: ${stats.total}`);
    console.log(`  Active: ${stats.active}`);
    console.log(`  Inactive: ${stats.inactive}`);
    console.log('');
    console.log('By domain:');
    Object.entries(stats.byDomain).forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count}`);
    });
    console.log('');
    console.log('By category:');
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    
    return true;
  } catch (error) {
    console.error('Verification failed:', error.message);
    return false;
  }
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  try {
    // Check if file exists
    try {
      await fs.access(options.file);
    } catch (error) {
      console.error(`Error: File not found: ${options.file}`);
      process.exit(1);
    }
    
    // Initialize relation types
    const stats = await initializeRelationTypes(options);
    
    // Verify if not dry run
    if (!options.dryRun) {
      await verifyInitialization();
    }
    
    // Disconnect from database
    await relationTypeStore.disconnect();
    
    // Exit with appropriate code
    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    
    // Disconnect from database
    try {
      await relationTypeStore.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  initializeRelationTypes,
  loadRelationTypes,
  verifyInitialization
};
