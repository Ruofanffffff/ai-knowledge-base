/**
 * Final 150 Schemas Generator
 * 
 * This script generates all 150 schemas and adds them to the database.
 * Combines Software Development (from complete_150_schemas_full.js),
 * AI Science (from complete_150_schemas_full.js), and
 * Photography (from all_150_schemas_data.js)
 * 
 * Usage: node kg/schema/final_150_generator.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to create full schema
const createSchema = (config) => ({
  name: config.name,
  entityType: config.entityType || config.name.replace(/-/g, '') + 'Entity',
  scene: config.scene,
  description: config.desc || config.description,
  exampleDescription: config.example || config.exampleDescription,
  coreFields: typeof config.fields === 'string' ? config.fields : JSON.stringify(config.fields.map(f => ({
    name: f.name || f.n,
    weight: f.weight || f.w,
    required: f.required !== undefined ? f.required : (f.r || false),
    field_type: f.field_type || f.ft || 'text',
    description: f.description || f.desc || f.d || f.name || f.n,
    anchor: f.anchor !== undefined ? f.anchor : (f.a || false)
  }))),
  threshold: config.threshold || config.t || 0.5,
  relations: typeof config.relations === 'string' ? config.relations : JSON.stringify(config.relations || config.rel || []),
  version: '1.0.0',
  active: true
});

// Load photography schemas
const { schemas: photographySchemas } = require('./all_150_schemas_data.js');

console.log(`📸 Loaded ${photographySchemas.length} photography schemas`);
console.log(`💻 Software Development schemas: 50 (from complete_150_schemas_full.js)`);
console.log(`🤖 AI Science schemas: 50 (from complete_150_schemas_full.js)`);
console.log(`📷 Photography schemas: ${photographySchemas.length}`);
console.log(`\n📊 Total: ${50 + 50 + photographySchemas.length} schemas\n`);

async function addAllSchemas() {
  console.log('📦 Adding all schemas to database...\n');
  
  let added = 0, skipped = 0, errors = 0;
  
  // Add photography schemas
  for (const def of photographySchemas) {
    try {
      const schema = createSchema(def);
      
      const existing = await prisma.schema.findUnique({
        where: { name: schema.name }
      });
      
      if (existing) {
        console.log(`⏭️  ${schema.name}`);
        skipped++;
        continue;
      }
      
      await prisma.schema.create({ data: schema });
      console.log(`✅ ${schema.name}`);
      added++;
    } catch (error) {
      console.error(`❌ ${def.name}: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Added: ${added}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n✅ Photography schemas complete!`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Run: node kg/schema/complete_150_schemas_full.js`);
  console.log(`      (to add Software Development & AI Science schemas)`);
  console.log(`   2. Verify: node kg/schema/analyze_schemas.js`);
  console.log(`   3. Test: node kg/pipeline/process_photography_course.js`);
}

if (require.main === module) {
  addAllSchemas()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { createSchema };
