#!/usr/bin/env node

/**
 * CLI Script to Load Schemas from SchemaList.md
 * 
 * Usage:
 *   node kg/schema/load_schemas.js [options]
 * 
 * Options:
 *   --file <path>      Path to SchemaList.md file (default: ./SchemaList.md)
 *   --skip-existing    Skip schemas that already exist (default: true)
 *   --update-existing  Update existing schemas (default: false)
 *   --help             Show help message
 * 
 * Examples:
 *   node kg/schema/load_schemas.js
 *   node kg/schema/load_schemas.js --file ./data/SchemaList.md
 *   node kg/schema/load_schemas.js --update-existing
 */

const schemaLoader = require('./schema_loader');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    filePath: null,
    skipExisting: true,
    updateExisting: false,
    showHelp: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--file':
        options.filePath = args[++i];
        break;
      case '--skip-existing':
        options.skipExisting = true;
        break;
      case '--update-existing':
        options.updateExisting = true;
        options.skipExisting = false;
        break;
      case '--help':
      case '-h':
        options.showHelp = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        options.showHelp = true;
    }
  }
  
  return options;
}

// Show help message
function showHelp() {
  console.log(`
Schema Loader CLI

Usage:
  node kg/schema/load_schemas.js [options]

Options:
  --file <path>      Path to SchemaList.md file (default: ./SchemaList.md)
  --skip-existing    Skip schemas that already exist (default: true)
  --update-existing  Update existing schemas (default: false)
  --help, -h         Show this help message

Examples:
  # Load schemas from default location
  node kg/schema/load_schemas.js

  # Load schemas from custom file
  node kg/schema/load_schemas.js --file ./data/SchemaList.md

  # Update existing schemas
  node kg/schema/load_schemas.js --update-existing

  # Load schemas and skip existing ones
  node kg/schema/load_schemas.js --skip-existing
`);
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }
  
  try {
    console.log('='.repeat(60));
    console.log('Schema Loader');
    console.log('='.repeat(60));
    console.log();
    
    // Load and import schemas
    const stats = await schemaLoader.loadAndImportSchemas(
      options.filePath,
      {
        skipExisting: options.skipExisting,
        updateExisting: options.updateExisting
      }
    );
    
    // Exit with appropriate code
    const exitCode = stats.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs, showHelp };
