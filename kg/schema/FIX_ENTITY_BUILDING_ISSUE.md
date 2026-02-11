# 实体构建失败问题修复方案

## 问题诊断

通过诊断工具 `kg/pipeline/diagnose_entity_building.js` 发现了实体构建失败的根本原因：

### 问题1: 锚点字段配置未传递到Schema实例

**现象**：
```
Schema 1: PhotographyEntity
  标准化字段数: 6
  ⚠️  警告: 未配置锚点字段
```

**原因**：
- 数据库中的Schema有正确的`anchorFields`配置
- 但在Schema匹配步骤中，从数据库加载的Schema对象没有正确传递`anchor_fields`属性
- 导致`anchor_generator.js`无法找到锚点字段配置

**影响**：
```
[AnchorMerger] Error processing instance PhotographyEntity: 
[AnchorGenerator] All anchor field values are empty for schema PhotographyEntity
```

### 问题2: LLM匹配的字段值为空

**现象**：
```
前5个标准化字段:
  1. Aperture: 
  2. Shutter: 
  3. ISO: 
  4. Exposure: 
  5. Focus: 
```

**原因**：
- LLM匹配成功识别了字段名（如`Aperture`、`Shutter`等）
- 但LLM匹配只返回字段名，没有返回字段值
- 标准化步骤中，LLM匹配的字段被添加到`normalizedFields`，但`value`为空字符串

**影响**：
- 即使锚点字段配置正确，锚点字段的值也是空的
- 导致`generateAnchorFingerprint`抛出错误：`All anchor field values are empty`

### 问题3: LLM返回的字段名不在Schema定义中

**现象**：
```
[Pipeline] LLM匹配响应验证失败: [
  'Match validation failed: schema_field "FocalLength" not in schema "PhotographyEntity"',
  'Match validation failed: schema_field "Subject" not in schema "PhotographyEntity"'
]
```

**原因**：
- LLM返回的字段名（如`FocalLength`、`Subject`）不在`PhotographyEntity`的核心字段列表中
- `PhotographyEntity`的核心字段是：`Camera`, `Lens`, `ISO`, `Aperture`, `Shutter`, `Exposure`, `Focus`
- LLM可能基于语义理解返回了相关但不在Schema中的字段名

---

## 修复方案

### 修复1: 确保Schema对象包含anchor_fields

**位置**: `kg/schema/schema_manager.js` 或 `kg/pipeline/universal_document_pipeline.js`

**方案A**: 在Schema加载时转换字段名
```javascript
// 在 schema_manager.js 的 listSchemas 方法中
async listSchemas(options = {}) {
  const schemas = await prisma.schema.findMany(options);
  
  // 转换数据库字段名到代码字段名
  return schemas.map(schema => ({
    ...schema,
    schema_name: schema.name,
    schema_id: schema.id,
    entity_type: schema.entityType,
    core_fields: schema.coreFields,
    anchor_fields: schema.anchorFields,  // 🔧 添加这一行
    threshold: schema.threshold || 0.6
  }));
}
```

**方案B**: 在Schema匹配步骤中确保传递
```javascript
// 在 universal_document_pipeline.js 的 _matchSchema 方法中
// 确保每个匹配的Schema都包含anchor_fields
const mergedResults = this._mergeMatchResults(
  schemaMatchResults,
  llmMatchesBySchema,
  sortedSchemas
);

// 为每个结果添加anchor_fields
mergedResults.forEach(result => {
  if (!result.schema.anchor_fields && result.schema.anchorFields) {
    result.schema.anchor_fields = result.schema.anchorFields;
  }
});
```

### 修复2: LLM匹配时保留原始字段值

**位置**: `kg/pipeline/universal_document_pipeline.js` 的 `_mergeMatchResults` 方法

**当前代码**：
```javascript
existing.normalizedFields.push({
  name: match.schema_field,
  standardName: match.schema_field,
  value: '', // ❌ LLM匹配没有具体值
  mappingMethod: 'llm',
  confidence: match.confidence,
  reason: match.reason
});
```

**修复后**：
```javascript
// 从原始提取字段中查找对应的值
const originalField = unmappedFields.find(f => 
  f.name === match.original_field_name || 
  f.name.toLowerCase().includes(match.schema_field.toLowerCase())
);

existing.normalizedFields.push({
  name: match.schema_field,
  standardName: match.schema_field,
  value: originalField ? originalField.value : '', // ✅ 使用原始字段值
  mappingMethod: 'llm',
  confidence: match.confidence,
  reason: match.reason,
  originalName: originalField ? originalField.name : match.original_field_name
});
```

### 修复3: 改进LLM Prompt，只返回Schema中存在的字段

**位置**: `kg/prompts/schema_match.js`

**改进Prompt**：
```javascript
function buildSchemaMatchPrompt(unmappedFields, schemas, options = {}) {
  // ... 现有代码 ...
  
  const schemasList = schemas.map(schema => {
    const coreFields = (schema.core_fields || []).map(cf => cf.name).join(', ');
    return `- ${schema.schema_name}: [${coreFields}]`;
  }).join('\n');
  
  return `请判断以下提取的字段在哪些Schema的哪些字段上有匹配。

## 重要规则
1. **只能返回Schema中实际存在的字段名**
2. 字段名必须完全匹配Schema定义中的字段名（区分大小写）
3. 不要创造新的字段名或使用相似但不存在的字段名

## 提取的字段
${fieldsList}

## 可用的Schema及其核心字段
${schemasList}

## 输出格式
{
  "matches": [
    {
      "original_field_name": "提取的字段名",
      "value": "字段值",
      "schema_name": "Schema名称",
      "schema_field": "Schema中的字段名（必须完全匹配）",
      "confidence": 0.9,
      "reason": "匹配理由"
    }
  ]
}`;
}
```

### 修复4: 实现降级策略 - 当锚点字段为空时使用其他字段

**位置**: `kg/entity/anchor_generator.js`

**当前代码**：
```javascript
if (nonEmptyValues.length === 0) {
  throw new Error(`[AnchorGenerator] All anchor field values are empty for schema ${schema.schema_name}`);
}
```

**修复后**：
```javascript
if (nonEmptyValues.length === 0) {
  console.warn(`[AnchorGenerator] All anchor field values are empty for schema ${schema.schema_name}, trying fallback strategy`);
  
  // 降级策略1: 使用所有非空字段值
  const allFieldValues = Object.values(instance.fields)
    .filter(v => v && String(v).trim() !== '')
    .map(v => normalizeFieldValue(v, 'unknown', 'lowercase'));
  
  if (allFieldValues.length > 0) {
    const fingerprint = `${entityType}|${allFieldValues.slice(0, 3).join('|')}`;
    console.log(`[AnchorGenerator] Using fallback fingerprint: ${fingerprint}`);
    return fingerprint;
  }
  
  // 降级策略2: 使用schema_name + timestamp
  const timestamp = Date.now();
  const fingerprint = `${entityType}|fallback|${timestamp}`;
  console.warn(`[AnchorGenerator] Using timestamp-based fallback fingerprint: ${fingerprint}`);
  return fingerprint;
}
```

---

## 实施优先级

### 优先级1（紧急 - 必须修复）
1. ✅ **修复1**: 确保Schema对象包含anchor_fields
2. ✅ **修复2**: LLM匹配时保留原始字段值

### 优先级2（重要 - 应该修复）
3. ✅ **修复3**: 改进LLM Prompt
4. ✅ **修复4**: 实现降级策略

### 优先级3（改进 - 可以优化）
5. 扩展字段映射覆盖率（AI科学、软件开发Schema）
6. 优化Schema匹配算法
7. 建立自动化映射生成机制

---

## 测试验证

修复后，使用诊断工具验证：

```bash
node kg/pipeline/diagnose_entity_building.js
```

**期望结果**：
- ✅ 锚点字段配置正确传递
- ✅ 锚点字段值不为空
- ✅ 成功生成至少1个实体
- ✅ 实体包含正确的锚点指纹

---

## 相关文件

### 需要修改的文件
1. `kg/schema/schema_manager.js` - Schema加载
2. `kg/pipeline/universal_document_pipeline.js` - Schema匹配和字段标准化
3. `kg/prompts/schema_match.js` - LLM Prompt
4. `kg/entity/anchor_generator.js` - 锚点生成（降级策略）

### 诊断工具
- `kg/pipeline/diagnose_entity_building.js` - 实体构建诊断
- `kg/schema/check_photography_schema.js` - Schema配置检查

---

## 总结

实体构建失败的根本原因是：
1. **Schema对象缺少anchor_fields属性** - 数据库字段名与代码字段名不一致
2. **LLM匹配的字段值为空** - 只返回字段名，没有保留原始值
3. **LLM返回不存在的字段名** - Prompt不够明确

修复这三个问题后，实体构建应该能够正常工作。
