/**
 * Test NER in actual KG build process
 */

const ckbParser = require('./kg/ckb/ckb_parser');
const SchemaAwareExtractor = require('./kg/field_extractor/schema_aware_extractor');
const schemaManager = require('./kg/schema/schema_manager');
const { DocumentClassifier } = require('./kg/services/document_classifier');

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
    
    // Parse metadata
    const metadata = document.metadata ? JSON.parse(document.metadata) : {};
    const filePath = metadata.filePath || document.file_path;
    
    // Parse document to CKBs
    console.log('Parsing document...');
    const ckbs = await ckbParser.parseDocument(document.id, filePath, document.file_type);
    console.log(`Created ${ckbs.length} CKBs`);
    
    // Get schemas
    const allSchemas = await schemaManager.listSchemas({ active: true, take: 1000 });
    const classifier = new DocumentClassifier();
    const sampleText = ckbs.slice(0, Math.min(5, ckbs.length))
      .map(ckb => ckb.content?.text || '')
      .join('\n');
    const schemas = classifier.getRelevantSchemas(sampleText, allSchemas);
    
    console.log(`Using ${schemas.length} schemas`);
    
    // Test first 3 CKBs
    const extractor = new SchemaAwareExtractor();
    
    for (let i = 0; i < Math.min(3, ckbs.length); i++) {
      const ckb = ckbs[i];
      console.log(`\n--- CKB ${i + 1} ---`);
      console.log(`Text length: ${ckb.content?.text?.length || 0}`);
      console.log(`Text preview: ${(ckb.content?.text || '').substring(0, 100)}...`);
      
      const fields = await extractor.extractFields(ckb, schemas, { enableLLM: false });
      
      console.log(`Extracted ${fields.length} fields`);
      if (fields.length > 0) {
        console.log('Sample fields:');
        fields.slice(0, 3).forEach(f => {
          console.log(`  - ${f.name}: ${f.value?.substring(0, 50)}...`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
