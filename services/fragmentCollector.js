/**
 * FragmentCollector - 认知碎片采集器
 * 
 * 在各个用户行为入口埋点，将行为转化为认知碎片并持久化。
 * 包含内容验证、去重检查、embedding 生成、数据库写入。
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const embeddingService = require('./embeddingService');

/**
 * 碎片类型枚举
 */
const FRAGMENT_TYPES = [
  'note_create',
  'note_edit',
  'search_query',
  'doc_edit',
  'doc_create',
  'tag_add',
  'doc_view',
  'image_analyze',
  'community_publish',
  'ai_chat',
  'community_like',
  'community_forward',
  'community_favorite',
  'community_comment'
];

class FragmentCollector {
  /**
   * 异步采集碎片
   * 包含内容验证、去重检查、embedding 生成、数据库写入
   * 
   * @param {object} params
   * @param {string} params.userId - 用户 ID
   * @param {string} params.fragmentType - 碎片类型
   * @param {string} params.content - 碎片内容
   * @param {string} params.sourceId - 来源 ID
   * @param {object} [params.sourceMeta] - 来源元数据
   * @returns {Promise<object|null>} 创建的碎片记录，或 null（被拒绝/跳过时）
   */
  async collect({ userId, fragmentType, content, sourceId, sourceMeta }) {
    // 1. 内容验证
    if (!this.isValidContent(content)) {
      console.debug(`[FragmentCollector] Content rejected: too short or empty`);
      return null;
    }

    // 2. 验证碎片类型
    if (!FRAGMENT_TYPES.includes(fragmentType)) {
      console.warn(`[FragmentCollector] Unknown fragment type: ${fragmentType}`);
      return null;
    }

    try {
      // 3. 搜索查询去重：30分钟内完全相同的搜索词
      if (fragmentType === 'search_query') {
        const isSearchDup = await this.isSearchDuplicate(userId, content);
        if (isSearchDup) {
          console.debug(`[FragmentCollector] Search query duplicate skipped: "${content}"`);
          return null;
        }
      }

      // 4. SourceId 去重窗口检查（5分钟内同一 sourceId + 类型）
      const existingFragment = await this._findDuplicateFragment(sourceId, fragmentType, 5);
      if (existingFragment) {
        // 更新已有碎片的内容而非新建
        const updated = await prisma.cognitiveFragment.update({
          where: { id: existingFragment.id },
          data: {
            content,
            sourceMeta: sourceMeta ? JSON.stringify(sourceMeta) : existingFragment.sourceMeta
          }
        });
        console.debug(`[FragmentCollector] Updated existing fragment ${updated.id} for sourceId: ${sourceId}`);
        return updated;
      }

      // 5. 生成 embedding
      let embedding = null;
      try {
        embedding = await embeddingService.generateEmbedding(content);
      } catch (err) {
        console.warn(`[FragmentCollector] Embedding generation failed, saving without embedding:`, err.message);
      }

      // 6. 数据库写入
      const fragment = await prisma.cognitiveFragment.create({
        data: {
          userId,
          fragmentType,
          content,
          sourceId,
          sourceMeta: sourceMeta ? JSON.stringify(sourceMeta) : null,
          embedding: embedding ? JSON.stringify(embedding) : null
        }
      });

      console.debug(`[FragmentCollector] Created fragment ${fragment.id} type=${fragmentType} sourceId=${sourceId}`);
      return fragment;
    } catch (error) {
      console.error(`[FragmentCollector] Error collecting fragment:`, error);
      return null;
    }
  }

  /**
   * 验证内容是否有效（长度 ≥ 5 字符）
   * @param {string} content - 要验证的内容
   * @returns {boolean}
   */
  isValidContent(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return content.length >= 5;
  }

  /**
   * 去重检查：同一 sourceId 在指定分钟窗口内的相同类型碎片
   * @param {string} sourceId - 来源 ID
   * @param {string} fragmentType - 碎片类型
   * @param {number} [windowMinutes=5] - 去重窗口（分钟）
   * @returns {Promise<boolean>} 是否存在重复
   */
  async isDuplicate(sourceId, fragmentType, windowMinutes = 5) {
    const existing = await this._findDuplicateFragment(sourceId, fragmentType, windowMinutes);
    return !!existing;
  }

  /**
   * 搜索查询去重：30分钟内完全相同的搜索词
   * @param {string} userId - 用户 ID
   * @param {string} query - 搜索关键词
   * @returns {Promise<boolean>} 是否存在重复
   */
  async isSearchDuplicate(userId, query) {
    const windowStart = new Date(Date.now() - 30 * 60 * 1000);

    const existing = await prisma.cognitiveFragment.findFirst({
      where: {
        userId,
        fragmentType: 'search_query',
        content: query,
        createdAt: { gte: windowStart }
      }
    });

    return !!existing;
  }

  /**
   * 查找去重窗口内的已有碎片
   * @param {string} sourceId
   * @param {string} fragmentType
   * @param {number} windowMinutes
   * @returns {Promise<object|null>}
   * @private
   */
  async _findDuplicateFragment(sourceId, fragmentType, windowMinutes) {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    return prisma.cognitiveFragment.findFirst({
      where: {
        sourceId,
        fragmentType,
        createdAt: { gte: windowStart }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

// 导出单例实例和类
const fragmentCollector = new FragmentCollector();
module.exports = fragmentCollector;
module.exports.FragmentCollector = FragmentCollector;
module.exports.FRAGMENT_TYPES = FRAGMENT_TYPES;
