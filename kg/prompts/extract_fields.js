/**
 * Prompt 1: CKB → Field Extraction
 * 
 * This prompt is used by the LLM extractor to extract structured fields from CKB content.
 * It follows the design principle of "no inference, only extraction" to minimize hallucination.
 * 
 * Design Reference: Phase 2 - Prompt Module
 * Requirements: 2.3, 2.4, 2.5, 2.7, 2.9, 2.10
 */

const { FieldType } = require('../field_extractor/rule_extractor');

/**
 * Field type descriptions for the prompt
 */
const FIELD_TYPE_DESCRIPTIONS = {
  [FieldType.LOCATION]: '地点、区域、位置（如：阿里C区、北京市、长江流域）',
  [FieldType.TIME]: '时间、日期、时间范围（如：2025年1月、2024-01-15、上午10点）',
  [FieldType.NUMBER]: '数值、数量（如：10、3.14、-5.2）',
  [FieldType.UNIT]: '单位、度量单位（如：米、公里、吨、万元、%）',
  [FieldType.INDICATOR]: '指标、度量名称（如：水位、温度、销售额、增长率）',
  [FieldType.ENTITY]: '实体名称（人名、组织名、产品名等，如：张三、阿里巴巴、iPhone）'
};

/**
 * Build field extraction prompt for LLM
 * 
 * @param {string} text - Text content from CKB to extract fields from
 * @param {Array} existingFields - Fields already extracted by rule-based methods
 * @param {Object} options - Additional options
 * @param {boolean} options.includeExamples - Whether to include examples in prompt
 * @param {Array} options.targetFieldTypes - Specific field types to focus on
 * @returns {string} Complete prompt for LLM
 */
function buildFieldExtractionPrompt(text, existingFields = [], options = {}) {
  const {
    includeExamples = true,
    targetFieldTypes = null
  } = options;

  // Build existing fields section
  const existingFieldsSection = buildExistingFieldsSection(existingFields);
  
  // Build field type descriptions
  const fieldTypeSection = buildFieldTypeSection(targetFieldTypes);
  
  // Build examples section
  const examplesSection = includeExamples ? buildExamplesSection() : '';
  
  // Build constraints section
  const constraintsSection = buildConstraintsSection();

  return `你是一个专业的信息抽取助手。你的任务是从文本中提取结构化字段，用于构建知识图谱。

## 输入文本
${text}

${existingFieldsSection}

## 任务要求
1. 从文本中提取关键字段（区域、时间、指标、数值、单位、实体等）
2. **只提取明确出现在文本中的信息，不要推理、猜测或生成新信息**
3. 如果已提取字段已经完整，返回空数组
4. 每个字段必须包含：name（字段名）、value（字段值）、type（字段类型）、confidence（置信度0-1）

${fieldTypeSection}

${examplesSection}

${constraintsSection}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "fields": [
    {"name": "字段名", "value": "字段值", "type": "字段类型", "confidence": 0.9}
  ]
}

如果没有新字段需要提取，返回：
{
  "fields": []
}`;
}

/**
 * Build existing fields section
 * @param {Array} existingFields - Already extracted fields
 * @returns {string} Formatted section
 */
function buildExistingFieldsSection(existingFields) {
  if (!existingFields || existingFields.length === 0) {
    return '## 已提取字段\n无（这是首次提取）';
  }
  
  const fieldsList = existingFields
    .map(f => `- ${f.name}: ${f.value} (${f.type}, 置信度: ${f.confidence})`)
    .join('\n');
  
  return `## 已提取字段
以下字段已通过规则方法提取，请提取其他遗漏的字段：
${fieldsList}`;
}

/**
 * Build field type descriptions section
 * @param {Array|null} targetFieldTypes - Specific types to focus on, or null for all
 * @returns {string} Formatted section
 */
function buildFieldTypeSection(targetFieldTypes) {
  const types = targetFieldTypes || Object.keys(FIELD_TYPE_DESCRIPTIONS);
  
  const typesList = types
    .map(type => `- **${type}**: ${FIELD_TYPE_DESCRIPTIONS[type]}`)
    .join('\n');
  
  return `## 字段类型说明
${typesList}`;
}

/**
 * Build examples section
 * @returns {string} Formatted section with examples
 */
function buildExamplesSection() {
  return `## 提取示例

**示例 1：**
文本："阿里C区2025年1月水位下降10米"
输出：
{
  "fields": [
    {"name": "区域", "value": "阿里C区", "type": "location", "confidence": 0.95},
    {"name": "时间", "value": "2025-01", "type": "time", "confidence": 0.95},
    {"name": "指标", "value": "水位", "type": "indicator", "confidence": 0.95},
    {"name": "变化", "value": "下降", "type": "indicator", "confidence": 0.9},
    {"name": "数值", "value": "10", "type": "number", "confidence": 0.95},
    {"name": "单位", "value": "米", "type": "unit", "confidence": 0.95}
  ]
}

**示例 2：**
文本："北京市2024年GDP增长5.2%"
输出：
{
  "fields": [
    {"name": "区域", "value": "北京市", "type": "location", "confidence": 0.95},
    {"name": "时间", "value": "2024", "type": "time", "confidence": 0.95},
    {"name": "指标", "value": "GDP", "type": "indicator", "confidence": 0.95},
    {"name": "变化", "value": "增长", "type": "indicator", "confidence": 0.9},
    {"name": "数值", "value": "5.2", "type": "number", "confidence": 0.95},
    {"name": "单位", "value": "%", "type": "unit", "confidence": 0.95}
  ]
}

**示例 3：**
文本："张三在阿里巴巴工作"
输出：
{
  "fields": [
    {"name": "人名", "value": "张三", "type": "entity", "confidence": 0.9},
    {"name": "组织", "value": "阿里巴巴", "type": "entity", "confidence": 0.95}
  ]
}`;
}

/**
 * Build constraints section
 * @returns {string} Formatted section with constraints
 */
function buildConstraintsSection() {
  return `## 重要约束
1. **不要推理**：只提取文本中明确出现的信息，不要根据常识推理
   - ❌ 错误：文本说"水位下降"，不要推理出"可能导致干旱"
   - ✅ 正确：只提取"水位"和"下降"这两个字段

2. **不要合并**：不要将多个字段合并成一个
   - ❌ 错误：将"10米"作为一个字段
   - ✅ 正确：分别提取"10"（数值）和"米"（单位）

3. **不要生成实体**：只提取字段，不要生成实体或关系
   - ❌ 错误：生成"阿里C区水位下降事件"这样的实体
   - ✅ 正确：只提取"阿里C区"、"水位"、"下降"等字段

4. **时间标准化**：时间字段应尽量标准化为 ISO 8601 格式
   - "2025年1月" → "2025-01"
   - "2024年1月15日" → "2024-01-15"
   - "上午10点" → "10:00"（如果有完整日期，使用 "2024-01-15T10:00:00"）

5. **置信度评估**：
   - 0.9-1.0：字段在文本中明确出现，无歧义
   - 0.7-0.9：字段在文本中出现，但可能有轻微歧义
   - 0.5-0.7：字段需要一定程度的解释或上下文理解
   - < 0.5：不要输出（置信度太低）

6. **避免重复**：如果字段已在"已提取字段"中，不要重复提取`;
}

/**
 * Build a semantic field extraction prompt for LLM
 * This prompt extracts fields with semantic names instead of type labels
 * 
 * @param {string} text - Text content from CKB
 * @param {Object} options - Additional options
 * @param {number} options.maxFields - Maximum number of fields to extract
 * @param {Object} options.schema - Target schema for guidance (optional)
 * @param {Array} options.existingFields - Already extracted fields (optional)
 * @returns {string} Semantic extraction prompt
 */
function buildSemanticFieldExtractionPrompt(text, options = {}) {
  const {
    maxFields = 30,  // 限制字段数量以避免输出过长
    schema = null,
    existingFields = []
  } = options;

  // Build schema guidance section if schema is provided
  const schemaSection = schema ? buildSchemaGuidanceSection(schema) : '';
  
  // Build existing fields section
  const existingFieldsSection = existingFields.length > 0 
    ? buildExistingFieldsSection(existingFields)
    : '';

  return `你是一个专业的信息抽取助手。你的任务是从文本中提取**语义字段**，用于构建知识图谱。

## 输入文本
${text}

${existingFieldsSection}

${schemaSection}

## 任务要求
1. 从文本中提取关键信息，使用**语义字段名**（如"目的地名称"、"景点名称"、"预算范围"、"行程天数"）
2. **不要使用类型标签**（如"区域"、"数值"、"时间"）作为字段名
3. **只提取明确出现在文本中的信息**，不要推理或生成
4. **尽可能提取所有重要字段**，特别是旅游领域的核心字段（目的地、景点、预算、时间、推荐理由、交通方式）
5. 最多提取 ${maxFields} 个字段
6. 每个字段必须包含：name（语义字段名）、value（字段值）、type（数据类型）、confidence（置信度0-1）

## 字段命名规则
- ✅ 使用语义字段名：目的地、景点名称、旅游天数、人均费用、推荐理由、交通方式
- ❌ 不要使用类型标签：区域、数值、时间、指标、单位

## 数据类型（type字段）
- location: 地点、位置
- time: 时间、日期
- number: 数值
- text: 文本描述
- entity: 实体名称

## 提取示例

**示例 1：旅游攻略（完整版）**
文本："我们在杭州玩了4天3晚，人均花费800元，冬天去最合适，风景优美，交通便利，主要景点有西湖、灵隐寺，建议坐高铁前往"
输出：
{
  "fields": [
    {"name": "目的地名称", "value": "杭州", "type": "location", "confidence": 0.95},
    {"name": "行程天数", "value": "4天3晚", "type": "time", "confidence": 0.95},
    {"name": "预算范围", "value": "800元", "type": "number", "confidence": 0.95},
    {"name": "最佳时间", "value": "冬天", "type": "time", "confidence": 0.9},
    {"name": "推荐理由", "value": "风景优美，交通便利", "type": "text", "confidence": 0.9},
    {"name": "交通方式", "value": "高铁", "type": "text", "confidence": 0.9},
    {"name": "景点名称", "value": "西湖", "type": "entity", "confidence": 0.95},
    {"name": "景点名称", "value": "灵隐寺", "type": "entity", "confidence": 0.95}
  ]
}

**示例 2：旅游攻略（多景点）**
文本："苏杭四日游，人均1000左右，春秋最佳。必去景点：西湖、乌镇、南浔古镇。特色美食多，古镇风情浓郁。"
输出：
{
  "fields": [
    {"name": "目的地名称", "value": "苏杭", "type": "location", "confidence": 0.95},
    {"name": "行程天数", "value": "四日", "type": "time", "confidence": 0.9},
    {"name": "预算范围", "value": "1000元", "type": "number", "confidence": 0.9},
    {"name": "最佳时间", "value": "春秋", "type": "time", "confidence": 0.9},
    {"name": "景点名称", "value": "西湖", "type": "entity", "confidence": 0.95},
    {"name": "景点名称", "value": "乌镇", "type": "entity", "confidence": 0.95},
    {"name": "景点名称", "value": "南浔古镇", "type": "entity", "confidence": 0.95},
    {"name": "推荐理由", "value": "特色美食多，古镇风情浓郁", "type": "text", "confidence": 0.9}
  ]
}

**重要提示（旅游领域）**：
- **必须提取的核心字段**：
  1. 目的地名称（如"杭州"、"苏杭"、"北京"）
  2. 景点名称（所有提到的景点，如"西湖"、"乌镇"、"长城"）
  3. 行程天数（如"4天3晚"、"三日游"、"一周"）
  4. 预算范围（如"800元"、"人均1000"、"3000左右"）
  5. 最佳时间（如"冬天"、"春季"、"3-5月"、"全年"）
  6. 推荐理由（如"风景优美"、"交通便利"、"历史悠久"、"美食多"）
  7. 交通方式（如"高铁"、"飞机"、"自驾"、"大巴"）
  8. 导游/联系人（如"小田"、"张导"、"李师傅"）

- **字段命名规则**：
  - 使用"目的地名称"而不是"目的地"或"地点"
  - 使用"预算范围"而不是"人均费用"、"价格"、"花费"
  - 使用"行程天数"而不是"天数"、"时长"
  - 使用"最佳时间"而不是"时间"、"季节"
  - 使用"推荐理由"而不是"特色"、"亮点"
  - 使用"交通方式"而不是"交通"、"出行方式"
  - 使用"导游"而不是"向导"、"领队"

- **提取技巧**：
  - 推荐理由：寻找形容词短语（"风景优美"、"交通便利"、"历史悠久"）
  - 交通方式：寻找交通工具（"高铁"、"飞机"、"自驾"、"大巴"）
  - 景点名称：提取所有地点实体，即使文本中有很多个
  - 预算范围：识别"人均"、"大概"、"左右"等词汇附近的数字

**示例 2：产品信息**
文本："iPhone 15 Pro售价7999元，配备A17芯片，支持5G网络"
输出：
{
  "fields": [
    {"name": "产品名称", "value": "iPhone 15 Pro", "type": "entity", "confidence": 0.95},
    {"name": "价格", "value": "7999元", "type": "number", "confidence": 0.95},
    {"name": "芯片型号", "value": "A17", "type": "entity", "confidence": 0.95},
    {"name": "网络支持", "value": "5G", "type": "text", "confidence": 0.95}
  ]
}

## 重要约束
1. **语义字段名**：字段名必须具有明确的语义含义
2. **不要推理**：只提取文本中明确出现的信息
3. **数量限制**：最多提取 ${maxFields} 个最重要的字段
4. **置信度评估**：
   - 0.9-1.0：信息明确，无歧义
   - 0.7-0.9：信息清晰，可能有轻微歧义
   - 0.5-0.7：需要一定理解
   - < 0.5：不要输出

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "fields": [
    {"name": "语义字段名", "value": "字段值", "type": "数据类型", "confidence": 0.9}
  ]
}`;
}

/**
 * Build a simplified prompt for quick extraction (fewer tokens)
 * 
 * @param {string} text - Text content from CKB
 * @param {Array} existingFields - Already extracted fields
 * @returns {string} Simplified prompt
 */
function buildSimplifiedPrompt(text, existingFields = []) {
  const existingFieldsStr = existingFields.length > 0
    ? `\n已提取：${existingFields.map(f => `${f.name}:${f.value}`).join(', ')}`
    : '';

  return `从文本提取字段（区域/时间/指标/数值/单位/实体）。只提取明确出现的信息，不推理。${existingFieldsStr}

文本：${text}

输出JSON：{"fields": [{"name":"字段名","value":"值","type":"location|time|number|unit|indicator|entity","confidence":0.9}]}

约束：
- 时间标准化为ISO 8601（如2025-01）
- 数值和单位分开
- 置信度<0.5不输出
- 无新字段返回{"fields":[]}`;
}

/**
 * Validate extracted fields from LLM response
 * 
 * @param {Array} fields - Fields to validate
 * @param {string} originalText - Original text for validation
 * @returns {Object} Validation result with valid fields and errors
 */
function validateExtractedFields(fields, originalText) {
  const validFields = [];
  const errors = [];

  if (!Array.isArray(fields)) {
    errors.push('Fields must be an array');
    return { validFields, errors };
  }

  fields.forEach((field, index) => {
    const fieldErrors = [];
    const fieldWarnings = [];

    // Validate required properties
    if (!field.name) fieldErrors.push('Missing name');
    if (!field.value) fieldErrors.push('Missing value');
    if (!field.type) fieldErrors.push('Missing type');

    // Validate field type
    if (field.type && !Object.values(FieldType).includes(field.type)) {
      fieldErrors.push(`Invalid type: ${field.type}`);
    }

    // Validate confidence
    if (field.confidence !== undefined) {
      if (typeof field.confidence !== 'number' || field.confidence < 0 || field.confidence > 1) {
        fieldErrors.push(`Invalid confidence: ${field.confidence}`);
      }
    }

    // Validate that value appears in original text (basic check)
    // This is a warning, not a hard error (value might be normalized)
    if (field.value && originalText && !originalText.includes(field.value)) {
      fieldWarnings.push(`Warning: value "${field.value}" not found in original text`);
    }

    // Only add to valid fields if no hard errors
    if (fieldErrors.length === 0) {
      validFields.push({
        name: field.name,
        value: field.value,
        type: field.type,
        confidence: field.confidence || 0.8,
        source: 'llm'
      });
      
      // Add warnings to errors array (they don't prevent field from being valid)
      if (fieldWarnings.length > 0) {
        errors.push(`Field ${index}: ${fieldWarnings.join(', ')}`);
      }
    } else {
      errors.push(`Field ${index}: ${fieldErrors.join(', ')}`);
    }
  });

  return { validFields, errors };
}

/**
 * Build a travel-specific field extraction prompt
 * Optimized for extracting travel destination recommendation fields
 * 
 * @param {string} text - Text content from CKB
 * @param {Object} options - Additional options
 * @param {number} options.maxFields - Maximum number of fields to extract
 * @param {Object} options.schema - Target schema for guidance (optional)
 * @param {Array} options.existingFields - Already extracted fields (optional)
 * @returns {string} Travel-specific extraction prompt
 */
function buildTravelFieldExtractionPrompt(text, options = {}) {
  const {
    maxFields = 50,  // 旅游文档可能有很多景点
    schema = null,
    existingFields = []
  } = options;

  // Build schema guidance section if schema is provided
  const schemaSection = schema ? buildSchemaGuidanceSection(schema) : '';
  
  // Build existing fields section
  const existingFieldsSection = existingFields.length > 0 
    ? buildExistingFieldsSection(existingFields)
    : '';

  return `你是一个专业的旅游信息抽取助手。你的任务是从旅游攻略文本中提取**完整的**结构化字段。

## 输入文本
${text}

${existingFieldsSection}

${schemaSection}

## 核心任务
从文本中提取以下**所有**出现的旅游相关字段：

### 必须提取的核心字段（如果文本中有）
1. **目的地名称**：旅游目的地（如"杭州"、"苏杭"、"北京"）
2. **景点名称**：所有提到的景点（如"西湖"、"乌镇"、"长城"）- 可以有多个
3. **行程天数**：旅游时长（如"4天3晚"、"三日游"、"一周"）
4. **预算范围**：人均费用（如"800元"、"人均1000"、"3000左右"）
5. **最佳时间**：最佳旅游时间（如"冬天"、"春季"、"3-5月"、"全年"）
6. **推荐理由**：推荐原因或特色（如"风景优美"、"交通便利"、"历史悠久"）
7. **交通方式**：交通工具（如"高铁"、"飞机"、"自驾"、"大巴"）
8. **导游**：导游或联系人（如"小田"、"张导"、"李师傅"）

### 可选字段（如果文本中有）
- 住宿信息（如"五星酒店"、"民宿"）
- 美食推荐（如"特色小吃"、"海鲜"）
- 注意事项（如"需要预约"、"避开节假日"）
- 联系方式（如电话、微信）

## 字段命名规则（严格遵守）
- ✅ 使用"目的地名称"（不是"目的地"、"地点"、"区域"）
- ✅ 使用"景点名称"（不是"景点"、"地点"）
- ✅ 使用"预算范围"（不是"人均费用"、"价格"、"花费"、"费用"）
- ✅ 使用"行程天数"（不是"天数"、"时长"、"行程"）
- ✅ 使用"最佳时间"（不是"时间"、"季节"、"月份"）
- ✅ 使用"推荐理由"（不是"特色"、"亮点"、"原因"）
- ✅ 使用"交通方式"（不是"交通"、"出行方式"）
- ✅ 使用"导游"（不是"向导"、"领队"、"联系人"）

## 数据类型（type字段）
- location: 地点、位置（目的地、景点）
- time: 时间、日期、时长（行程天数、最佳时间）
- number: 数值（预算）
- text: 文本描述（推荐理由、交通方式、导游）
- entity: 实体名称（景点名称、导游姓名）

## 提取示例

**示例 1：完整的旅游攻略**
文本："苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。风景优美，古镇风情浓郁。建议坐高铁前往，找当地导游小田（微信：17681896860）。"

输出：
{
  "fields": [
    {"name": "目的地名称", "value": "苏杭", "type": "location", "confidence": 0.95},
    {"name": "行程天数", "value": "四日", "type": "time", "confidence": 0.95},
    {"name": "预算范围", "value": "800多点", "type": "number", "confidence": 0.9},
    {"name": "最佳时间", "value": "冬天", "type": "time", "confidence": 0.95},
    {"name": "景点名称", "value": "西湖", "type": "entity", "confidence": 0.95},
    {"name": "景点名称", "value": "乌镇西栅", "type": "entity", "confidence": 0.95},
    {"name": "景点名称", "value": "南浔古镇", "type": "entity", "confidence": 0.95},
    {"name": "推荐理由", "value": "风景优美，古镇风情浓郁", "type": "text", "confidence": 0.9},
    {"name": "交通方式", "value": "高铁", "type": "text", "confidence": 0.9},
    {"name": "导游", "value": "小田", "type": "entity", "confidence": 0.9}
  ]
}

**示例 2：简短的旅游推荐**
文本："北京三日游，必去长城和故宫，春秋最佳，人均2000元。"

输出：
{
  "fields": [
    {"name": "目的地名称", "value": "北京", "type": "location", "confidence": 0.95},
    {"name": "行程天数", "value": "三日", "type": "time", "confidence": 0.95},
    {"name": "景点名称", "value": "长城", "type": "entity", "confidence": 0.95},
    {"name": "景点名称", "value": "故宫", "type": "entity", "confidence": 0.95},
    {"name": "最佳时间", "value": "春秋", "type": "time", "confidence": 0.9},
    {"name": "预算范围", "value": "2000元", "type": "number", "confidence": 0.95}
  ]
}

## 重要约束
1. **完整性优先**：尽可能提取所有核心字段，不要遗漏
2. **景点全提取**：文本中提到的所有景点都要提取，不要只提取一两个
3. **推荐理由必提取**：如果文本中有形容词短语（"风景优美"、"交通便利"、"历史悠久"、"美食多"），必须提取为"推荐理由"
4. **交通方式必提取**：如果文本中提到交通工具（"高铁"、"飞机"、"自驾"、"大巴"、"火车"），必须提取为"交通方式"
5. **字段名称标准化**：严格使用上述规定的字段名称，不要自创
6. **不要推理**：只提取文本中明确出现的信息
7. **置信度评估**：
   - 0.9-1.0：信息明确，无歧义
   - 0.7-0.9：信息清晰，可能有轻微歧义
   - 0.5-0.7：需要一定理解
   - < 0.5：不要输出

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "fields": [
    {"name": "字段名", "value": "字段值", "type": "数据类型", "confidence": 0.9}
  ]
}`;
}

/**
 * Build schema guidance section for prompt
 * @param {Object} schema - Target schema
 * @returns {string} Formatted schema guidance section
 */
function buildSchemaGuidanceSection(schema) {
  if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
    return '';
  }
  
  const schemaName = schema.name || schema.id || '目标Schema';
  const fieldsList = schema.fields
    .map(f => {
      const desc = f.description ? ` - ${f.description}` : '';
      return `- **${f.name}** (${f.type})${desc}`;
    })
    .join('\n');
  
  return `## 目标Schema指导
当前文档可能属于"${schemaName}" Schema，该Schema包含以下字段：

${fieldsList}

**提取建议**：
- 优先提取与Schema字段匹配的信息
- 使用Schema中定义的字段名称
- 如果文本中有Schema字段对应的信息，务必提取
- 也可以提取Schema之外的其他重要字段`;
}

/**
 * Get prompt statistics (for token estimation)
 * 
 * @param {string} prompt - The prompt text
 * @returns {Object} Statistics about the prompt
 */
function getPromptStats(prompt) {
  const lines = prompt.split('\n').length;
  const chars = prompt.length;
  // Rough token estimation: ~4 chars per token for Chinese text
  const estimatedTokens = Math.ceil(chars / 4);

  return {
    lines,
    chars,
    estimatedTokens
  };
}

/**
 * Validate extracted fields against a target schema
 * 
 * @param {Array} fields - Extracted fields to validate
 * @param {Object} schema - Target schema with field definitions
 * @returns {Object} Validation result with validated fields and warnings
 */
function validateFieldsAgainstSchema(fields, schema) {
  try {
    // Validate schema format
    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      console.warn('Invalid schema format, skipping validation');
      return {
        validatedFields: fields,
        warnings: ['Invalid schema format'],
        matchedCount: 0,
        unmatchedCount: fields.length
      };
    }
    
    const validatedFields = [];
    const warnings = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    for (const field of fields) {
      // Find matching schema field
      const schemaField = findMatchingSchemaField(field, schema);
      
      if (schemaField) {
        // Field matches schema
        matchedCount++;
        
        // Validate field type if schema specifies type
        if (schemaField.type && field.type !== schemaField.type) {
          warnings.push(
            `Field "${field.name}" type mismatch: expected ${schemaField.type}, got ${field.type}`
          );
        }
        
        validatedFields.push({
          ...field,
          schemaField: schemaField.name,
          schemaFieldType: schemaField.type,
          validated: true
        });
      } else {
        // Field doesn't match schema
        unmatchedCount++;
        warnings.push(`Field "${field.name}" not found in schema "${schema.name || schema.id}"`);
        
        validatedFields.push({
          ...field,
          validated: false
        });
      }
    }
    
    if (warnings.length > 0) {
      console.warn(`Schema validation: ${matchedCount} matched, ${unmatchedCount} unmatched`);
    }
    
    return {
      validatedFields,
      warnings,
      matchedCount,
      unmatchedCount,
      schemaId: schema.id || schema.name,
      coverage: fields.length > 0 ? matchedCount / fields.length : 0
    };
  } catch (error) {
    console.error('Schema validation error:', error);
    
    // Return fields without validation on error
    return {
      validatedFields: fields,
      warnings: [`Validation error: ${error.message}`],
      matchedCount: 0,
      unmatchedCount: fields.length,
      error: error.message
    };
  }
}

/**
 * Find matching schema field for an extracted field
 * Uses exact match, case-insensitive match, edit distance, and semantic similarity
 * 
 * @param {Object} field - Extracted field
 * @param {Object} schema - Target schema
 * @returns {Object|null} Matching schema field or null
 */
function findMatchingSchemaField(field, schema) {
  if (!schema.fields || !Array.isArray(schema.fields)) {
    return null;
  }
  
  const fieldName = field.name.trim();
  
  // Try exact match first
  let match = schema.fields.find(sf => sf.name === fieldName);
  if (match) {
    return match;
  }
  
  // Try case-insensitive match
  const fieldNameLower = fieldName.toLowerCase();
  match = schema.fields.find(sf => sf.name.toLowerCase() === fieldNameLower);
  if (match) {
    return match;
  }
  
  // Try fuzzy match with edit distance (threshold: 3)
  const editDistanceThreshold = 3;
  for (const schemaField of schema.fields) {
    const distance = calculateEditDistance(fieldName, schemaField.name);
    if (distance <= editDistanceThreshold) {
      return schemaField;
    }
  }
  
  // Try semantic similarity (substring matching)
  // Check if field name contains schema field name or vice versa
  for (const schemaField of schema.fields) {
    if (fieldName.includes(schemaField.name) || schemaField.name.includes(fieldName)) {
      return schemaField;
    }
  }
  
  // Try semantic similarity with common variations
  // For example: "目的地" matches "目的地名称", "预算" matches "预算范围"
  const semanticSimilarity = calculateSemanticSimilarity(fieldName, schema.fields);
  if (semanticSimilarity.score > 0.8) {
    return semanticSimilarity.field;
  }
  
  return null;
}

/**
 * Calculate semantic similarity between field name and schema fields
 * Uses token-based similarity and common word matching
 * 
 * @param {string} fieldName - Extracted field name
 * @param {Array} schemaFields - Schema field definitions
 * @returns {Object} Best match with score
 */
function calculateSemanticSimilarity(fieldName, schemaFields) {
  let bestMatch = null;
  let bestScore = 0;
  
  for (const schemaField of schemaFields) {
    const score = calculateSimilarityScore(fieldName, schemaField.name);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = schemaField;
    }
  }
  
  return {
    field: bestMatch,
    score: bestScore
  };
}

/**
 * Calculate similarity score between two field names
 * Uses character overlap and token matching
 * 
 * @param {string} name1 - First field name
 * @param {string} name2 - Second field name
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarityScore(name1, name2) {
  // Normalize names
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  
  // Exact match
  if (n1 === n2) {
    return 1.0;
  }
  
  // Substring match
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = n1.length < n2.length ? n1 : n2;
    const longer = n1.length >= n2.length ? n1 : n2;
    return shorter.length / longer.length;
  }
  
  // Character overlap
  const chars1 = new Set(n1.split(''));
  const chars2 = new Set(n2.split(''));
  const intersection = new Set([...chars1].filter(c => chars2.has(c)));
  const union = new Set([...chars1, ...chars2]);
  
  const jaccardSimilarity = intersection.size / union.size;
  
  // Edit distance similarity
  const maxLen = Math.max(n1.length, n2.length);
  const editDist = calculateEditDistance(n1, n2);
  const editSimilarity = 1 - (editDist / maxLen);
  
  // Combine scores (weighted average)
  return (jaccardSimilarity * 0.4) + (editSimilarity * 0.6);
}

/**
 * Normalize field name to match schema field name
 * Returns the schema field name if a match is found, otherwise returns original name
 * 
 * @param {string} fieldName - Extracted field name
 * @param {Object} schema - Target schema
 * @returns {string} Normalized field name
 */
function normalizeFieldName(fieldName, schema) {
  if (!schema || !schema.fields) {
    return fieldName;
  }
  
  const field = { name: fieldName };
  const matchedField = findMatchingSchemaField(field, schema);
  
  return matchedField ? matchedField.name : fieldName;
}

/**
 * Calculate Levenshtein edit distance between two strings
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function calculateEditDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create distance matrix
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

module.exports = {
  buildFieldExtractionPrompt,
  buildSemanticFieldExtractionPrompt,
  buildTravelFieldExtractionPrompt,
  buildSimplifiedPrompt,
  validateExtractedFields,
  validateFieldsAgainstSchema,
  findMatchingSchemaField,
  normalizeFieldName,
  calculateEditDistance,
  calculateSemanticSimilarity,
  calculateSimilarityScore,
  buildSchemaGuidanceSection,
  getPromptStats,
  FIELD_TYPE_DESCRIPTIONS
};

