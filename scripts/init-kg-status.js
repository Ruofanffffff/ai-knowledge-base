#!/usr/bin/env node
/**
 * Initialize KG Build Status for Existing Documents
 * 
 * This script initializes build status records for all existing documents
 * in the database. It checks if each document has graph data and sets
 * the appropriate status:
 * - "completed" if the document has entities and relations
 * - "pending" if the document has no graph data
 * 
 * Usage: node scripts/init-kg-status.js
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Database paths
const USERS_DB_PATH = path.join(__dirname, '../data/users.db');
const KG_DB_PATH = path.join(__dirname, '../data/knowledge_graph.db');

/**
 * Get database connection
 */
function getDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
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
 * Get all documents
 */
async function getAllDocuments(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, title FROM documents', [], (err, rows) => {
      if (err) {
        console.error('Error fetching documents:', err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

/**
 * Check if document has existing status
 */
async function hasExistingStatus(db, docId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM kg_build_status WHERE doc_id = ?',
      [docId],
      (err, row) => {
        if (err) {
          console.error('Error checking status:', err.message);
          return reject(err);
        }
        resolve(!!row);
      }
    );
  });
}

/**
 * Check if document has graph data
 */
async function hasGraphData(kgDb, docId) {
  return new Promise((resolve, reject) => {
    // Check for CKB record in knowledge_graph.db
    kgDb.get(
      'SELECT COUNT(*) as count FROM ckb WHERE doc_id = ?',
      [docId],
      (err, row) => {
        if (err) {
          console.error('Error checking CKB:', err.message);
          return reject(err);
        }
        resolve(row.count > 0);
      }
    );
  });
}

/**
 * Get entity and relation counts
 */
async function getGraphCounts(kgDb, docId) {
  return new Promise((resolve, reject) => {
    const counts = { entityCount: 0, relationCount: 0 };
    
    // Get entity count from document_entities join
    kgDb.get(
      'SELECT COUNT(*) as count FROM document_entities WHERE documentId = ?',
      [docId],
      (err, row) => {
        if (err) {
          console.error('Error counting entities:', err.message);
          return reject(err);
        }
        counts.entityCount = row.count;
        
        // Get relation count - check if there's a relations table
        kgDb.get(
          "SELECT COUNT(*) as count FROM entity_relations WHERE source IN (SELECT entityId FROM document_entities WHERE documentId = ?)",
          [docId],
          (err, row) => {
            if (err) {
              console.error('Error counting relations:', err.message);
              // If error, just set to 0
              counts.relationCount = 0;
              resolve(counts);
            } else {
              counts.relationCount = row.count;
              resolve(counts);
            }
          }
        );
      }
    );
  });
}

/**
 * Create status record
 */
async function createStatus(db, docId, status, entityCount = 0, relationCount = 0) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO kg_build_status (doc_id, status, entity_count, relation_count)
       VALUES (?, ?, ?, ?)`,
      [docId, status, entityCount, relationCount],
      (err) => {
        if (err) {
          console.error('Error creating status:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

/**
 * Main initialization function
 */
async function initializeStatuses() {
  console.log('='.repeat(60));
  console.log('Initializing KG Build Status for Existing Documents');
  console.log('='.repeat(60));
  console.log();
  
  const usersDb = await getDatabase(USERS_DB_PATH);
  const kgDb = await getDatabase(KG_DB_PATH);
  
  try {
    // Get all documents from users.db
    const documents = await getAllDocuments(usersDb);
    console.log(`Found ${documents.length} documents`);
    console.log();
    
    if (documents.length === 0) {
      console.log('✓ No documents to process');
      return;
    }
    
    let created = 0;
    let skipped = 0;
    let completed = 0;
    let pending = 0;
    
    // Process each document
    for (const doc of documents) {
      // Check if status already exists in users.db
      const exists = await hasExistingStatus(usersDb, doc.id);
      
      if (exists) {
        console.log(`  ○ Skipped: ${doc.title} (status already exists)`);
        skipped++;
        continue;
      }
      
      // Check if document has graph data in knowledge_graph.db
      const hasData = await hasGraphData(kgDb, doc.id);
      
      if (hasData) {
        // Get counts from knowledge_graph.db
        const counts = await getGraphCounts(kgDb, doc.id);
        
        // Create completed status in users.db
        await createStatus(usersDb, doc.id, 'completed', counts.entityCount, counts.relationCount);
        console.log(`  ✓ Created: ${doc.title} (completed, ${counts.entityCount} entities, ${counts.relationCount} relations)`);
        completed++;
      } else {
        // Create pending status in users.db
        await createStatus(usersDb, doc.id, 'pending');
        console.log(`  ✓ Created: ${doc.title} (pending)`);
        pending++;
      }
      
      created++;
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log('Initialization Summary');
    console.log('='.repeat(60));
    console.log(`Total documents: ${documents.length}`);
    console.log(`Status records created: ${created}`);
    console.log(`  - Completed: ${completed}`);
    console.log(`  - Pending: ${pending}`);
    console.log(`Skipped (already exists): ${skipped}`);
    console.log();
    console.log('✓ Initialization completed successfully');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error();
    console.error('✗ Initialization failed:', error.message);
    throw error;
  } finally {
    await closeDatabase(usersDb);
    await closeDatabase(kgDb);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await initializeStatuses();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  initializeStatuses
};
