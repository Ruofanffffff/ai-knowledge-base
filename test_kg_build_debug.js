/**
 * Debug script to test KG building process
 */

const kgService = require('./kg/services/kg_service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    // Get document 2
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const DB_PATH = path.join(__dirname, 'data/users.db');
    
    const document = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get('SELECT * FROM documents WHERE id = ?', [2], (err, row) => {
          if (err) {
            db.close();
            reject(err);
          } else {
            db.close();
            resolve(row);
          }
        });
      });
    });
    
    if (!document) {
      console.log('Document 2 not found');
      return;
    }
    
    console.log(`Document: ${document.title}`);
    console.log(`File type: ${document.file_type}`);
    
    // Parse metadata
    const metadata = document.metadata ? JSON.parse(document.metadata) : {};
    const filePath = metadata.filePath || document.file_path;
    
    console.log(`File path: ${filePath}`);
    console.log('\n--- Starting KG Build ---\n');
    
    // Build KG
    const result = await kgService.buildKnowledgeGraph(
      document.id,
      filePath,
      document.file_type,
      {
        llmClient: null,
        enableSemanticRelations: false,
        enableQualityFilter: true
      }
    );
    
    console.log('\n--- Build Result ---');
    console.log(`CKBs created: ${result.ckbs_created}`);
    console.log(`Entities created: ${result.entities_created}`);
    console.log(`Relations created:`, result.relations_created);
    console.log(`Processing time: ${result.processing_time}ms`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((err, i) => {
        console.log(`${i+1}. ${err.step}: ${err.error}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
