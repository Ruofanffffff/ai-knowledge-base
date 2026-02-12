/**
 * Create a generic text schema that can match any CKB with content
 * This is a fallback schema for unstructured text
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function createGenericTextSchema() {
  const schema = {
    id: uuidv4(),
    name: 'Generic-Text-Content',
    entityType: 'GeneralEntity',
    scene: null,
    coreFields: JSON.stringify([
      {
        name: 'content',
        weight: 0.7,
        required: false,
        description: 'Text content'
      },
      {
        name: 'title',
        weight: 0.3,
        required: false,
        description: 'Title or heading'
      }
    ]),
    threshold: 0.3,  // Low threshold - just need content field
    relations: null,
    exampleDescription: '通用文本内容实体，用于捕获非结构化文本',
    description: '通用文本Schema，匹配任何包含content字段的CKB',
    anchorFields: JSON.stringify(['content']),
    anchorConfig: null,
    version: '1.0.0',
    active: true
  };
  
  try {
    // Check if schema already exists
    const existing = await prisma.schema.findUnique({
      where: { name: schema.name }
    });
    
    if (existing) {
      console.log('Generic text schema already exists, updating...');
      await prisma.schema.update({
        where: { name: schema.name },
        data: schema
      });
      console.log('✓ Updated Generic-Text-Content schema');
    } else {
      await prisma.schema.create({
        data: schema
      });
      console.log('✓ Created Generic-Text-Content schema');
    }
    
    // Verify
    const count = await prisma.schema.count({ where: { active: true } });
    console.log(`Total active schemas: ${count}`);
    
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createGenericTextSchema().catch(console.error);
