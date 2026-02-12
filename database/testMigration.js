/**
 * Test script for database migration
 * This script tests the migration without modifying the production database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { applyMigration, rollbackMigration } = require('./migrateDocumentsTable');

const TEST_DB_PATH = path.join(__dirname, '../data/users_test.db');

/**
 * Create a test database with the original schema
 */
function createTestDatabase() {
  return new Promise((resolve, reject) => {
    // Remove test database if it exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) {
        return reject(err);
      }

      // Create original documents table (without hash and size columns)
      db.run(`CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(50) DEFAULT 'document',
        file_type VARCHAR(50) DEFAULT '.md',
        metadata TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          return reject(err);
        }

        // Insert test data
        db.run(`INSERT INTO documents (user_id, title, content, type, file_type) 
                VALUES (1, 'test.pdf', 'Test content', 'document', '.pdf')`, (err) => {
          if (err) {
            return reject(err);
          }
          console.log('✓ Test database created with sample data');
          resolve(db);
        });
      });
    });
  });
}

/**
 * Verify table schema
 */
function verifySchema(db, shouldHaveNewColumns) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(documents)`, (err, columns) => {
      if (err) {
        return reject(err);
      }

      const columnNames = columns.map(col => col.name);
      const hasHash = columnNames.includes('hash');
      const hasSize = columnNames.includes('size');

      console.log('\nCurrent columns:', columnNames.join(', '));

      if (shouldHaveNewColumns) {
        if (hasHash && hasSize) {
          console.log('✓ Schema verification passed: hash and size columns exist');
          resolve(true);
        } else {
          reject(new Error('Schema verification failed: missing hash or size columns'));
        }
      } else {
        if (!hasHash && !hasSize) {
          console.log('✓ Schema verification passed: hash and size columns do not exist');
          resolve(true);
        } else {
          reject(new Error('Schema verification failed: hash or size columns still exist'));
        }
      }
    });
  });
}

/**
 * Verify indexes
 */
function verifyIndexes(db, shouldHaveIndexes) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='documents'`, (err, indexes) => {
      if (err) {
        return reject(err);
      }

      const indexNames = indexes.map(idx => idx.name);
      const hasHashIndex = indexNames.includes('idx_documents_hash');
      const hasUserFilenameIndex = indexNames.includes('idx_documents_user_filename');

      console.log('Current indexes:', indexNames.join(', '));

      if (shouldHaveIndexes) {
        if (hasHashIndex && hasUserFilenameIndex) {
          console.log('✓ Index verification passed: both indexes exist');
          resolve(true);
        } else {
          reject(new Error('Index verification failed: missing indexes'));
        }
      } else {
        if (!hasHashIndex && !hasUserFilenameIndex) {
          console.log('✓ Index verification passed: indexes do not exist');
          resolve(true);
        } else {
          reject(new Error('Index verification failed: indexes still exist'));
        }
      }
    });
  });
}

/**
 * Verify data integrity
 */
function verifyData(db) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM documents`, (err, row) => {
      if (err) {
        return reject(err);
      }

      if (row.count === 1) {
        console.log('✓ Data integrity verified: test record still exists');
        resolve(true);
      } else {
        reject(new Error(`Data integrity failed: expected 1 record, found ${row.count}`));
      }
    });
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== Database Migration Test Suite ===\n');

  let db;

  try {
    // Test 1: Create test database
    console.log('Test 1: Creating test database...');
    db = await createTestDatabase();
    await verifySchema(db, false);
    await verifyIndexes(db, false);

    // Test 2: Apply migration
    console.log('\nTest 2: Applying migration...');
    await applyMigration(db);
    await verifySchema(db, true);
    await verifyIndexes(db, true);
    await verifyData(db);

    // Test 3: Rollback migration
    console.log('\nTest 3: Rolling back migration...');
    await rollbackMigration(db);
    await verifySchema(db, false);
    await verifyIndexes(db, false);
    await verifyData(db);

    // Test 4: Re-apply migration (test idempotency)
    console.log('\nTest 4: Re-applying migration (idempotency test)...');
    await applyMigration(db);
    await verifySchema(db, true);
    await verifyIndexes(db, true);
    await verifyData(db);

    console.log('\n=== All tests passed! ===');

    // Cleanup
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
        console.log('✓ Test database cleaned up');
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    if (db) {
      db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    process.exit(1);
  }
}

// Run tests
runTests();
