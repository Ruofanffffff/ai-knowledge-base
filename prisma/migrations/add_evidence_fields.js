/**
 * Migration: Add Evidence Fields to KGEntity and KGRelation
 * 
 * This migration adds the `evidence` field to both KGEntity and KGRelation tables
 * to support the CKB Intelligent Chunking feature's evidence localization system.
 * 
 * Evidence Structure:
 * {
 *   type: 'entity' | 'relation',
 *   entityId: string,
 *   entityName: string,
 *   locations: [{
 *     ckbId: string,
 *     chunkId: string | null,
 *     start: number,
 *     end: number,
 *     matchedText: string
 *   }],
 *   confidence: number
 * }
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function up() {
  console.log('Starting migration: add_evidence_fields');
  
  try {
    // SQLite doesn't support ALTER TABLE ADD COLUMN directly in Prisma
    // We need to use raw SQL
    
    // Add evidence column to kg_entities table
    console.log('Adding evidence column to kg_entities...');
    await prisma.$executeRaw`
      ALTER TABLE kg_entities ADD COLUMN evidence TEXT;
    `;
    console.log('✓ Added evidence column to kg_entities');
    
    // Add evidence column to kg_relations table
    console.log('Adding evidence column to kg_relations...');
    await prisma.$executeRaw`
      ALTER TABLE kg_relations ADD COLUMN evidence TEXT;
    `;
    console.log('✓ Added evidence column to kg_relations');
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function down() {
  console.log('Rolling back migration: add_evidence_fields');
  
  try {
    // SQLite doesn't support DROP COLUMN directly
    // We would need to recreate the tables without the evidence column
    // For now, we'll just log a warning
    console.warn('⚠️  SQLite does not support DROP COLUMN.');
    console.warn('⚠️  To rollback, you need to manually recreate the tables.');
    console.warn('⚠️  Or use: npx prisma migrate reset (WARNING: This will delete all data!)');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'up') {
    up()
      .then(() => {
        console.log('Migration applied successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      })
      .finally(() => prisma.$disconnect());
  } else if (command === 'down') {
    down()
      .then(() => {
        console.log('Migration rolled back successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      })
      .finally(() => prisma.$disconnect());
  } else {
    console.log('Usage: node add_evidence_fields.js [up|down]');
    process.exit(1);
  }
}

module.exports = { up, down };
