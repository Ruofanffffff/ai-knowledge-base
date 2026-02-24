/**
 * AI Insights Service
 * 
 * Analyzes editor content via LLM with incremental merge support:
 * - Full analysis for first-time content
 * - Focused analysis for added content (append mode)
 * - Re-analysis for edited content (replace mode)
 */

const { createTextLLMClient } = require('./notes/llmClient');
const { notesConfig } = require('../config/notes.config');

class AIInsightsService {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 120000,
      ...config
    };

    this.llmClient = createTextLLMClient({
      apiKey: config.apiKey || notesConfig.textLLM?.apiKey,
      model: config.model || notesConfig.textLLM?.model,
      timeout: this.config.timeout,
      maxRetries: 1
    });
  }

  /**
   * Analyze content with incremental merge support.
   * 
   * @param {Object} params
   * @param {string} params.text - Full document text
   * @param {string} [params.addedText] - Newly added paragraphs
   * @param {string} [params.editedText] - Edited paragraphs
   * @param {boolean} [params.hasExistingInsights] - Whether client has existing insights
   * @returns {Promise<{data: Object, mode: string}>} Insights data + merge mode
   */
  async analyzeContent({ text, addedText, editedText, hasExistingInsights }) {
    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return {
        data: {
          concepts: [],
          references: [],
          summary: '',
          message: '内容较短，请继续写作以获取 AI 洞察'
        },
        mode: 'full'
      };
    }

    const hasAdded = addedText && typeof addedText === 'string' && addedText.trim().length > 0;
    const hasEdited = editedText && typeof editedText === 'string' && editedText.trim().length > 0;

    // Determine analysis strategy
    if (!hasExistingInsights || (!hasAdded && !hasEdited)) {
      // First time or no detectable changes → full analysis
      return this._fullAnalysis(text);
    }

    if (hasEdited) {
      // User edited existing content → re-analyze with full context, replace mode
      return this._editAnalysis(text, editedText, addedText);
    }

    if (hasAdded) {
      // User only added new content → focused analysis, append mode
      return this._appendAnalysis(text, addedText);
    }

    return this._fullAnalysis(text);
  }

  /**
   * Full analysis - first time or when no incremental diff available
   * @private
   */
  async _fullAnalysis(text) {
    const prompt = this._buildPrompt(text);
    try {
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt, config: { maxTokens: 4000, temperature: 0.7 } }),
        this.config.timeout
      );
      return { data: this._validateAndNormalize(result.data), mode: 'full' };
    } catch (error) {
      throw new Error(`AI insights analysis failed: ${error.message}`);
    }
  }

  /**
   * Append analysis - only new content added, results will be appended
   * @private
   */
  async _appendAnalysis(fullText, addedText) {
    const prompt = this._buildAppendPrompt(fullText, addedText);
    try {
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt, config: { maxTokens: 3000, temperature: 0.7 } }),
        this.config.timeout
      );
      return { data: this._validateAndNormalize(result.data, false), mode: 'append' };
    } catch (error) {
      throw new Error(`AI insights append analysis failed: ${error.message}`);
    }
  }

  /**
   * Edit analysis - existing content was modified, results will replace
   * @private
   */
  async _editAnalysis(fullText, editedText, addedText) {
    const combinedChanges = addedText
      ? editedText + '\n\n' + addedText
      : editedText;
    const prompt = this._buildEditPrompt(fullText, combinedChanges);
    try {
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt, config: { maxTokens: 4000, temperature: 0.7 } }),
        this.config.timeout
      );
      return { data: this._validateAndNormalize(result.data), mode: 'replace' };
    } catch (error) {
      throw new Error(`AI insights edit analysis failed: ${error.message}`);
    }
  }

  /**
   * Build full analysis prompt
   * @private
   */
  _buildPrompt(text) {
    return `你是用户的私人写作顾问。用户正在编辑一篇文档，你需要帮助他深入理解自己写的内容。

【最重要的规则】你的所有输出必须直接引用或回应用户原文中的具体词句、观点、事实。禁止输出与用户原文无关的通用知识。如果用户写的是旅行攻略，你就分析旅行攻略；如果写的是技术文档，你就分析技术文档。

请返回严格JSON格式（不要包含任何其他文字）：

{
  "concepts": [
    {
      "name": "从用户原文中提取的核心概念（必须是原文提到或直接涉及的）",
      "keywords": ["原文关键词1", "原文关键词2"],
      "description": "80-150字。先指出用户原文中哪里提到了这个概念，再解释为什么这个概念在用户的语境下很重要，最后给出**用户可能没意识到的深层洞察**。用**双星号**标记最关键的1-2句话。"
    }
  ],
  "references": [
    {
      "title": "真实书名或文章名",
      "author": "真实作者",
      "keywords": ["与用户主题相关的标签"],
      "description": "60-120字。说明这个参考资料如何帮助用户深化正在写的内容，**用双星号标记核心观点**。"
    }
  ],
  "summary": "200-350字。逐一梳理用户原文中的各个要点，分析它们之间的内在联系和逻辑脉络。必须具体提及用户原文中的内容。用**双星号**标记3-5句最重要的洞察。"
}

要求：
- concepts 3-5个，必须从用户原文中提取
- references 1-3个，必须与用户正在写的具体主题直接相关
- 所有description中必须能找到与用户原文的具体对应关系

用户正在编辑的内容：
${text}`;
  }

  /**
   * Build append prompt - for newly added content only
   * @private
   */
  _buildAppendPrompt(fullText, addedText) {
    return `你是用户的私人写作顾问。用户正在编辑一篇文档，刚刚新增了一些内容。你需要只针对新增部分生成补充洞察，这些洞察会追加到已有分析结果后面。

【最重要的规则】你只需要分析用户新增的内容。不要重复已有内容的分析。你的输出是对已有洞察的补充。

请返回严格JSON格式（不要包含任何其他文字）：

{
  "concepts": [
    {
      "name": "从新增内容中提取的概念",
      "keywords": ["关键词1", "关键词2"],
      "description": "80-150字。针对新增内容分析这个概念的意义，给出**深层洞察**。用**双星号**标记关键句。"
    }
  ],
  "references": [
    {
      "title": "真实书名或文章名",
      "author": "真实作者",
      "keywords": ["标签"],
      "description": "60-120字。说明这个参考资料如何帮助用户深化新增的内容，**用双星号标记核心观点**。"
    }
  ],
  "summary": "100-200字。分析新增内容带来了哪些新的视角或信息，以及它与全文已有内容的关联。用**双星号**标记关键洞察。"
}

要求：
- concepts 1-3个，只从新增内容中提取，不要重复已有概念
- references 0-2个，只与新增内容相关
- summary 聚焦新增部分的贡献

用户新增的内容（只分析这部分）：
${addedText}

全文上下文（仅供参考，不要重复分析）：
${fullText}`;
  }

  /**
   * Build edit prompt - for modified content, generates full replacement
   * @private
   */
  _buildEditPrompt(fullText, changedText) {
    return `你是用户的私人写作顾问。用户正在编辑一篇文档，修改了部分已有内容。由于内容发生了实质性变化，你需要基于修改后的全文重新生成完整的洞察分析。

【最重要的规则】你的分析必须基于修改后的最新全文内容。重点关注用户修改的部分，但要给出覆盖全文的完整分析。

请返回严格JSON格式（不要包含任何其他文字）：

{
  "concepts": [
    {
      "name": "从最新全文中提取的核心概念",
      "keywords": ["关键词1", "关键词2"],
      "description": "80-150字。分析这个概念在最新版本中的意义，特别关注修改带来的变化，给出**深层洞察**。用**双星号**标记关键句。"
    }
  ],
  "references": [
    {
      "title": "真实书名或文章名",
      "author": "真实作者",
      "keywords": ["标签"],
      "description": "60-120字。说明这个参考资料与最新内容的关联，**用双星号标记核心观点**。"
    }
  ],
  "summary": "200-350字。基于最新全文梳理各要点的内在联系，特别说明修改部分如何影响了整体脉络。用**双星号**标记关键洞察。"
}

要求：
- concepts 3-5个，基于最新全文提取
- references 1-3个，与最新内容直接相关
- summary 必须反映修改后的最新状态

用户修改的部分（重点关注）：
${changedText}

修改后的完整文档：
${fullText}`;
  }

  /**
   * Call function with timeout
   * @private
   */
  async _callWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Validate and normalize LLM response data
   * @private
   * @param {Object} data - Raw LLM response data
   * @param {boolean} [pad=true] - Whether to pad concepts to minimum 3
   * @returns {Object} Normalized insights
   */
  _validateAndNormalize(data, pad = true) {
    if (!data || typeof data !== 'object') {
      return pad
        ? { concepts: this._padConcepts([]), references: [], summary: '' }
        : { concepts: [], references: [], summary: '' };
    }

    // Normalize concepts
    let concepts = Array.isArray(data.concepts) ? data.concepts : [];
    concepts = concepts
      .filter(c => c && typeof c === 'object' && typeof c.name === 'string')
      .map(c => ({
        name: c.name,
        keywords: Array.isArray(c.keywords)
          ? c.keywords.filter(k => typeof k === 'string').slice(0, 5)
          : [],
        description: typeof c.description === 'string'
          ? c.description.slice(0, 500)
          : ''
      }));

    if (concepts.length > 10) {
      concepts = concepts.slice(0, 10);
    }
    if (pad) {
      concepts = this._padConcepts(concepts);
    }

    // Normalize references
    let references = Array.isArray(data.references) ? data.references : [];
    references = references
      .filter(r =>
        r && typeof r === 'object' &&
        typeof r.title === 'string' &&
        typeof r.author === 'string' &&
        typeof r.description === 'string'
      )
      .map(r => ({
        title: r.title,
        author: r.author,
        keywords: Array.isArray(r.keywords)
          ? r.keywords.filter(k => typeof k === 'string').slice(0, 5)
          : [],
        description: r.description.slice(0, 400)
      }));

    if (references.length > 5) {
      references = references.slice(0, 5);
    }

    // Normalize summary
    let summary = typeof data.summary === 'string' ? data.summary : '';
    if (summary.length > 800) {
      summary = summary.slice(0, 800);
    }

    return { concepts, references, summary };
  }

  /**
   * Pad concepts array to minimum of 3 with generic concepts
   * @private
   */
  _padConcepts(concepts) {
    const genericConcepts = [
      { name: '核心概念', keywords: ['核心', '本质'], description: '与内容直接相关的核心概念。**深入理解这些概念有助于把握文章的本质论点**，从表层信息中提炼出底层逻辑框架。' },
      { name: '相关领域', keywords: ['跨领域', '关联'], description: '内容涉及的相关知识领域。**跨领域的关联往往能揭示隐藏的模式和规律**，帮助构建更完整的知识体系。' },
      { name: '扩展阅读', keywords: ['深入', '探索'], description: '可进一步探索的方向。**沿着当前主题的脉络深入，能够发现更多底层原理和实践应用的可能性**。' }
    ];

    while (concepts.length < 3) {
      concepts.push(genericConcepts[concepts.length]);
    }

    return concepts;
  }
}

/**
 * Create AI insights service
 * @param {Object} config - Service configuration
 * @returns {AIInsightsService}
 */
function createAIInsightsService(config = {}) {
  return new AIInsightsService(config);
}

module.exports = {
  AIInsightsService,
  createAIInsightsService
};
