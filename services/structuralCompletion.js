/**
 * StructuralCompletion - 结构补全服务
 *
 * 当知识体的 growthPhase 进入 skeleton 阶段时，收集关联碎片，
 * 调用 LLM 生成知识体的结构大纲（outline），并保存到 KnowledgeBodyNode 表。
 *
 * 使用四层认知框架（What→核心节点, How→逻辑连接, Why→深度结构, So What→总结节点）
 * 构建提示词，仅基于用户已有碎片推断缺失结构，禁止发散。
 */

const { PrismaClient } = require('@prisma/client');
const llmClient = require('./llmClient');

const prisma = new PrismaClient();

class StructuralCompletion {
  /**
   * 为知识体生成大纲
   * @param {string} bodyId - 知识体 ID
   * @returns {Promise<Array>} 大纲节点列表
   */
  async generateOutline(bodyId) {
    // 1. Get KnowledgeBody with relatedFragmentIds and relatedEntityIds
    const body = await prisma.knowledgeBody.findUnique({
      where: { id: bodyId },
    });

    if (!body) {
      throw new Error(`KnowledgeBody not found: ${bodyId}`);
    }

    // 2. Fetch all related CognitiveFragment records
    const fragmentIds = JSON.parse(body.relatedFragmentIds || '[]');
    if (fragmentIds.length === 0) {
      console.warn(`[StructuralCompletion] No fragments for body ${bodyId}, skipping outline generation`);
      return [];
    }

    const fragments = await prisma.cognitiveFragment.findMany({
      where: { id: { in: fragmentIds } },
    });

    if (fragments.length === 0) {
      console.warn(`[StructuralCompletion] No fragments found in DB for body ${bodyId}`);
      return [];
    }

    // 3. Optionally fetch related UnifiedEntity and UnifiedRelation records
    let entities = [];
    let relations = [];
    const entityIds = JSON.parse(body.relatedEntityIds || '[]');
    if (entityIds.length > 0) {
      try {
        entities = await prisma.unifiedEntity.findMany({
          where: { id: { in: entityIds } },
        });
        relations = await prisma.unifiedRelation.findMany({
          where: {
            OR: [
              { sourceEntityId: { in: entityIds } },
              { targetEntityId: { in: entityIds } },
            ],
          },
        });
      } catch (error) {
        console.warn('[StructuralCompletion] Failed to fetch entities/relations:', error.message);
      }
    }

    // 4. Build prompt and call LLM
    const prompt = this.buildOutlinePrompt(fragments, entities, relations);

    let outline;
    try {
      outline = await llmClient.callJSON(prompt, {
        temperature: 0.3,
        maxTokens: 3000,
      });
    } catch (error) {
      console.error(`[StructuralCompletion] LLM call failed for body ${bodyId}:`, error.message);
      // Keep growthPhase unchanged, wait for next retry
      return [];
    }

    // Validate outline is an array
    if (!Array.isArray(outline)) {
      console.error(`[StructuralCompletion] LLM returned non-array outline for body ${bodyId}`);
      return [];
    }

    // 5. Mark node statuses (filled/gap)
    const markedOutline = this.markNodeStatuses(outline, fragments);

    // 6. Save to KnowledgeBodyNode table (flatten tree)
    await this._saveOutlineNodes(bodyId, markedOutline);

    return markedOutline;
  }

  /**
   * 构建四层认知提示词
   * @param {Array} fragments - 认知碎片列表
   * @param {Array} [entities] - 关联的 UnifiedEntity 列表
   * @param {Array} [relations] - 关联的 UnifiedRelation 列表
   * @returns {string} 提示词
   */
  buildOutlinePrompt(fragments, entities, relations) {
    const fragmentContents = fragments.map((f, i) => `${i + 1}. [${f.fragmentType}] ${f.content}`).join('\n');

    let entityContext = '';
    if (entities && entities.length > 0) {
      const entityList = entities.map(e => `- ${e.cleanedName}: ${e.description}`).join('\n');
      entityContext = `\n\n已知的关联实体：\n${entityList}`;
    }

    let relationContext = '';
    if (relations && relations.length > 0) {
      const relationList = relations.map(r => `- ${r.cleanedName}: ${r.description}`).join('\n');
      relationContext = `\n\n已知的实体关系：\n${relationList}`;
    }

    return `你是一个知识结构分析专家。请基于以下用户的认知碎片，生成一个知识体的结构大纲。

## 四层认知框架

请按照以下四层结构组织大纲：

1. **What（核心节点）**：从碎片中提取核心概念和事实，作为大纲的主要节点
2. **How（逻辑连接）**：分析概念之间的逻辑关系，形成节点间的连接结构
3. **Why（深度结构）**：推断概念背后的因果关系和深层原理，形成大纲的深度层次
4. **So What（总结节点）**：提炼出总结性的原则、模式或结论节点

## 严格约束

- 仅基于用户已有碎片推断缺失结构
- 禁止添加用户未涉及的主题分支
- 仅生成"结构上必然存在但用户尚未填写"的节点
- 禁止生成与用户碎片无关的发散性内容

## 用户认知碎片

${fragmentContents}${entityContext}${relationContext}

## 输出格式

请以 JSON 数组格式返回大纲，每个节点包含：
- id: 唯一标识符（如 "node-1", "node-2"）
- title: 节点标题
- children: 子节点数组（可选）

示例：
[
  {
    "id": "node-1",
    "title": "核心概念A",
    "children": [
      { "id": "node-1-1", "title": "子概念A1" },
      { "id": "node-1-2", "title": "子概念A2" }
    ]
  },
  {
    "id": "node-2",
    "title": "总结与原则"
  }
]

请直接返回 JSON 数组，不要包含其他文字。`;
  }

  /**
   * 标记节点状态（filled/gap）
   * 对于每个节点，检查是否有碎片内容语义覆盖它
   * 简单文本匹配：检查碎片内容是否包含节点标题
   * @param {Array} outline - 大纲节点列表
   * @param {Array} fragments - 认知碎片列表
   * @returns {Array} 标记状态后的大纲节点列表
   */
  markNodeStatuses(outline, fragments) {
    if (!Array.isArray(outline)) {
      return [];
    }

    const fragmentContents = fragments.map(f => (f.content || '').toLowerCase());

    const markNode = (node) => {
      const title = (node.title || '').toLowerCase();
      const isCovered = title.length > 0 && fragmentContents.some(content => content.includes(title));

      const markedNode = {
        ...node,
        status: isCovered ? 'filled' : 'gap',
      };

      if (node.children && Array.isArray(node.children)) {
        markedNode.children = node.children.map(child => markNode(child));
      }

      return markedNode;
    };

    return outline.map(node => markNode(node));
  }

  /**
   * 将大纲树扁平化并保存到 KnowledgeBodyNode 表
   * @param {string} bodyId - 知识体 ID
   * @param {Array} outline - 大纲节点树
   * @private
   */
  async _saveOutlineNodes(bodyId, outline) {
    // Delete existing nodes for this body
    await prisma.knowledgeBodyNode.deleteMany({
      where: { bodyId },
    });

    // Flatten tree and create nodes
    const flatNodes = [];
    let sortOrder = 0;

    const flatten = (nodes, parentNodeId = null) => {
      for (const node of nodes) {
        flatNodes.push({
          id: node.id || `node-${sortOrder}`,
          bodyId,
          parentNodeId,
          title: node.title || '',
          status: node.status || 'gap',
          content: node.content || null,
          sortOrder: sortOrder++,
        });

        if (node.children && Array.isArray(node.children)) {
          flatten(node.children, node.id || `node-${sortOrder - 1}`);
        }
      }
    };

    flatten(outline);

    // Batch create nodes
    for (const nodeData of flatNodes) {
      await prisma.knowledgeBodyNode.create({ data: nodeData });
    }
  }
}

// Export singleton instance and class
const structuralCompletion = new StructuralCompletion();
module.exports = structuralCompletion;
module.exports.StructuralCompletion = StructuralCompletion;
