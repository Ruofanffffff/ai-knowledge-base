/**
 * Test NER Extractor
 */

const nerExtractor = require('./kg/field_extractor/ner_extractor');

const testText = `
海南省海口市美兰国际机场智慧防疫项目由上海商汤智能科技有限公司负责实施。
项目位于海南省海口市，由海南省海口市美兰国际机场管理。
`;

console.log('Testing NER Extractor...');
console.log('Input text:', testText);
console.log('');

const entities = nerExtractor.extractEntities(testText);

console.log(`Extracted ${entities.length} entities:`);
entities.forEach((entity, i) => {
  console.log(`${i + 1}. ${entity.name}: ${entity.value} (${entity.subtype}, confidence: ${entity.confidence})`);
});
