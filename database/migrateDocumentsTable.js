const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DB_PATH } = require('./initUserDB');

/**
 * Migration script to add hash and size columns to documents table
 * and create indexes for duplicate detection optimization
 */

/**
 * Apply migration - add new columns and indexes
 * @param {sqlite3.Database} db - Database connection
 * @returns {Promise<void>}
 */
function applyMigration(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('Starting migration: Adding hash and size columns to documents table...');

      // Add hash column
      db.run(`ALTER TABLE documents ADD COLUMN hash VARCHAR(64)`, (err) => {
        if (err) {
          // Column might already exist, check if it's a duplicate column error
          if (err.message.includes('duplicate column name')) {
            console.log('Column "hash" already exists, skipping...');
          } else {
            console.error('Error adding hash column:', err.message);
            return reject(err);
          }
        } else {
          console.log('✓ Added hash column');
        }
      });

      // Add size column
      db.run(`ALTER TABLE documents ADD COLUMN size INTEGER`, (err) => {
        if (err) {
          // Column might already exist, check if it's a duplicate column error
          if (err.message.includes('duplicate column name')) {
            console.log('Column "size" already exists, skipping...');
          } else {
            console.error('Error adding size column:', err.message);
            return reject(err);
          }
        } else {
          console.log('✓ Added size column');
        }
      });

      // Create index on hash column for fast duplicate detection
      db.run(`CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash)`, (err) => {
        if (err) {
          console.error('Error creating hash index:', err.message);
          return reject(err);
        }
        console.log('✓ Created index on hash column');
      });

      // Create composite index on user_id and title for filename duplicate detection
      db.run(`CREATE INDEX IF NOT EXISTS idx_documents_user_filename ON documents(user_id, title)`, (err) => {
        if (err) {
          console.error('Error creating user_filename index:', err.message);
          return reject(err);
        }
        console.log('✓ Created index on user_id and title columns');
        console.log('Migration completed successfully!');
        resolve();
      });
    });
  });
}

/**
 * Rollback migration - remove columns and indexes
 * Note: SQLite does not support DROP COLUMN directly, so we need to recreate the table
 * @param {sqlite3.Database} db - Database connection
 * @returns {Promise<void>}
 */
function rollbackMigration(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('Starting rollback: Removing hash and size columns from documents table...');

      // Drop indexes first
      db.run(`DROP INDEX IF EXISTS idx_documents_hash`, (err) => {
        if (err) {
          console.error('Error dropping hash index:', err.message);
          return reject(err);
        }
        console.log('✓ Dropped hash index');
      });

      db.run(`DROP INDEX IF EXISTS idx_documents_user_filename`, (err) => {
        if (err) {
          console.error('Error dropping user_filename index:', err.message);
          return reject(err);
        }
        console.log('✓ Dropped user_filename index');
      });

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      // Step 1: Create new table without hash and size columns
      db.run(`CREATE TABLE IF NOT EXISTS documents_backup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(50) DEFAULT 'document',
        file_type VARCHAR(50) DEFAULT '.md',
        metadata TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          console.error('Error creating backup table:', err.message);
          return reject(err);
        }
        console.log('✓ Created backup table');
      });

      // Step 2: Copy data from old table to new table (excluding hash and size)
      db.run(`INSERT INTO documents_backup (id, user_id, title, content, type, file_type, metadata, tags, created_at, updated_at)
        SELECT id, user_id, title, content, type, file_type, metadata, tags, created_at, updated_at
        FROM documents`, (err) => {
        if (err) {
          console.error('Error copying data to backup table:', err.message);
          return reject(err);
        }
        console.log('✓ Copied data to backup table');
      });

      // Step 3: Drop old table
      db.run(`DROP TABLE documents`, (err) => {
        if (err) {
          console.error('Error dropping old documents table:', err.message);
          return reject(err);
        }
        console.log('✓ Dropped old documents table');
      });

      // Step 4: Rename backup table to documents
      db.run(`ALTER TABLE documents_backup RENAME TO documents`, (err) => {
        if (err) {
          console.error('Error renaming backup table:', err.message);
          return reject(err);
        }
        console.log('✓ Renamed backup table to documents');
        console.log('Rollback completed successfully!');
        resolve();
      });
    });
  });
}

/**
 * Run migration from command line
 */
function runMigration() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || (command !== 'up' && command !== 'down')) {
    console.log('Usage: node migrateDocumentsTable.js [up|down]');
    console.log('  up   - Apply migration (add columns and indexes)');
    console.log('  down - Rollback migration (remove columns and indexes)');
    process.exit(1);
  }

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    }
    console.log('Connected to the SQLite database.');
  });

  const migrationPromise = command === 'up' ? applyMigration(db) : rollbackMigration(db);

  migrationPromise
    .then(() => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          process.exit(1);
        }
        console.log('Database connection closed.');
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      db.close();
      process.exit(1);
    });
}

// Export functions for testing and programmatic use
module.exports = {
  applyMigration,
  rollbackMigration,
  runMigration
};

// Run migration if called directly
if (require.main === module) {
  runMigration();
}
