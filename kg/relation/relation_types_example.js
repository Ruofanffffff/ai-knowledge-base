/**
 * Relation Types Usage Examples
 * 
 * This file demonstrates how to use the relation type system
 * in various scenarios.
 */

const relationTypeRegistry = require('./relation_type_registry');
const relationTypeLoader = require('./relation_type_loader');
const relationTypeValidator = require('./relation_type_validator');
const relationTypeQuery = require('./relation_type_query');
const relationTypeStore = require('./relation_type_store');
const path = require('path');

// ============================================
// Example 1: Loading Relation Types
// ============================================

async function example1_loadRelationTypes() {
  console.log('\n=== Example 1: Loading Relation Types ===\n');
  
  try {
    // Create loader
    const loader = new relationTypeLoader();
    
    // Load from JSON file
    const typesPath = path.join(__dirname, 'relation_types.json');
    const types = await loader.loadFromFile(typesPath);
    
    console.log(`Loaded ${types.length} relation types`);
    console.log(`First type: ${types[0].relationTypeId} (${types[0].displayName})`);
    
    // Create registry and register types
    const registry = new relationTypeRegistry();
    registry.registerBatch(types);
    
    console.log(`Registry contains ${registry.getAll().length} types`);
    
    return registry;
  } catch (error) {
    console.error('Error loading relation types:', error.message);
  }
}

// ============================================
// Example 2: Querying Relation Types
// ============================================

async function example2_queryRelationTypes(registry) {
  console.log('\n=== Example 2: Querying Relation Types ===\n');
  
  try {
    const query = new relationTypeQuery(registry);
    
    // Query by domain
    console.log('--- Query by Domain (life) ---');
    const lifeTypes = query.query({ domain: 'life' });
    console.log(`Found ${lifeTypes.length} life domain types`);
    lifeTypes.slice(0, 3).forEach(t => {
      console.log(`  - ${t.relationTypeId}: ${t.displayName}`);
    });
    
    // Query by category
    console.log('\n--- Query by Category (family) ---');
    const familyTypes = query.query({ domain: 'life', category: 'family' });
    console.log(`Found ${familyTypes.length} family types`);
    familyTypes.forEach(t => {
      console.log(`  - ${t.relationTypeId}: ${t.displayName}`);
    });
    
    // Search by keyword
    console.log('\n--- Search by Keyword (父母) ---');
    const searchResults = query.search('父母');
    console.log(`Found ${searchResults.length} results`);
    searchResults.forEach(t => {
      console.log(`  - ${t.relationTypeId}: ${t.displayName}`);
    });
    
    // Get compatible types for entity
    console.log('\n--- Compatible Types for PersonEntity ---');
    const compatibleTypes = query.getCompatibleTypes('PersonEntity', 'PersonEntity');
    console.log(`Found ${compatibleTypes.length} compatible types`);
    compatibleTypes.slice(0, 5).forEach(t => {
      console.log(`  - ${t.relationTypeId}: ${t.displayName} (${t.domain}/${t.category})`);
    });
  } catch (error) {
    console.error('Error querying relation types:', error.message);
  }
}

// ============================================
// Example 3: Validating Relations
// ============================================

async function example3_validateRelations(registry) {
  console.log('\n=== Example 3: Validating Relations ===\n');
  
  try {
    const validator = new relationTypeValidator(registry);
    
    // Get a relation type
    const parentType = registry.get('family_parent');
    console.log(`Validating against: ${parentType.displayName}`);
    
    // Valid relation
    console.log('\n--- Valid Relation ---');
    const validRelation = {
      sourceEntityType: 'PersonEntity',
      targetEntityType: 'PersonEntity',
      confidence: 0.95
    };
    
    const validResult = validator.validate(validRelation, parentType);
    console.log(`Valid: ${validResult.valid}`);
    if (!validResult.valid) {
      console.log('Errors:', validResult.errors);
    }
    
    // Invalid source entity type
    console.log('\n--- Invalid Source Entity Type ---');
    const invalidSource = {
      sourceEntityType: 'LocationEntity',  // Wrong type
      targetEntityType: 'PersonEntity',
      confidence: 0.95
    };
    
    const invalidSourceResult = validator.validate(invalidSource, parentType);
    console.log(`Valid: ${invalidSourceResult.valid}`);
    if (!invalidSourceResult.valid) {
      console.log('Errors:', invalidSourceResult.errors);
    }
    
    // Invalid confidence
    console.log('\n--- Invalid Confidence ---');
    const invalidConfidence = {
      sourceEntityType: 'PersonEntity',
      targetEntityType: 'PersonEntity',
      confidence: 1.5  // Out of range
    };
    
    const invalidConfidenceResult = validator.validate(invalidConfidence, parentType);
    console.log(`Valid: ${invalidConfidenceResult.valid}`);
    if (!invalidConfidenceResult.valid) {
      console.log('Errors:', invalidConfidenceResult.errors);
    }
  } catch (error) {
    console.error('Error validating relations:', error.message);
  }
}

// ============================================
// Example 4: Creating Custom Relation Types
// ============================================

async function example4_createCustomRelationType() {
  console.log('\n=== Example 4: Creating Custom Relation Type ===\n');
  
  try {
    // Define custom relation type
    const customType = {
      relationTypeId: 'custom_mentor',
      name: 'mentor',
      displayName: '导师',
      description: '表示导师指导关系',
      domain: 'work',
      category: 'mentorship',
      sourceEntityTypes: ['PersonEntity'],
      targetEntityTypes: ['PersonEntity'],
      isDirectional: true,
      isTemporal: true,
      supportsConfidence: true,
      metadata: {
        customField: 'customValue'
      },
      version: '1.0.0',
      active: true
    };
    
    console.log('Creating custom relation type:', customType.relationTypeId);
    
    // In a real scenario, you would save to database
    // const created = await relationTypeStore.create(customType);
    // console.log('Created:', created);
    
    // For demo, just show the definition
    console.log('Custom type definition:');
    console.log(JSON.stringify(customType, null, 2));
  } catch (error) {
    console.error('Error creating custom relation type:', error.message);
  }
}

// ============================================
// Example 5: Using Relation Types in Schema
// ============================================

async function example5_useInSchema(registry) {
  console.log('\n=== Example 5: Using Relation Types in Schema ===\n');
  
  try {
    // Define a schema with relation types
    const schema = {
      schema_name: 'FamilyPersonSchema',
      entity_type: 'PersonEntity',
      core_fields: [
        { name: 'name', weight: 0.4, required: true },
        { name: 'age', weight: 0.2, required: false },
        { name: 'parent_name', weight: 0.2, required: false },
        { name: 'spouse_name', weight: 0.2, required: false }
      ],
      threshold: 0.7,
      relations: [
        {
          type: 'parent',
          relation_type_id: 'family_parent',
          target_field: 'parent_name',
          direction: 'outgoing'
        },
        {
          type: 'spouse',
          relation_type_id: 'family_spouse',
          target_field: 'spouse_name',
          direction: 'outgoing'
        }
      ]
    };
    
    console.log('Schema with relation types:');
    console.log(JSON.stringify(schema, null, 2));
    
    // Validate relation types in schema
    console.log('\n--- Validating Relation Types ---');
    for (const relation of schema.relations) {
      const relationType = registry.get(relation.relation_type_id);
      if (relationType) {
        console.log(`✓ ${relation.relation_type_id}: ${relationType.displayName}`);
      } else {
        console.log(`✗ ${relation.relation_type_id}: Not found`);
      }
    }
  } catch (error) {
    console.error('Error using relation types in schema:', error.message);
  }
}

// ============================================
// Example 6: Database Operations
// ============================================

async function example6_databaseOperations() {
  console.log('\n=== Example 6: Database Operations ===\n');
  
  try {
    // Note: These operations require database connection
    // Uncomment to run with actual database
    
    /*
    // Get all relation types
    console.log('--- Get All Relation Types ---');
    const allTypes = await relationTypeStore.findAll({ activeOnly: true });
    console.log(`Found ${allTypes.length} active types`);
    
    // Get by domain
    console.log('\n--- Get by Domain (life) ---');
    const lifeTypes = await relationTypeStore.findByDomain('life');
    console.log(`Found ${lifeTypes.length} life domain types`);
    
    // Get by entity type
    console.log('\n--- Get by Entity Type (PersonEntity) ---');
    const personTypes = await relationTypeStore.findByEntityType('PersonEntity', 'both');
    console.log(`Found ${personTypes.length} types for PersonEntity`);
    
    // Get statistics
    console.log('\n--- Get Statistics ---');
    const stats = await relationTypeStore.getStats();
    console.log('Statistics:', JSON.stringify(stats, null, 2));
    */
    
    console.log('Database operations are commented out.');
    console.log('Uncomment the code to run with actual database.');
  } catch (error) {
    console.error('Error with database operations:', error.message);
  }
}

// ============================================
// Example 7: Building Relations with Types
// ============================================

async function example7_buildRelations(registry) {
  console.log('\n=== Example 7: Building Relations with Types ===\n');
  
  try {
    // Simulate entity and fields
    const entity = {
      entity_id: 'person_alice',
      entity_type: 'PersonEntity',
      canonical_name: 'Alice',
      schemas: [{ schema_name: 'FamilyPersonSchema' }]
    };
    
    const fields = [
      { name: 'name', value: 'Alice', type: 'entity' },
      { name: 'parent_name', value: 'Bob', type: 'entity' }
    ];
    
    // Build relation
    const relationType = registry.get('family_parent');
    console.log(`Building relation: ${relationType.displayName}`);
    
    const relation = {
      source_id: entity.entity_id,
      target_id: 'person_bob',  // Simulated target
      type: 'builtin',
      subtype: relationType.relationTypeId,
      confidence: 1.0,
      evidence_ckb: ['ckb_1'],
      metadata: {
        relation_type_id: relationType.relationTypeId,
        relation_type_name: relationType.displayName
      }
    };
    
    console.log('Built relation:');
    console.log(JSON.stringify(relation, null, 2));
    
    // Validate the relation
    const validator = new relationTypeValidator(registry);
    const validation = validator.validate(
      {
        sourceEntityType: entity.entity_type,
        targetEntityType: 'PersonEntity',
        confidence: relation.confidence
      },
      relationType
    );
    
    console.log(`\nValidation: ${validation.valid ? '✓ Valid' : '✗ Invalid'}`);
    if (!validation.valid) {
      console.log('Errors:', validation.errors);
    }
  } catch (error) {
    console.error('Error building relations:', error.message);
  }
}

// ============================================
// Main Function
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('Relation Types Usage Examples');
  console.log('='.repeat(60));
  
  try {
    // Run examples
    const registry = await example1_loadRelationTypes();
    
    if (registry) {
      await example2_queryRelationTypes(registry);
      await example3_validateRelations(registry);
      await example4_createCustomRelationType();
      await example5_useInSchema(registry);
      await example6_databaseOperations();
      await example7_buildRelations(registry);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Examples completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  example1_loadRelationTypes,
  example2_queryRelationTypes,
  example3_validateRelations,
  example4_createCustomRelationType,
  example5_useInSchema,
  example6_databaseOperations,
  example7_buildRelations
};
