/**
 * KnowledgeGrowthService - 知识体成熟度判定与导出服务
 *
 * 提供以下核心功能：
 * - checkMatureStatus(bodyId): 检查知识体是否所有节点均为 filled/user_edited，标记为 mature
 * - exportToDocument(bodyId): 将成熟知识体导出为 Document
 * - updateExportedDocument(bodyId): 更新已导出的文档内容
 *
 * 需求: 5.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class KnowledgeGrowthService {
  /**
   * 检查知识体是否成熟（所有节点均为 filled 或 user_edited）
   * 若成熟则在 KnowledgeBody 上标记 growthPhase 为 'mature'
   *
   * @param {string} bodyId - 知识体 ID
   * @returns {Promise<{isMature: boolean, totalNodes: number, filledNodes: number}>}
   */
  async checkMatureStatus(bodyId) {
    const body = await prisma.knowledgeBody.findUnique({
      where: { id: bodyId },
    });

    if (!body) {
      throw new Error(`KnowledgeBody not found: ${bodyId}`);
    }

    const nodes = await prisma.knowledgeBodyNode.findMany({
      where: { bodyId },
    });

    const totalNodes = nodes.length;

    if (totalNodes === 0) {
      return { isMature: false, totalNodes: 0, filledNodes: 0 };
    }

    const matureStatuses = ['filled', 'user_edited'];
    const filledNodes = nodes.filter(n => matureStatuses.includes(n.status)).length;
    const isMature = filledNodes === totalNodes;

    if (isMature) {
      await prisma.knowledgeBody.update({
        where: { id: bodyId },
        data: { growthPhase: 'mature' },
      });
    }

    return { isMature, totalNodes, filledNodes };
  }

  /**
   * 将成熟知识体导出为 Document
   * 按树形深度优先顺序组装大纲和节点内容为富文本
   *
   * @param {string} bodyId - 知识体 ID
   * @returns {Promise<Object>} 创建的 Document 对象
   */
  async exportToDocument(bodyId) {
    const body = await prisma.knowledgeBody.findUnique({
      where: { id: bodyId },
    });

    if (!body) {
      throw new Error(`KnowledgeBody not found: ${bodyId}`);
    }

    if (body.exportedDocId) {
      throw new Error(`KnowledgeBody ${bodyId} already has an exported document. Use updateExportedDocument instead.`);
    }

    const nodes = await prisma.knowledgeBodyNode.findMany({
      where: { bodyId },
      orderBy: { sortOrder: 'asc' },
    });

    const richTextContent = this._buildRichTextContent(body.themeName, nodes);

    let document;
    try {
      document = await prisma.document.create({
        data: {
          title: body.themeName,
          content: richTextContent,
          type: 'document',
          userId: body.userId,
        },
      });
    } catch (error) {
      // 导出失败时保留知识体数据不变
      console.error(`[KnowledgeGrowthService] Failed to create document for body ${bodyId}:`, error.message);
      throw new Error(`Failed to export document: ${error.message}`);
    }

    // 记录 exportedDocId
    await prisma.knowledgeBody.update({
      where: { id: bodyId },
      data: { exportedDocId: document.id },
    });

    return document;
  }

  /**
   * 更新已导出的文档内容
   *
   * @param {string} bodyId - 知识体 ID
   * @returns {Promise<Object>} 更新后的 Document 对象
   */
  async updateExportedDocument(bodyId) {
    const body = await prisma.knowledgeBody.findUnique({
      where: { id: bodyId },
    });

    if (!body) {
      throw new Error(`KnowledgeBody not found: ${bodyId}`);
    }

    if (!body.exportedDocId) {
      throw new Error(`KnowledgeBody ${bodyId} has no exported document. Use exportToDocument first.`);
    }

    const nodes = await prisma.knowledgeBodyNode.findMany({
      where: { bodyId },
      orderBy: { sortOrder: 'asc' },
    });

    const richTextContent = this._buildRichTextContent(body.themeName, nodes);

    let document;
    try {
      document = await prisma.document.update({
        where: { id: body.exportedDocId },
        data: { content: richTextContent },
      });
    } catch (error) {
      console.error(`[KnowledgeGrowthService] Failed to update document for body ${bodyId}:`, error.message);
      throw new Error(`Failed to update exported document: ${error.message}`);
    }

    return document;
  }

  /**
   * 将扁平节点列表构建为树形结构，然后按深度优先顺序组装为富文本
   *
   * @param {string} themeName - 知识体主题名称
   * @param {Array} nodes - 扁平的 KnowledgeBodyNode 列表
   * @returns {string} 富文本内容（TipTap JSON 格式）
   * @private
   */
  _buildRichTextContent(themeName, nodes) {
    // Build tree from flat nodes
    const tree = this._buildTree(nodes);

    // Traverse tree in depth-first order and assemble content
    const contentBlocks = [];

    // Add title as heading level 1
    contentBlocks.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: themeName }],
    });

    // Traverse tree depth-first
    this._traverseTree(tree, 2, contentBlocks);

    const tiptapDoc = {
      type: 'doc',
      content: contentBlocks,
    };

    return JSON.stringify(tiptapDoc);
  }

  /**
   * 从扁平节点列表构建树形结构
   *
   * @param {Array} nodes - 扁平节点列表（已按 sortOrder 排序）
   * @returns {Array} 树形节点列表
   * @private
   */
  _buildTree(nodes) {
    const nodeMap = new Map();
    const roots = [];

    // First pass: create map
    for (const node of nodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    // Second pass: build tree
    for (const node of nodes) {
      const treeNode = nodeMap.get(node.id);
      if (node.parentNodeId && nodeMap.has(node.parentNodeId)) {
        nodeMap.get(node.parentNodeId).children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    }

    return roots;
  }

  /**
   * 深度优先遍历树，为每个节点添加标题和内容到 contentBlocks
   *
   * @param {Array} nodes - 树形节点列表
   * @param {number} headingLevel - 当前标题级别（2-6）
   * @param {Array} contentBlocks - 输出的内容块数组
   * @private
   */
  _traverseTree(nodes, headingLevel, contentBlocks) {
    const level = Math.min(headingLevel, 6);

    for (const node of nodes) {
      // Add node title as heading
      contentBlocks.push({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: node.title }],
      });

      // Add node content as paragraph (if exists)
      if (node.content) {
        contentBlocks.push({
          type: 'paragraph',
          content: [{ type: 'text', text: node.content }],
        });
      }

      // Recurse into children
      if (node.children && node.children.length > 0) {
        this._traverseTree(node.children, level + 1, contentBlocks);
      }
    }
  }
}

// Export singleton instance and class
const knowledgeGrowthService = new KnowledgeGrowthService();
module.exports = knowledgeGrowthService;
module.exports.KnowledgeGrowthService = KnowledgeGrowthService;
