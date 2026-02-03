/**
 * Schema Startup Check Module
 * 
 * Automatically checks and imports schemas on system startup.
 * Ensures all 250 schemas from SchemaList.md are loaded in the database.
 * 
 * Validates: Requirements 17.16, 17.17, 17.18, 17.19, 17.20
 */

const path = require('path');
const schemaManager = require('./schema_manager');
const schemaLoader = require('./schema_loader');

// Configuration
const EXPECTED_SCHEMA_COUNT = 250;
const SCHEMA_LIST_PATH = path.join(process.cwd(), 'SchemaList.md');
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Check if schemas need to be imported
 * @returns {Promise<Object>} Check result with status and details
 */
async function checkSchemas() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('Schema Startup Check');
    console.log('='.repeat(60));
    
    // Count existing schemas in database
    const currentCount = await schemaManager.countSchemas();
    console.log(`Current schema count in database: ${currentCount}`);
    console.log(`Expected schema count: ${EXPECTED_SCHEMA_COUNT}`);
    
    if (currentCount >= EXPECTED_SCHEMA_COUNT) {
      console.log('✅ Schema check passed: All schemas are loaded');
      console.log('='.repeat(60) + '\n');
      return {
        status: 'ok',
        currentCount,
        expectedCount: EXPECTED_SCHEMA_COUNT,
        message: 'All schemas are loaded'
      };
    }
    
    console.log(`⚠️  Schema count insufficient: ${currentCount}/${EXPECTED_SCHEMA_COUNT}`);
    console.log('Need to import schemas from SchemaList.md');
    
    return {
      status: 'insufficient',
      currentCount,
      expectedCount: EXPECTED_SCHEMA_COUNT,
      message: `Only ${currentCount} schemas found, need to import`
    };
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
    return {
      status: 'error',
      currentCount: 0,
      expectedCount: EXPECTED_SCHEMA_COUNT,
      message: error.message,
      error
    };
  }
}

/**
 * Import schemas with retry mechanism
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Object>} Import result
 */
async function importSchemasWithRetry(attempt = 1) {
  try {
    console.log(`\nAttempt ${attempt}/${MAX_RETRY_ATTEMPTS}: Importing schemas...`);
    console.log(`Reading from: ${SCHEMA_LIST_PATH}`);
    
    // Import schemas with progress tracking
    const stats = await schemaLoader.loadAndImportSchemas(SCHEMA_LIST_PATH, {
      skipExisting: true,
      updateExisting: false
    });
    
    // Validate import result
    const finalCount = await schemaManager.countSchemas();
    
    console.log('\nImport Statistics:');
    console.log(`  Total processed: ${stats.total}`);
    console.log(`  ✅ Created: ${stats.created}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  ✏️  Updated: ${stats.updated}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  Final count in database: ${finalCount}`);
    
    if (stats.errors && stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      stats.errors.slice(0, 5).forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.schema_name}: ${err.error}`);
      });
      if (stats.errors.length > 5) {
        console.log(`  ... and ${stats.errors.length - 5} more errors`);
      }
    }
    
    // Check if we reached the expected count
    if (finalCount >= EXPECTED_SCHEMA_COUNT) {
      console.log(`\n✅ Import successful: ${finalCount} schemas loaded`);
      return {
        success: true,
        stats,
        finalCount,
        attempt
      };
    } else {
      console.log(`\n⚠️  Import incomplete: ${finalCount}/${EXPECTED_SCHEMA_COUNT} schemas`);
      
      // Retry if we haven't reached max attempts
      if (attempt < MAX_RETRY_ATTEMPTS) {
        console.log(`Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        return await importSchemasWithRetry(attempt + 1);
      } else {
        throw new Error(`Failed to import all schemas after ${MAX_RETRY_ATTEMPTS} attempts. Final count: ${finalCount}/${EXPECTED_SCHEMA_COUNT}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Import attempt ${attempt} failed:`, error.message);
    
    // Retry if we haven't reached max attempts
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.log(`Retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
      return await importSchemasWithRetry(attempt + 1);
    } else {
      throw error;
    }
  }
}

/**
 * Perform startup schema check and auto-import if needed
 * @returns {Promise<Object>} Check and import result
 */
async function performStartupCheck() {
  try {
    // Check current schema status
    const checkResult = await checkSchemas();
    
    if (checkResult.status === 'ok') {
      return {
        success: true,
        action: 'none',
        message: 'All schemas are already loaded',
        schemaCount: checkResult.currentCount
      };
    }
    
    if (checkResult.status === 'error') {
      console.error('⚠️  Schema check encountered an error, but system will continue');
      return {
        success: false,
        action: 'check_failed',
        message: checkResult.message,
        error: checkResult.error
      };
    }
    
    // Import schemas if insufficient
    console.log('\n🔄 Starting automatic schema import...');
    
    const importResult = await importSchemasWithRetry();
    
    console.log('\n✅ Schema startup check completed successfully');
    console.log(`Final schema count: ${importResult.finalCount}/${EXPECTED_SCHEMA_COUNT}`);
    console.log('='.repeat(60) + '\n');
    
    return {
      success: true,
      action: 'imported',
      message: `Successfully imported schemas (${importResult.finalCount} total)`,
      schemaCount: importResult.finalCount,
      stats: importResult.stats,
      attempts: importResult.attempt
    };
    
  } catch (error) {
    console.error('\n❌ Schema startup check failed:', error.message);
    console.error('System will continue, but schema functionality may be limited');
    console.log('='.repeat(60) + '\n');
    
    // Trigger alert (in production, this would send notifications)
    triggerAlert({
      type: 'schema_import_failure',
      message: error.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      action: 'import_failed',
      message: error.message,
      error
    };
  }
}

/**
 * Trigger alert for schema import failure
 * @param {Object} alert - Alert details
 */
function triggerAlert(alert) {
  // In production, this would send notifications via email, Slack, etc.
  console.error('\n🚨 ALERT: Schema Import Failure');
  console.error(`Type: ${alert.type}`);
  console.error(`Message: ${alert.message}`);
  console.error(`Timestamp: ${alert.timestamp}`);
  console.error('Please check SchemaList.md file and database connection\n');
}

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get schema status (for API endpoint)
 * @returns {Promise<Object>} Schema status
 */
async function getSchemaStatus() {
  try {
    const currentCount = await schemaManager.countSchemas();
    const status = currentCount >= EXPECTED_SCHEMA_COUNT ? 'healthy' : 'insufficient';
    
    return {
      status,
      currentCount,
      expectedCount: EXPECTED_SCHEMA_COUNT,
      percentage: Math.round((currentCount / EXPECTED_SCHEMA_COUNT) * 100),
      message: status === 'healthy' 
        ? 'All schemas are loaded' 
        : `Only ${currentCount}/${EXPECTED_SCHEMA_COUNT} schemas loaded`
    };
  } catch (error) {
    return {
      status: 'error',
      currentCount: 0,
      expectedCount: EXPECTED_SCHEMA_COUNT,
      percentage: 0,
      message: error.message,
      error
    };
  }
}

/**
 * Force reimport all schemas (for API endpoint)
 * @returns {Promise<Object>} Reimport result
 */
async function forceReimport() {
  try {
    console.log('\n🔄 Force reimporting all schemas...');
    
    const importResult = await importSchemasWithRetry();
    
    return {
      success: true,
      message: 'Schemas reimported successfully',
      schemaCount: importResult.finalCount,
      stats: importResult.stats
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

module.exports = {
  performStartupCheck,
  checkSchemas,
  importSchemasWithRetry,
  getSchemaStatus,
  forceReimport,
  EXPECTED_SCHEMA_COUNT
};
