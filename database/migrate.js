#!/usr/bin/env node
/**
 * Database Migration Script
 * 
 * Executes SQL migration files in order.
 * Tracks migration versions to prevent duplicate execution.
 * 
 * Usage: node database/migrate.js [up|down|status]
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Database path
const DB_PATH = path.join(__dirname, '../data/users.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Get database connection
 */
function getDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        return reject(err);
      }
      resolve(db);
    });
  });
}

/**
 * Close database connection
 */
function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Create migrations table if not exists
 */
async function createMigrationsTable(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating migrations table:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Get executed migrations
 */
async function getExecutedMigrations(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT name FROM migrations ORDER BY name', [], (err, rows) => {
      if (err) {
        console.error('Error fetching migrations:', err.message);
        return reject(err);
      }
      resolve(rows.map(row => row.name));
    });
  });
}

/**
 * Record migration execution
 */
async function recordMigration(db, name) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO migrations (name) VALUES (?)', [name], (err) => {
      if (err) {
        console.error('Error recording migration:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Remove migration record
 */
async function removeMigration(db, name) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM migrations WHERE name = ?', [name], (err) => {
      if (err) {
        console.error('Error removing migration:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Execute SQL file
 */
async function executeSqlFile(db, filePath) {
  return new Promise((resolve, reject) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Execute the entire SQL file as a single script
    db.exec(sql, (err) => {
      if (err) {
        console.error('Error executing SQL file:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Get all migration files
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('Migrations directory not found:', MIGRATIONS_DIR);
    return [];
  }
  
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

/**
 * Run pending migrations
 */
async function migrateUp() {
  console.log('='.repeat(60));
  console.log('Running Database Migrations (UP)');
  console.log('='.repeat(60));
  console.log();
  
  const db = await getDatabase();
  
  try {
    // Create migrations table
    await createMigrationsTable(db);
    
    // Get executed migrations
    const executed = await getExecutedMigrations(db);
    console.log(`Executed migrations: ${executed.length}`);
    
    // Get all migration files
    const files = getMigrationFiles();
    console.log(`Total migration files: ${files.length}`);
    console.log();
    
    // Find pending migrations
    const pending = files.filter(file => !executed.includes(file));
    
    if (pending.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }
    
    console.log(`Pending migrations: ${pending.length}`);
    console.log();
    
    // Execute pending migrations
    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      console.log(`Executing: ${file}...`);
      
      try {
        await executeSqlFile(db, filePath);
        await recordMigration(db, file);
        console.log(`✓ ${file} completed`);
      } catch (error) {
        console.error(`✗ ${file} failed:`, error.message);
        throw error;
      }
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log('✓ All migrations completed successfully');
    console.log('='.repeat(60));
    
  } finally {
    await closeDatabase(db);
  }
}

/**
 * Rollback last migration
 */
async function migrateDown() {
  console.log('='.repeat(60));
  console.log('Rolling Back Last Migration (DOWN)');
  console.log('='.repeat(60));
  console.log();
  
  const db = await getDatabase();
  
  try {
    // Create migrations table
    await createMigrationsTable(db);
    
    // Get executed migrations
    const executed = await getExecutedMigrations(db);
    
    if (executed.length === 0) {
      console.log('✓ No migrations to rollback');
      return;
    }
    
    // Get last migration
    const lastMigration = executed[executed.length - 1];
    console.log(`Rolling back: ${lastMigration}`);
    
    // Note: Rollback is manual - you need to create down migration files
    console.warn('⚠ Automatic rollback not implemented');
    console.warn('  Please create a rollback migration manually');
    console.warn(`  Example: ${lastMigration.replace('.sql', '_down.sql')}`);
    
    // Remove migration record
    await removeMigration(db, lastMigration);
    console.log(`✓ Migration record removed: ${lastMigration}`);
    
  } finally {
    await closeDatabase(db);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  console.log('='.repeat(60));
  console.log('Migration Status');
  console.log('='.repeat(60));
  console.log();
  
  const db = await getDatabase();
  
  try {
    // Create migrations table
    await createMigrationsTable(db);
    
    // Get executed migrations
    const executed = await getExecutedMigrations(db);
    
    // Get all migration files
    const files = getMigrationFiles();
    
    console.log(`Database: ${DB_PATH}`);
    console.log(`Migrations directory: ${MIGRATIONS_DIR}`);
    console.log();
    console.log(`Total migration files: ${files.length}`);
    console.log(`Executed migrations: ${executed.length}`);
    console.log(`Pending migrations: ${files.length - executed.length}`);
    console.log();
    
    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }
    
    console.log('Migration Files:');
    files.forEach(file => {
      const status = executed.includes(file) ? '✓ Executed' : '○ Pending';
      console.log(`  ${status} - ${file}`);
    });
    
  } finally {
    await closeDatabase(db);
  }
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'up';
  
  try {
    switch (command) {
      case 'up':
        await migrateUp();
        break;
      case 'down':
        await migrateDown();
        break;
      case 'status':
        await showStatus();
        break;
      default:
        console.error('Unknown command:', command);
        console.log('Usage: node database/migrate.js [up|down|status]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateUp,
  migrateDown,
  showStatus
};
