/**
 * 实体构建修复补丁
 * 
 * 这个文件包含了修复实体构建问题的所有代码更改
 */

// ============================================================================
// 修复1: schema_manager.js - 添加anchor_fields到deserializeSchema
// ============================================================================

// 已完成 ✅
// 位置: kg/schema/schema_manager.js, line 28-45
// 更改: 在deserializeSchema函数中添加anchor_fields字段

// ============================================================================
// 修复2: universal_document_pipeline.js - 修改_mergeMatchResults方法签名
// ============================================================================

// 需要修改的位置1: _matchSchema方法中调用_mergeMatchResults
// 原代码 (line ~1200):
/*
const mergedResults = this._mergeMatchResults(
  schemaMatchResults,
  llmMatchesBySchema,
  sortedSchemas
);
*/

// 修改为:
/*
const mergedResults = this._mergeMatchResults(
  schemaMatchResults,
  llmMatchesBySchema,
  sortedSchemas,
  unmappedFields  // 🔧 添加unmappedFields参数
);
*/

// 需要修改的位置2: _mergeMatchResults方法签名
// 原代码 (line ~2220):
/*
_mergeMatchResults(algorithmResults, llmMatchesBySchema, schemas) {
*/

// 修改为:
/*
_mergeMatchResults(algorithmResults, llmMatchesBySchema, schemas, unmappedFields = []) {
*/

// 需要修改的位置3: _mergeMatchResults方法中添加LLM字段时保留原始值
// 原代码 (line ~2300):
/*
existing.normalizedFields.push({
  name: match.schema_field,
  standardName: match.schema_field,
  value: '', // LLM匹配没有具体值
  mappingMethod: 'llm',
  confidence: match.confidence,
  reason: match.reason
});
*/

// 修改为:
/*
// 从unmappedFields中查找原始字段值
const originalField = unmappedFields.find(f => 
  f.name === match.original_field_name ||
  f.name.toLowerCase() === match.original_field_name?.toLowerCase()
);

existing.normalizedFields.push({
  name: match.schema_field,
  standardName: match.schema_field,
  value: originalField ? originalField.value : '', // 🔧 使用原始字段值
  mappingMethod: 'llm',
  confidence: match.confidence,
  reason: match.reason,
  originalName: originalField ? originalField.name : match.original_field_name
});
*/

// 需要修改的位置4: 创建新结果时也要保留原始值
// 原代码 (line ~2350):
/*
normalizedFields: llmMatches.map(match => ({
  name: match.schema_field,
  standardName: match.schema_field,
  value: '',
  mappingMethod: 'llm',
  confidence: match.confidence,
  reason: match.reason
})),
*/

// 修改为:
/*
normalizedFields: llmMatches.map(match => {
  // 从unmappedFields中查找原始字段值
  const originalField = unmappedFields.find(f => 
    f.name === match.original_field_name ||
    f.name.toLowerCase() === match.original_field_name?.toLowerCase()
  );
  
  return {
    name: match.schema_field,
    standardName: match.schema_field,
    value: originalField ? originalField.value : '', // 🔧 使用原始字段值
    mappingMethod: 'llm',
    confidence: match.confidence,
    reason: match.reason,
    originalName: originalField ? originalField.name : match.original_field_name
  };
}),
*/

// ============================================================================
// 修复3: schema_match.js - 改进LLM Prompt
// ============================================================================

// 需要在Prompt中添加更明确的规则
// 位置: kg/prompts/schema_match.js

// 添加到Prompt中:
/*
## 重要规则
1. **只能返回Schema中实际存在的字段名**
2. 字段名必须完全匹配Schema定义中的字段名（区分大小写）
3. 不要创造新的字段名或使用相似但不存在的字段名
4. 必须在响应中包含original_field_name字段，用于追溯原始字段
*/

// ============================================================================
// 修复4: anchor_generator.js - 添加降级策略
// ============================================================================

// 需要修改的位置: generateAnchorFingerprint函数
// 原代码 (line ~60):
/*
if (nonEmptyValues.length === 0) {
  throw new Error(`[AnchorGenerator] All anchor field values are empty for schema ${schema.schema_name}`);
}
*/

// 修改为:
/*
if (nonEmptyValues.length === 0) {
  console.warn(`[AnchorGenerator] All anchor field values are empty for schema ${schema.schema_name}, trying fallback strategy`);
  
  // 降级策略1: 使用所有非空字段值
  const allFieldValues = Object.values(instance.fields)
    .filter(v => v && String(v).trim() !== '')
    .map(v => normalizeFieldValue(v, 'unknown', 'lowercase'));
  
  if (allFieldValues.length > 0) {
    const fingerprint = `${entityType}|fallback|${allFieldValues.slice(0, 3).join('|')}`;
    console.log(`[AnchorGenerator] Using fallback fingerprint with ${allFieldValues.length} fields: ${fingerprint}`);
    success = true;
    return fingerprint;
  }
  
  // 降级策略2: 使用schema_name + CKB ID（如果可用）
  const ckbId = instance.ckb_ids && instance.ckb_ids[0] ? instance.ckb_ids[0] : 'unknown';
  const fingerprint = `${entityType}|fallback|${schema.schema_name}|${ckbId}`;
  console.warn(`[AnchorGenerator] Using CKB-based fallback fingerprint: ${fingerprint}`);
  success = true;
  return fingerprint;
}
*/

console.log('实体构建修复补丁说明已生成');
console.log('请按照上述说明手动应用修复');
