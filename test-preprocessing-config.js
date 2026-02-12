/**
 * 测试LLM预处理配置是否正确加载
 */

require('dotenv').config();

console.log('\n========== 环境变量检查 ==========');
console.log('ENABLE_LLM_PREPROCESSING:', process.env.ENABLE_LLM_PREPROCESSING);
console.log('LLM_PREPROCESSING_TIMEOUT:', process.env.LLM_PREPROCESSING_TIMEOUT);
console.log('LLM_PREPROCESSING_TEMPERATURE:', process.env.LLM_PREPROCESSING_TEMPERATURE);
console.log('FIELD_COVERAGE_THRESHOLD:', process.env.FIELD_COVERAGE_THRESHOLD);
console.log('SCHEMA_VALIDATION_THRESHOLD:', process.env.SCHEMA_VALIDATION_THRESHOLD);

console.log('\n========== 加载预处理配置模块 ==========');
const { config, printConfig } = require('./kg/preprocessing/config.js');

printConfig();

console.log('\n========== 配置验证结果 ==========');
console.log('预处理功能已启用:', config.enabled);
console.log('温度参数:', config.temperature);
console.log('字段覆盖率阈值:', config.thresholds.fieldCoverage);
console.log('Schema验证阈值:', config.thresholds.schemaConfidence);

if (config.enabled) {
  console.log('\n✅ LLM文档索引预处理功能已启用！');
} else {
  console.log('\n❌ LLM文档索引预处理功能未启用');
}
