/**
 * Test script to verify relation description generation
 */

const { RelationDescriptionGenerator } = require('./kg/human_readable/relation_description_generator');

async function testDescriptionGeneration() {
  console.log('=== Testing Relation Description Generation ===\n');
  
  const generator = new RelationDescriptionGenerator({
    enableLLM: false,
    language: 'zh'
  });

  // Test cases
  const testCases = [
    {
      name: '共现关系',
      relation: {
        type: 'co_occurrence',
        source: { canonical_name: 'Intel Xeon SP 4214' },
        target: { canonical_name: 'DDR4 RDIMM ECC 32GB' }
      }
    },
    {
      name: '层级关系 - is_a',
      relation: {
        type: 'is_a',
        source: { canonical_name: 'Canon EOS R5' },
        target: { canonical_name: '全画幅无反相机' }
      }
    },
    {
      name: '部分关系 - part_of',
      relation: {
        type: 'part_of',
        source: { canonical_name: 'RF 24-70mm F2.8' },
        target: { canonical_name: 'Canon EOS R5套装' }
      }
    },
    {
      name: '位置关系',
      relation: {
        type: 'located_in',
        source: { canonical_name: '海南省海口市' },
        target: { canonical_name: '海南省' }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    console.log(`  源实体: ${testCase.relation.source.canonical_name}`);
    console.log(`  目标实体: ${testCase.relation.target.canonical_name}`);
    console.log(`  关系类型: ${testCase.relation.type}`);
    
    try {
      const result = await generator.generateDescription(testCase.relation, {
        method: 'template'
      });
      
      console.log(`  ✓ 描述: ${result.description}`);
      console.log(`  方法: ${result.method}`);
      console.log(`  置信度: ${result.confidence}`);
    } catch (error) {
      console.log(`  ✗ 错误: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('=== 测试完成 ===');
}

testDescriptionGeneration().catch(console.error);
