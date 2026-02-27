/**
 * DigestService - 知识摘要归纳服务
 *
 * 收集用户所有活跃知识体，通过 LLM 归纳为若干知识方向，
 * 每个方向包含百分比占比、摘要文本和关键词。
 *
 * 需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.4
 */

const { PrismaClient } = require('@prisma/client');
const llmClient = require('./llmClient');

const prisma = new PrismaClient();

class DigestService {
  /**
   * 生成知识摘要
   * @param {string} userId - 用户 ID
   * @returns {Promise<{items: Array, generatedAt: string}>} 结构化摘要对象
   */
  async generateDigest(userId) {
    const bodies = await prisma.knowledgeBody.findMany({
      where: {
        userId,
        lifecycleStatus: 'active',
      },
      select: {
        id: true,
        themeName: true,
        themeDescription: true,
        confidenceScore: true,
        growthPhase: true,
        relatedFragmentIds: true,
      },
    });

    const generatedAt = new Date().toISOString();

    if (bodies.length === 0) {
      return { items: [], generatedAt };
    }

    const prompt = this._buildPrompt(bodies);
    const raw = await llmClient.callJSON(prompt);
    const digest = this._validateAndNormalize(raw, bodies);

    return { ...digest, generatedAt };
  }

  /**
   * 构造 LLM Prompt
   * @param {Array} bodies - KnowledgeBody 数组
   * @returns {string} Prompt 文本
   */
  _buildPrompt(bodies) {
    const bodiesText = bodies.map((b, i) => {
      const fragmentIds = JSON.parse(b.relatedFragmentIds || '[]');
      return `${i + 1}. 主题名称: ${b.themeName}\n   主题描述: ${b.themeDescription}\n   置信度: ${b.confidenceScore}\n   成长阶段: ${b.growthPhase}\n   碎片数量: ${fragmentIds.length}`;
    }).join('\n\n');

    return `你是一个知识归纳专家。请分析以下用户的知识体列表，将相似或相关的知识体归纳为若干知识方向，并为每个方向生成摘要。

知识体列表：
${bodiesText}

要求：
1. 将相似或相关的知识体归纳为同一个知识方向，不要逐个罗列
2. 每个方向的百分比基于知识体数量和置信度综合计算，反映用户在该方向的知识积累程度
3. 所有方向的百分比之和必须等于 100
4. 每个摘要文本不超过 100 个字
5. 每个方向的关键词不超过 5 个
6. 请以 JSON 格式返回，格式如下：

{
  "items": [
    {
      "name": "方向名称",
      "percentage": 数字,
      "summary": "摘要文本",
      "keywords": ["关键词1", "关键词2"],
      "relatedThemes": ["知识体名称1", "知识体名称2"]
    }
  ]
}`;
  }

  /**
   * 校验并归一化 LLM 返回结果
   * @param {object} raw - LLM 返回的原始 JSON
   * @param {Array} bodies - 原始知识体数据（用于填充 bodyIds）
   * @returns {{items: Array}} 校验后的摘要对象
   */
  _validateAndNormalize(raw, bodies) {
    if (!raw || !Array.isArray(raw.items)) {
      throw new Error('LLM 返回格式无效：缺少 items 数组');
    }

    const requiredFields = ['name', 'percentage', 'summary', 'keywords'];
    for (const item of raw.items) {
      for (const field of requiredFields) {
        if (item[field] === undefined || item[field] === null) {
          throw new Error(`LLM 返回格式无效：DigestItem 缺少必需字段 "${field}"`);
        }
      }
      if (typeof item.name !== 'string') {
        throw new Error('LLM 返回格式无效：name 必须为字符串');
      }
      if (typeof item.percentage !== 'number') {
        throw new Error('LLM 返回格式无效：percentage 必须为数字');
      }
      if (typeof item.summary !== 'string') {
        throw new Error('LLM 返回格式无效：summary 必须为字符串');
      }
      if (!Array.isArray(item.keywords)) {
        throw new Error('LLM 返回格式无效：keywords 必须为数组');
      }
    }

    // 归一化 percentage 之和为 100
    const totalPercentage = raw.items.reduce((sum, item) => sum + item.percentage, 0);
    if (totalPercentage === 0) {
      // 均分
      const even = Math.floor(100 / raw.items.length);
      raw.items.forEach((item, i) => {
        item.percentage = i === raw.items.length - 1
          ? 100 - even * (raw.items.length - 1)
          : even;
      });
    } else {
      const scaled = raw.items.map(item =>
        Math.round((item.percentage / totalPercentage) * 100)
      );
      // 修正舍入误差：将差值加到最大项
      const diff = 100 - scaled.reduce((a, b) => a + b, 0);
      if (diff !== 0) {
        let maxIdx = 0;
        for (let i = 1; i < scaled.length; i++) {
          if (scaled[i] > scaled[maxIdx]) maxIdx = i;
        }
        scaled[maxIdx] += diff;
      }
      raw.items.forEach((item, i) => {
        item.percentage = scaled[i];
      });
    }

    // 构建 themeName -> bodyId 映射
    const themeMap = new Map();
    for (const body of bodies) {
      themeMap.set(body.themeName, body.id);
    }

    // 归一化每个 item
    const items = raw.items.map(item => {
      // 截断 summary ≤100 字符
      const summary = item.summary.length > 100
        ? item.summary.slice(0, 100)
        : item.summary;

      // 截断 keywords ≤5 个
      const keywords = item.keywords.slice(0, 5);

      // 通过 relatedThemes 反查 bodyIds
      const relatedThemes = item.relatedThemes || [];
      const bodyIds = relatedThemes
        .map(name => themeMap.get(name))
        .filter(Boolean);

      return {
        name: item.name,
        percentage: item.percentage,
        summary,
        keywords,
        bodyIds,
      };
    });

    return { items };
  }
}

// Export singleton instance and class
const digestService = new DigestService();
module.exports = digestService;
module.exports.DigestService = DigestService;
