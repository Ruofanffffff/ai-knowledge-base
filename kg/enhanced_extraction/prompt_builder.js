/**
 * Prompt Builder for LLM-Enhanced Entity Extraction
 * 
 * Constructs prompts for LLM to extract semantic entities and relations.
 * Supports Chinese and English with few-shot examples.
 */

class PromptBuilder {
  constructor(options = {}) {
    this.language = options.language || 'zh';
    this.includeExamples = options.includeExamples !== false;
  }

  /**
   * Build entity extraction prompt
   * @param {string} text - Document text
   * @param {Object} context - Context information (e.g., algorithm results)
   * @returns {string} Prompt for LLM
   */
  buildEntityExtractionPrompt(text, context = {}) {
    const language = context.language || this.language;
    
    if (language === 'en') {
      return this._buildEnglishEntityPrompt(text, context);
    }
    return this._buildChineseEntityPrompt(text, context);
  }

  /**
   * Build relation extraction prompt
   * @param {Array} entities - Already extracted entities
   * @param {string} text - Document text
   * @returns {string} Prompt for LLM
   */
  buildRelationExtractionPrompt(entities, text) {
    const language = this.language;
    
    if (language === 'en') {
      return this._buildEnglishRelationPrompt(entities, text);
    }
    return this._buildChineseRelationPrompt(entities, text);
  }

  /**
   * Build Chinese entity extraction prompt
   * @private
   */
  _buildChineseEntityPrompt(text, context) {
    const systemPrompt = `你是一个专业的知识图谱实体提取助手。你的任务是从文档中提取语义概念、细粒度实体和它们的属性。

请提取以下类型的实体：
1. **语义概念** (semantic_concept): 抽象概念，如"人物肖像"、"风景摄影"、"三分法构图"
2. **镜头实体** (lens): 具体的镜头型号，包含焦距、光圈等属性
3. **技巧实体** (technique): 拍摄技巧，包含使用方法描述
4. **场景实体** (scene): 使用场景，如"室内拍摄"、"户外拍摄"

**重要规则**：
- 为每个具体对象创建独立实体，不要聚合
- 为每个实体生成描述性文本
- 提供置信度分数（0-1之间）
- 保留原始语言

**输出格式**（JSON）：
\`\`\`json
{
  "entities": [
    {
      "type": "lens",
      "name": "SEL35F18F",
      "properties": {
        "focalLength": "35mm",
        "maxAperture": "F1.8",
        "description": "适合人文和街拍的定焦镜头",
        "suitableScenes": ["街拍", "人文摄影", "室内拍摄"]
      },
      "confidence": 0.95
    }
  ]
}
\`\`\``;

    let prompt = systemPrompt;

    // Add few-shot examples if enabled
    if (this.includeExamples) {
      prompt += '\n\n' + this._getChineseFewShotExamples();
    }

    // Add context if available
    if (context.algorithmResults && context.algorithmResults.length > 0) {
      prompt += `\n\n**已提取的数值参数**（请勿重复提取）：\n`;
      context.algorithmResults.forEach(param => {
        prompt += `- ${param.name}: ${param.value}\n`;
      });
    }

    // Add the actual text to analyze
    prompt += `\n\n**待分析文档**：\n\`\`\`\n${text}\n\`\`\`\n\n请提取实体（JSON格式）：`;

    return prompt;
  }

  /**
   * Build English entity extraction prompt
   * @private
   */
  _buildEnglishEntityPrompt(text, context) {
    const systemPrompt = `You are a professional knowledge graph entity extraction assistant. Your task is to extract semantic concepts, fine-grained entities, and their properties from documents.

Please extract the following types of entities:
1. **Semantic Concepts** (semantic_concept): Abstract concepts like "portrait photography", "landscape photography", "rule of thirds"
2. **Lens Entities** (lens): Specific lens models with focal length, aperture, etc.
3. **Technique Entities** (technique): Photography techniques with usage descriptions
4. **Scene Entities** (scene): Usage scenarios like "indoor shooting", "outdoor shooting"

**Important Rules**:
- Create separate entities for each specific object, don't aggregate
- Generate descriptive text for each entity
- Provide confidence scores (between 0-1)
- Preserve original language

**Output Format** (JSON):
\`\`\`json
{
  "entities": [
    {
      "type": "lens",
      "name": "SEL35F18F",
      "properties": {
        "focalLength": "35mm",
        "maxAperture": "F1.8",
        "description": "Prime lens suitable for street and documentary photography",
        "suitableScenes": ["street photography", "documentary", "indoor"]
      },
      "confidence": 0.95
    }
  ]
}
\`\`\``;

    let prompt = systemPrompt;

    // Add few-shot examples if enabled
    if (this.includeExamples) {
      prompt += '\n\n' + this._getEnglishFewShotExamples();
    }

    // Add context if available
    if (context.algorithmResults && context.algorithmResults.length > 0) {
      prompt += `\n\n**Already Extracted Numerical Parameters** (do not extract again):\n`;
      context.algorithmResults.forEach(param => {
        prompt += `- ${param.name}: ${param.value}\n`;
      });
    }

    // Add the actual text to analyze
    prompt += `\n\n**Document to Analyze**:\n\`\`\`\n${text}\n\`\`\`\n\nPlease extract entities (JSON format):`;

    return prompt;
  }

  /**
   * Build Chinese relation extraction prompt
   * @private
   */
  _buildChineseRelationPrompt(entities, text) {
    const entityList = entities.map(e => `- ${e.name} (${e.type})`).join('\n');

    return `你是一个专业的知识图谱关系提取助手。请从文档中提取实体之间的语义关系。

**已提取的实体**：
${entityList}

**关系类型**：
1. **suitable_for** (适用于): 镜头/技巧适用于某个场景
2. **recommended_for** (推荐用于): 推荐用于特定用途
3. **applies_to** (应用于): 技巧应用于某个对象
4. **affects** (影响): 参数对效果的影响

**重要规则**：
- 必须返回JSON格式
- 不要添加任何解释性文字
- 如果没有找到关系，返回空数组：{"relations": []}
- 只提取文档中明确提到的关系

**输出格式**（必须是纯JSON）：
\`\`\`json
{
  "relations": [
    {
      "type": "suitable_for",
      "source": "SEL35F18F",
      "target": "人文摄影",
      "confidence": 0.90
    }
  ]
}
\`\`\`

**文档内容**：
\`\`\`
${text}
\`\`\`

请提取关系（必须返回JSON格式，不要添加任何其他文字）：`;
  }

  /**
   * Build English relation extraction prompt
   * @private
   */
  _buildEnglishRelationPrompt(entities, text) {
    const entityList = entities.map(e => `- ${e.name} (${e.type})`).join('\n');

    return `You are a professional knowledge graph relation extraction assistant. Please extract semantic relations between entities from the document.

**Extracted Entities**:
${entityList}

**Relation Types**:
1. **suitable_for**: Lens/technique suitable for a scene
2. **recommended_for**: Recommended for specific purpose
3. **applies_to**: Technique applies to an object
4. **affects**: Parameter affects an outcome

**Important Rules**:
- Must return JSON format
- Do not add any explanatory text
- If no relations found, return empty array: {"relations": []}
- Only extract relations explicitly mentioned in the document

**Output Format** (must be pure JSON):
\`\`\`json
{
  "relations": [
    {
      "type": "suitable_for",
      "source": "SEL35F18F",
      "target": "street photography",
      "confidence": 0.90
    }
  ]
}
\`\`\`

**Document Content**:
\`\`\`
${text}
\`\`\`

Please extract relations (must return JSON format, no other text):`;
  }

  /**
   * Get Chinese few-shot examples
   * @private
   */
  _getChineseFewShotExamples() {
    return `**示例1**：

文档：
"35mm定焦镜头SEL35F18F是索尼E卡口的经典镜头，最大光圈F1.8，重量仅280g。这支镜头非常适合街拍和人文摄影，在室内弱光环境下也能获得出色的表现。"

提取结果：
\`\`\`json
{
  "entities": [
    {
      "type": "lens",
      "name": "SEL35F18F",
      "properties": {
        "focalLength": "35mm",
        "maxAperture": "F1.8",
        "weight": "280g",
        "description": "索尼E卡口的经典定焦镜头，适合街拍和人文摄影",
        "suitableScenes": ["街拍", "人文摄影", "室内弱光"]
      },
      "confidence": 0.95
    },
    {
      "type": "technique",
      "name": "街拍",
      "properties": {
        "description": "在街头捕捉日常生活瞬间的摄影方式"
      },
      "confidence": 0.90
    }
  ]
}
\`\`\``;
  }

  /**
   * Get English few-shot examples
   * @private
   */
  _getEnglishFewShotExamples() {
    return `**Example 1**:

Document:
"The 35mm prime lens SEL35F18F is a classic Sony E-mount lens with a maximum aperture of F1.8 and weighs only 280g. This lens is perfect for street and documentary photography, and performs excellently in low-light indoor environments."

Extraction Result:
\`\`\`json
{
  "entities": [
    {
      "type": "lens",
      "name": "SEL35F18F",
      "properties": {
        "focalLength": "35mm",
        "maxAperture": "F1.8",
        "weight": "280g",
        "description": "Classic Sony E-mount prime lens, perfect for street and documentary photography",
        "suitableScenes": ["street photography", "documentary", "low-light indoor"]
      },
      "confidence": 0.95
    },
    {
      "type": "technique",
      "name": "street photography",
      "properties": {
        "description": "Capturing everyday moments on the streets"
      },
      "confidence": 0.90
    }
  ]
}
\`\`\``;
  }

  /**
   * Set language for prompts
   * @param {string} language - 'zh' or 'en'
   */
  setLanguage(language) {
    this.language = language;
  }

  /**
   * Enable or disable few-shot examples
   * @param {boolean} enabled
   */
  setIncludeExamples(enabled) {
    this.includeExamples = enabled;
  }
}

module.exports = PromptBuilder;
