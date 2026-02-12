/**
 * Test Schema-aware Extractor with NER
 */

const SchemaAwareExtractor = require('./kg/field_extractor/schema_aware_extractor');

const testCKB = {
  ckb_id: 'test_ckb_1',
  content: {
    text: '海南省海口市美兰国际机场智慧防疫项目由上海商汤智能科技有限公司负责实施。项目位于海南省海口市。'
  }
};

const testSchemas = [
  {
    name: 'Project-Entity',
    coreFields: JSON.stringify([
      { name: '项目名称', weight: 0.4, required: true },
      { name: '地点', weight: 0.2, required: false },
      { name: '执行单位', weight: 0.3, required: false }
    ]),
    relations: JSON.stringify([
      {
        type: 'located_in',
        relation_type_id: 'project_located_in',
        target_field: '地点',
        direction: 'outgoing'
      }
    ])
  }
];

async function test() {
  console.log('Testing Schema-aware Extractor with NER...');
  console.log('');
  
  const extractor = new SchemaAwareExtractor();
  const fields = await extractor.extractFields(testCKB, testSchemas, { enableLLM: false });
  
  console.log(`\nExtracted ${fields.length} fields:`);
  fields.forEach((field, i) => {
    console.log(`${i + 1}. ${field.name}: ${field.value} (sources: ${field.sources?.join(', ')})`);
  });
  
  console.log('\nMissing critical fields:', testCKB._missingCriticalFields?.map(f => f.name).join(', '));
}

test().catch(console.error);
