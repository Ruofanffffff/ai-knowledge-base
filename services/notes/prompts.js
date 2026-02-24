/**
 * LLM Prompt Templates for Notes Feature
 * 
 * Provides structured prompts for:
 * - Image analysis (text recognition and content analysis)
 * - Smart generation (text expansion and image prompt generation)
 * - Smart proofreading
 * - Table generation
 * - Mind map generation
 * 
 * Validates: Requirements 2.3, 5.2, 6.1, 7.1, 8.1
 */

/**
 * Image Analysis Prompts
 */

/**
 * Text recognition prompt for images
 * Requirement 2.3: Use LLM for text recognition
 * 
 * @param {Object} options - Prompt options
 * @param {string} [options.imageType] - Type of image (document, screenshot, handwritten, etc.)
 * @returns {string} Prompt text
 */
function createTextRecognitionPrompt(options = {}) {
  const { imageType } = options;

  let specificInstructions = '';
  
  if (imageType === 'document' || imageType === 'screenshot') {
    specificInstructions = '\n特别注意：这是文档或截图，请保持原文的格式和结构，包括段落、列表、标题等。';
  } else if (imageType === 'handwritten') {
    specificInstructions = '\n特别注意：这是手写文字，可能不太清晰，请尽力识别，对不确定的字标注[不清晰]。';
  }

  return `你是一个专业的图像文字识别助手。请分析这张图片并提取其中的所有文字内容。

要求：
1. 识别图片中的所有可见文字，包括印刷体和手写体
2. 保持原文的格式和结构
3. 如果文字不清晰，标注[不清晰]
4. 按照从上到下、从左到右的顺序输出${specificInstructions}

输出格式：
纯文本，保持原文格式`;
}

/**
 * Image content analysis prompt
 * Requirement 2.3, 2.4: Use LLM for content understanding
 * 
 * @param {Object} options - Prompt options
 * @param {string} [options.analysisType] - Type of analysis (general, detailed, tags-only)
 * @returns {string} Prompt text
 */
function createImageContentAnalysisPrompt(options = {}) {
  const { analysisType = 'general' } = options;

  let detailLevel = '';
  
  if (analysisType === 'detailed') {
    detailLevel = '\n- 提供详细的场景描述，包括环境、氛围、色彩等\n- 分析图片的构图和视觉特点';
  } else if (analysisType === 'tags-only') {
    detailLevel = '\n- 重点关注生成准确的标签，描述可以简短';
  }

  return `你是一个专业的图像内容分析助手。请分析这张图片并提供详细描述。

要求：
1. 描述图片的主要内容和主题
2. 识别图片类型（风景、人物、产品、艺术作品、电影/动画截图、混合内容等）
3. 提取关键元素和特征
4. 生成3-5个相关标签${detailLevel}

输出格式（JSON）：
{
  "description": "详细描述",
  "type": "图片类型",
  "elements": ["元素1", "元素2"],
  "tags": ["标签1", "标签2", "标签3"]
}`;
}

/**
 * Combined image analysis prompt (text + content)
 * @param {Object} options - Prompt options
 * @returns {string} Prompt text
 */
function createFullImageAnalysisPrompt(options = {}) {
  return `你是一个专业的图像分析助手。请全面分析这张图片，包括文字识别和内容理解。

要求：
1. 文字识别：提取图片中的所有可见文字（如果有）
2. 内容分析：描述图片的主要内容、类型和特征
3. 标签生成：生成3-5个相关标签

输出格式（JSON）：
{
  "textContent": "识别的文字内容（如果没有文字则为空字符串）",
  "description": "图片内容描述",
  "type": "图片类型",
  "tags": ["标签1", "标签2", "标签3"]
}`;
}

/**
 * AI Enhancement Prompts
 */

/**
 * Smart generation prompt (text expansion + image prompt)
 * Requirement 5.2: Expand text and generate image prompts
 * 
 * @param {string} text - User's text to expand
 * @param {Object} options - Prompt options
 * @param {string} [options.context] - Additional context
 * @param {string} [options.style] - Desired style (creative, professional, casual)
 * @returns {string} Prompt text
 */
function createSmartGenerationPrompt(text, options = {}) {
  const { context, style = 'creative' } = options;

  let styleGuidance = '';
  if (style === 'professional') {
    styleGuidance = `\n## 风格要求\n- 使用专业正式的语言风格\n- 措辞严谨、逻辑清晰、避免口语化表达`;
  } else if (style === 'casual') {
    styleGuidance = `\n## 风格要求\n- 使用轻松口语化的语言风格\n- 自然亲切、可以适当使用日常用语和轻松的表达方式`;
  } else {
    styleGuidance = `\n## 风格要求\n- 保持创意但克制的风格\n- 在表达上有想象力，但不过度修饰`;
  }

  const contextSection = context ? `\n\n## 背景信息\n${context}` : '';

  return `## 角色定义
你是一位专业、克制、有审美判断力的内容与影像生成助手。

## 核心原则
- 不改变原文立场、情绪与风格
- 不引入无关主题
- 避免空话和套路化表达
- 内容具体、有画面感、有信息密度
- 影像描述真实、可拍、避免抽象词

## 文本扩写规则
- 不重复原文句子
- 自然衔接原文
- 让内容更完整而非更啰嗦

## 照片生成规则
- 以真实摄影为目标而非插画或概念图
- 描述清晰的主体、环境、光线、构图、情绪
- 使用自然语言描述而非堆砌形容词
- 不出现文字、logo、水印
- 人物特写时不指定具体人脸
${styleGuidance}

## 输出格式
请严格以 JSON 格式输出，不要包含任何其他内容：
{
  "expandedText": "扩写后的文本",
  "imagePrompt": "照片生成描述"
}

## 用户原始文本
${text}${contextSection}`;
}


/**
 * Smart proofreading prompt
 * Requirement 6.1: Correct errors while preserving meaning and style
 * 
 * @param {string} text - Text to proofread
 * @param {Object} options - Prompt options
 * @param {string} [options.language] - Language (zh, en)
 * @returns {string} Prompt text
 */
function createSmartProofreadingPrompt(text, options = {}) {
  const { language = 'zh' } = options;

  const languageGuidance = language === 'en' 
    ? 'Focus on English grammar, spelling, and punctuation.'
    : '重点关注中文的语法、错别字和标点符号。';

  return `## 角色定义
你是一位专业严谨的中文校对助手。

## 核心原则
- 只修正明确的错误，不做主观优化
- 保持原文的句式结构、语气和风格
- 不扩写、不删除观点、不改变表达方式

## 校对范围（只修正以下类型）
1. 错别字（如"以经"→"已经"）
2. 病句（明显语法错误）
3. 标点符号错误（如中英文标点混用、缺失标点）
4. 明显用词不当（如"反应情况"→"反映情况"）

## 禁止操作
- 不改变句式结构
- 不扩写内容
- 不删除任何观点
- 不改变语气和风格
${languageGuidance}

## 输出格式
请严格以 JSON 格式输出，不要包含任何其他内容：
{
  "correctedText": "校对后的完整文本",
  "changes": [
    {
      "type": "spelling|grammar|punctuation|word-choice",
      "original": "原文片段",
      "corrected": "修正后片段",
      "reason": "修改原因"
    }
  ]
}

如果原文没有任何错误，返回：
{
  "correctedText": "原文内容不变",
  "changes": []
}

## 待校对文本
${text}`;
}

/**
 * Table generation prompt
 * Requirement 7.1: Extract information and create table structure
 * 
 * @param {string} text - Text to convert to table
 * @param {Object} options - Prompt options
 * @param {number} [options.maxColumns] - Maximum number of columns
 * @returns {string} Prompt text
 */
function createTableGenerationPrompt(text, options = {}) {
  const { maxColumns = 10 } = options;

  return `## 角色定义
你是一个"信息结构化助手"，擅长从自然语言中提取信息，并将其整理为清晰、准确、可读的表格。

## 规则
- 只基于用户提供的内容进行整理，不允许编造信息
- 表格结构应符合内容本身的逻辑，而不是固定模板
- 如果信息不完整，需要在表格中明确标注"原文未提及"
- 优先保证表格对人类阅读友好，而非追求形式复杂
- 列数不超过${maxColumns}列

## 用户请求
请将以下内容整理为一个表格。要求：
- 自动判断最合适的表格类型（如信息表、对比表、清单、时间线）
- 表格需覆盖文本中的核心信息
- 表格结构清晰，字段命名简洁
- 不要添加原文中不存在的信息

文本内容：
"""
${text}
"""

## 输出格式
请严格以 JSON 格式输出，不要包含任何其他内容：
{
  "table_type": "表格类型",
  "columns": ["列1", "列2", "..."],
  "rows": [
    ["行1列1", "行1列2", "..."],
    ["行2列1", "行2列2", "..."]
  ],
  "summary": "一句话说明该表格整理了什么"
}`;
}

/**
 * Mind map generation prompt
 * Requirement 8.1: Identify central theme and create branches
 * 
 * @param {string} text - Text to convert to mind map
 * @param {Object} options - Prompt options
 * @param {number} [options.maxBranches] - Maximum number of first-level branches
 * @param {number} [options.maxDepth] - Maximum depth of branches
 * @returns {string} Prompt text
 */
function createMindMapGenerationPrompt(text, options = {}) {
  const { maxBranches = 6, maxDepth } = options;

  const depthRule = maxDepth != null
    ? `\n6. 最大层级深度不超过 ${maxDepth} 层`
    : '';

  return `## 角色定义
你是一位脑图结构生成助手，擅长将自然语言内容拆解为清晰的层级结构。

## 规则
1. 先提炼一个能概括全文的中心主题
2. 将内容拆解为 3-${maxBranches} 个一级分支
3. 每个节点用简短关键词或短语表达（不超过20个字符）
4. 层级清晰，避免重复与交叉
5. 不添加原文未提及的新观点${depthRule}

## 用户请求
请根据以下文本内容生成脑图结构：
- 自动提炼中心主题
- 拆解清晰的层级结构
- 使用关键词而非长句
- 结构适合脑图展示

## 文本内容
"""
${text}
"""

## 输出格式
请严格以 JSON 格式输出，不要包含任何其他内容：
{
  "central_topic": "中心主题",
  "nodes": [
    {
      "id": "1",
      "text": "一级分支1",
      "children": [
        { "id": "1-1", "text": "子节点1" },
        { "id": "1-2", "text": "子节点2" }
      ]
    }
  ]
}`;
}


/**
 * Validate prompt parameters
 * @param {string} text - Text parameter
 * @param {string} paramName - Parameter name for error message
 * @throws {Error} If text is invalid
 */
function validateTextParameter(text, paramName = 'text') {
  if (!text || typeof text !== 'string') {
    throw new Error(`${paramName} must be a non-empty string`);
  }
  
  if (text.trim().length === 0) {
    throw new Error(`${paramName} cannot be empty or whitespace only`);
  }
}

/**
 * Build prompt with validation
 * @param {Function} promptBuilder - Prompt builder function
 * @param {Array} args - Arguments for prompt builder
 * @returns {string} Built prompt
 */
function buildPrompt(promptBuilder, ...args) {
  try {
    return promptBuilder(...args);
  } catch (error) {
    throw new Error(`Failed to build prompt: ${error.message}`);
  }
}

module.exports = {
  // Image analysis prompts
  createTextRecognitionPrompt,
  createImageContentAnalysisPrompt,
  createFullImageAnalysisPrompt,
  
  // AI enhancement prompts
  createSmartGenerationPrompt,
  createSmartProofreadingPrompt,
  createTableGenerationPrompt,
  createMindMapGenerationPrompt,
  
  // Utilities
  validateTextParameter,
  buildPrompt
};
