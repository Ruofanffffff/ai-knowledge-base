/**
 * InterestConstrainedGeneration - 兴趣约束生成服务
 *
 * 当知识体的 growthPhase 进入 flesh 阶段时，为 gap 节点生成内容。
 * 生成内容受三重约束：用户历史兴趣、已有碎片风格、节点角色定位。
 * 支持三种增量模式：full（首次生成）、append（追加）、replace（重新生成）。
 */

const { PrismaClient } = require('@prisma/client');
const llmClient = require('./llmClient');
const embeddingService = require('./embeddingService');

const prisma = new PrismaClient();

const VALID_MODES = ['full', 'append', 'replace'];
const MIN_CONTENT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 800;
const RELATED_FRAGMENT_COUNT = 5;

class InterestConstrainedGeneration {
  /**
   * 为指定节点生成内容
   * @param {object} params
   * @param {string} params.bodyId - 知识体 ID
   * @param {string} params.nodeId - 节点 ID
   * @param {string} params.mode - 生成模式: full | append | replace
   * @returns {Promise<object>} 生成结果
   */
  async generate({ bodyId, nodeId, mode }) {
    // 1. Validate mode
    if (!VALID_MODES.includes(mode)) {
      throw Object.assign(new Error(`Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`), { statusCode: 400 });
    }

    // 2. Get KnowledgeBody and verify it exists
    const body = await prisma.knowledgeBody.findUnique({
      where: { id: bodyId },
    });

    if (!body) {
      throw Object.assign(new Error(`KnowledgeBody not found: ${bodyId}`), { statusCode: 404 });
    }

    // 3. Check implicit permission (body must be in flesh phase)
    if (body.growthPhase !== 'flesh') {
      throw Object.assign(
        new Error('Implicit permission denied: knowledge body must be in flesh phase to generate content'),
        { statusCode: 403 }
      );
    }

    // 4. Get the target KnowledgeBodyNode
    const targetNode = await prisma.knowledgeBodyNode.findUnique({
      where: { id: nodeId },
    });

    if (!targetNode) {
      throw Object.assign(new Error(`KnowledgeBodyNode not found: ${nodeId}`), { statusCode: 404 });
    }

    if (targetNode.bodyId !== bodyId) {
      throw Object.assign(new Error('Node does not belong to the specified knowledge body'), { statusCode: 400 });
    }

    // 5. Validate node status for the requested mode
    this._validateNodeStatus(targetNode, mode);

    // 6. Get related fragments (top 5 by semantic similarity)
    const relatedFragments = await this._getRelatedFragments(body, targetNode);

    // 7. Get all nodes for the body to build outline context
    const allNodes = await prisma.knowledgeBodyNode.findMany({
      where: { bodyId },
      orderBy: { sortOrder: 'asc' },
    });

    // 8. Build constrained prompt
    const prompt = this.buildConstrainedPrompt({
      relatedFragments,
      outline: allNodes,
      targetNode,
      mode,
    });

    // 9. Call LLM to generate content
    let generatedContent;
    try {
      generatedContent = await llmClient.call(prompt, {
        temperature: 0.5,
        maxTokens: 1500,
      });
    } catch (error) {
      console.error(`[InterestConstrainedGeneration] LLM call failed for node ${nodeId}:`, error.message);
      throw Object.assign(new Error('Content generation failed: LLM error'), { statusCode: 500 });
    }

    // Trim whitespace
    generatedContent = (generatedContent || '').trim();

    // 10. Validate and adjust content length
    if (generatedContent.length > MAX_CONTENT_LENGTH) {
      generatedContent = this._truncateToSentence(generatedContent, MAX_CONTENT_LENGTH);
    }

    // 11. For append mode: prepend existing content
    let finalContent = generatedContent;
    if (mode === 'append' && targetNode.content) {
      finalContent = targetNode.content + '\n\n' + generatedContent;
    }

    // 12. Update node in DB
    await prisma.knowledgeBodyNode.update({
      where: { id: nodeId },
      data: {
        content: finalContent,
        status: 'generated',
        generationMode: mode,
      },
    });

    return {
      nodeId,
      bodyId,
      mode,
      content: finalContent,
      generatedContent,
      status: 'generated',
    };
  }

  /**
   * 构建三重约束提示词
   * @param {object} params
   * @param {Array} params.relatedFragments - 相关碎片列表
   * @param {Array} params.outline - 大纲节点列表
   * @param {object} params.targetNode - 目标节点
   * @param {string} params.mode - 生成模式
   * @returns {string} 提示词
   */
  buildConstrainedPrompt({ relatedFragments, outline, targetNode, mode }) {
    // Constraint 1: User historical interest (from related fragments)
    const interestContext = relatedFragments.length > 0
      ? relatedFragments.map((f, i) => `${i + 1}. [${f.fragmentType}] ${f.content}`).join('\n')
      : '暂无相关碎片';

    // Constraint 2: Writing style from existing fragments
    const styleHints = this._extractStyleHints(relatedFragments);

    // Constraint 3: Node's role in the outline structure
    const outlineContext = this._buildOutlineContext(outline, targetNode);

    // Mode-specific instructions
    const modeInstructions = this._getModeInstructions(mode, targetNode);

    return `你是一个知识内容生成专家。请为知识体大纲中的指定节点生成内容。

## 三重约束

### 约束1：用户历史兴趣偏好
以下是用户的相关认知碎片，生成内容必须贴合用户的兴趣方向：
${interestContext}

### 约束2：写作风格
${styleHints}

### 约束3：节点角色定位
${outlineContext}

## 目标节点
- 标题：${targetNode.title}
- 当前状态：${targetNode.status}
${targetNode.content ? `- 已有内容：${targetNode.content}` : ''}

## 生成模式
${modeInstructions}

## 严格要求
- 生成内容长度必须在 ${MIN_CONTENT_LENGTH} 到 ${MAX_CONTENT_LENGTH} 个字符之间
- 内容必须紧扣用户已有碎片的兴趣方向，禁止发散
- 保持与用户碎片一致的写作风格和用词习惯
- 内容必须符合该节点在大纲中的角色定位
- 直接输出内容文本，不要包含标题或格式标记

请直接生成内容：`;
  }

  /**
   * 验证生成内容长度（200-800字符）
   * @param {string} content - 要验证的内容
   * @returns {boolean}
   */
  validateContentLength(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return content.length >= MIN_CONTENT_LENGTH && content.length <= MAX_CONTENT_LENGTH;
  }

  /**
   * 更新节点状态为 user_edited（用户编辑后调用）
   * @param {string} nodeId - 节点 ID
   * @param {string} content - 用户编辑后的内容
   * @returns {Promise<object>} 更新后的节点
   */
  async markAsUserEdited(nodeId, content) {
    const node = await prisma.knowledgeBodyNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      throw Object.assign(new Error(`KnowledgeBodyNode not found: ${nodeId}`), { statusCode: 404 });
    }

    if (node.status !== 'generated') {
      throw Object.assign(
        new Error(`Cannot mark as user_edited: node status is '${node.status}', expected 'generated'`),
        { statusCode: 400 }
      );
    }

    return prisma.knowledgeBodyNode.update({
      where: { id: nodeId },
      data: {
        content,
        status: 'user_edited',
      },
    });
  }

  /**
   * Validate node status matches the requested generation mode
   * @param {object} node - The target node
   * @param {string} mode - Generation mode
   * @private
   */
  _validateNodeStatus(node, mode) {
    const statusModeMap = {
      full: ['gap'],
      append: ['generated'],
      replace: ['generated', 'user_edited'],
    };

    const allowedStatuses = statusModeMap[mode];
    if (!allowedStatuses.includes(node.status)) {
      throw Object.assign(
        new Error(`Invalid node status '${node.status}' for mode '${mode}'. Expected: ${allowedStatuses.join(' or ')}`),
        { statusCode: 400 }
      );
    }
  }

  /**
   * Get top N semantically related fragments for the target node
   * @param {object} body - KnowledgeBody
   * @param {object} targetNode - Target node
   * @returns {Promise<Array>} Related fragments
   * @private
   */
  async _getRelatedFragments(body, targetNode) {
    const fragmentIds = JSON.parse(body.relatedFragmentIds || '[]');
    if (fragmentIds.length === 0) {
      return [];
    }

    const fragments = await prisma.cognitiveFragment.findMany({
      where: { id: { in: fragmentIds } },
    });

    if (fragments.length === 0) {
      return [];
    }

    // Try to find semantically similar fragments using embedding
    const nodeEmbedding = await embeddingService.generateEmbedding(targetNode.title);
    if (!nodeEmbedding) {
      // Fallback: return first N fragments
      return fragments.slice(0, RELATED_FRAGMENT_COUNT);
    }

    const candidates = fragments
      .filter(f => f.embedding)
      .map(f => ({
        ...f,
        embedding: JSON.parse(f.embedding),
      }));

    if (candidates.length === 0) {
      return fragments.slice(0, RELATED_FRAGMENT_COUNT);
    }

    const similar = await embeddingService.findSimilar(nodeEmbedding, candidates, 0);
    const topIds = similar.slice(0, RELATED_FRAGMENT_COUNT).map(s => s.id);

    return fragments.filter(f => topIds.includes(f.id));
  }

  /**
   * Extract writing style hints from fragments
   * @param {Array} fragments - Related fragments
   * @returns {string} Style description
   * @private
   */
  _extractStyleHints(fragments) {
    if (!fragments || fragments.length === 0) {
      return '请使用简洁、清晰的中文写作风格。';
    }

    const avgLength = Math.round(
      fragments.reduce((sum, f) => sum + (f.content || '').length, 0) / fragments.length
    );

    const types = [...new Set(fragments.map(f => f.fragmentType))];
    const typeDescriptions = {
      note_create: '便签笔记',
      note_edit: '便签编辑',
      search_query: '搜索查询',
      doc_edit: '文档编辑',
      doc_create: '文档创建',
      tag_add: '标签操作',
      doc_view: '文档浏览',
      image_analyze: '图片分析',
      community_publish: '社区发布',
    };

    const sourceTypes = types.map(t => typeDescriptions[t] || t).join('、');

    return `用户的碎片主要来自：${sourceTypes}。平均碎片长度约 ${avgLength} 字符。请参考用户碎片的用词习惯和表达风格，保持一致的语言风格。`;
  }

  /**
   * Build outline context showing the node's position in the structure
   * @param {Array} allNodes - All outline nodes
   * @param {object} targetNode - Target node
   * @returns {string} Outline context description
   * @private
   */
  _buildOutlineContext(allNodes, targetNode) {
    if (!allNodes || allNodes.length === 0) {
      return `该节点"${targetNode.title}"是大纲中的独立节点。`;
    }

    // Build a simple tree representation
    const rootNodes = allNodes.filter(n => !n.parentNodeId);
    const childMap = {};
    for (const node of allNodes) {
      if (node.parentNodeId) {
        if (!childMap[node.parentNodeId]) {
          childMap[node.parentNodeId] = [];
        }
        childMap[node.parentNodeId].push(node);
      }
    }

    const lines = [];
    const renderNode = (node, depth = 0) => {
      const indent = '  '.repeat(depth);
      const marker = node.id === targetNode.id ? '→ ' : '  ';
      const statusTag = `[${node.status}]`;
      lines.push(`${indent}${marker}${node.title} ${statusTag}`);
      const children = childMap[node.id] || [];
      for (const child of children) {
        renderNode(child, depth + 1);
      }
    };

    for (const root of rootNodes) {
      renderNode(root);
    }

    // Find parent and siblings for role description
    let roleDescription = '';
    if (targetNode.parentNodeId) {
      const parent = allNodes.find(n => n.id === targetNode.parentNodeId);
      const siblings = allNodes.filter(n => n.parentNodeId === targetNode.parentNodeId);
      if (parent) {
        roleDescription = `该节点是"${parent.title}"的子节点，与 ${siblings.length - 1} 个兄弟节点并列。`;
      }
    } else {
      roleDescription = `该节点是大纲的顶层节点。`;
    }

    return `大纲结构：\n${lines.join('\n')}\n\n${roleDescription}`;
  }

  /**
   * Get mode-specific generation instructions
   * @param {string} mode - Generation mode
   * @param {object} targetNode - Target node
   * @returns {string} Mode instructions
   * @private
   */
  _getModeInstructions(mode, targetNode) {
    switch (mode) {
      case 'full':
        return '这是首次生成（full 模式）。请为该空白节点生成完整的内容。';
      case 'append':
        return `这是追加模式（append 模式）。用户已有以下内容，请仅生成新的增量内容，不要重复已有内容：\n已有内容：${targetNode.content || '（无）'}`;
      case 'replace':
        return `这是替换模式（replace 模式）。用户已编辑过内容，请基于用户编辑后的内容和所有关联碎片重新生成该节点的完整内容。\n用户编辑后的内容：${targetNode.content || '（无）'}`;
      default:
        return '';
    }
  }

  /**
   * Truncate content to max length while preserving complete sentences
   * @param {string} content - Content to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated content
   * @private
   */
  _truncateToSentence(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength);
    // Try to find the last sentence boundary
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastPeriod > maxLength * 0.5) {
      return truncated.substring(0, lastPeriod + 1);
    }

    return truncated;
  }
}

// Export singleton instance and class
const interestConstrainedGeneration = new InterestConstrainedGeneration();
module.exports = interestConstrainedGeneration;
module.exports.InterestConstrainedGeneration = InterestConstrainedGeneration;
module.exports.VALID_MODES = VALID_MODES;
module.exports.MIN_CONTENT_LENGTH = MIN_CONTENT_LENGTH;
module.exports.MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH;
