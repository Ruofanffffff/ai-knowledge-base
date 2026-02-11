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
    styleGuidance = '\n- 使用专业、正式的语言风格';
  } else if (style === 'casual') {
    styleGuidance = '\n- 使用轻松、口语化的语言风格';
  } else {
    styleGuidance = '\n- 使用富有创意和想象力的语言风格';
  }

  const contextSection = context ? `\n\n背景信息：\n${context}` : '';

  return `你是一个创意写作助手。请根据用户提供的文本进行扩展，并生成适合图像生成的提示词。

用户文本：
${text}${contextSection}

要求：
1. 扩展文本：在保持原意的基础上，增加细节、描述和想象力
2. 图像提示词：生成一个详细的、适合Midjourney/DALL-E的图像生成提示词
3. 扩展后的文本应该是原文的2-3倍长度
4. 图像提示词应包含风格、构图、色彩、氛围等元素${styleGuidance}

输出格式（JSON）：
{
  "expandedText": "扩展后的文本",
  "imagePrompt": "图像生成提示词"
}`;
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

  return `你是一个专业的文本校对助手。请校对以下文本，纠正错误但保持原意和风格。

文本：
${text}

要求：
1. 纠正拼写错误
2. 修正语法错误
3. 纠正标点符号错误
4. 修正明显的用词不当
5. 保持原意、写作风格和句式结构
6. 列出所有修改
${languageGuidance}

输出格式（JSON）：
{
  "correctedText": "校对后的文本",
  "changes": [
    {
      "type": "spelling|grammar|punctuation|word-choice",
      "original": "原文",
      "corrected": "修正后",
      "position": {"start": 0, "end": 10},
      "reason": "修改原因"
    }
  ]
}`;
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

  return `你是一个数据整理助手。请从以下文本中提取信息并整理成表格。

文本：
${text}

要求：
1. 识别文本中的结构化信息
2. 确定最合适的表格结构（列数和列名）
3. 提取数据并填充表格
4. 确保数据准确、清晰、可读
5. 列数不超过${maxColumns}列
6. 如果文本不适合表格化，说明原因

输出格式（JSON）：
{
  "headers": ["列1", "列2", "列3"],
  "rows": [
    ["数据1", "数据2", "数据3"],
    ["数据4", "数据5", "数据6"]
  ],
  "notes": "可选的说明或注释"
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
  const { maxBranches = 6, maxDepth = 3 } = options;

  return `你是一个思维导图专家。请将以下文本转换为脑图结构。

文本：
${text}

要求：
1. 识别中心主题
2. 创建3-${maxBranches}个一级分支
3. 为每个一级分支创建2-4个二级分支（如果适用）
4. 使用简短的关键词作为标签（不超过10个字）
5. 确保层级结构清晰
6. 最大深度为${maxDepth}层

输出格式（JSON）：
{
  "central": "中心主题",
  "branches": [
    {
      "label": "分支1",
      "children": [
        {"label": "子分支1.1"},
        {"label": "子分支1.2"}
      ]
    },
    {
      "label": "分支2",
      "children": [
        {"label": "子分支2.1"}
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
