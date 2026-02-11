/**
 * Simple test to debug extraction issues
 */

const ExtractionCoordinator = require('./extraction_coordinator');
const Configuration = require('./configuration');

async function testSimpleExtraction() {
  console.log('Creating configuration...');
  const config = new Configuration({
    llm: {
      enabled: true,
      model: 'qwen-plus',
      apiKey: 'sk-43c76462bfad4a57bd2420c7fdb0aec4',
      timeout: 10000,
      maxRetries: 3
    },
    algorithm: {
      enabled: true
    },
    performance: {
      enableCache: true
    }
  });

  console.log('Creating coordinator...');
  const coordinator = new ExtractionCoordinator(config);

  console.log('Testing extraction...');
  const testText = `
SEL35F18F 是一款35mm定焦镜头，最大光圈F1.8，适合人文和街拍。
使用三分法构图可以让照片更有平衡感。
逆光拍摄能使肤色和发质更柔和。
  `;

  try {
    const result = await coordinator.extract(testText);
    console.log('\n=== Extraction Result ===');
    console.log('Status:', result.metadata.status);
    console.log('Entities:', result.entities.length);
    console.log('Relations:', result.relations.length);
    console.log('\nEntities:');
    result.entities.forEach(e => {
      console.log(`  - ${e.name} (${e.type}, source: ${e.source})`);
    });
    console.log('\nRelations:');
    result.relations.forEach(r => {
      console.log(`  - ${r.source} -> ${r.target} (${r.type})`);
    });
  } catch (error) {
    console.error('Extraction failed:', error.message);
    console.error(error.stack);
  }
}

testSimpleExtraction();
