/**
 * LifecycleService - 知识体生命周期管理服务
 *
 * 提供以下核心功能：
 * - calculateDecayFactor(lastActiveAt): 计算衰减因子
 * - calculateWeightedFragmentCount(fragments): 计算带时间加权的碎片数量
 * - calculateOriginalConfidence({weightedCount, timeSpanDays, avgSimilarity}): 计算原始置信度
 * - applyDecay(userId): 对所有活跃知识体应用置信度时间衰减
 * - detectStale(userId, staleDays): 陈旧检测
 * - autoArchive(userId, archiveDays): 自动归档
 * - cascadeArchiveIntentBodies(userId): 意图体级联归档
 * - reactivateBody(bodyId): 重新激活知识体
 * - runLifecycleScan(userId): 执行完整生命周期扫描
 *
 * Requirements: 1.1-1.4, 2.1-2.5, 3.1-3.4, 4.1-4.2, 5.1-5.4, 6.1-6.3, 7.1-7.3, 8.1-8.4
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class LifecycleService {
  /**
   * 计算衰减因子
   * decayFactor = max(0.1, 1 - daysSinceLastActive / 180)
   *
   * @param {Date} lastActiveAt - 最后活跃时间
   * @returns {number} 衰减因子 [0.1, 1]
   */
  calculateDecayFactor(lastActiveAt) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(lastActiveAt).getTime();
    const daysSinceLastActive = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0.1, 1 - daysSinceLastActive / 180);
  }

  /**
   * 计算带时间加权的碎片数量
   * 每个碎片权重 = max(0.1, 1 - fragmentAgeDays / 180)
   * 加权碎片数量 = 所有碎片权重之和
   * 当所有碎片年龄超过 180 天时，加权数量不低于 碎片总数 * 0.1
   *
   * @param {Array<{createdAt: Date}>} fragments - 碎片列表
   * @returns {number} 加权碎片数量
   */
  calculateWeightedFragmentCount(fragments) {
    if (!fragments || fragments.length === 0) {
      return 0;
    }

    const now = new Date();
    let weightedSum = 0;

    for (const fragment of fragments) {
      const diffMs = now.getTime() - new Date(fragment.createdAt).getTime();
      const fragmentAgeDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      const weight = Math.max(0.1, 1 - fragmentAgeDays / 180);
      weightedSum += weight;
    }

    // 确保加权数量不低于 碎片总数 * 0.1
    const minWeightedCount = fragments.length * 0.1;
    return Math.max(weightedSum, minWeightedCount);
  }

  /**
   * 计算原始置信度（使用时间加权碎片数量）
   * 0.4 * min(weightedCount / 10, 1) + 0.3 * min(d / 14, 1) + 0.3 * s
   *
   * @param {{weightedCount: number, timeSpanDays: number, avgSimilarity: number}} params
   * @returns {number} 原始置信度
   */
  calculateOriginalConfidence({ weightedCount, timeSpanDays, avgSimilarity }) {
    const wc = Math.max(0, weightedCount);
    const d = Math.max(0, timeSpanDays);
    const s = Math.max(0, Math.min(1, avgSimilarity));

    return 0.4 * Math.min(wc / 10, 1) + 0.3 * Math.min(d / 14, 1) + 0.3 * s;
  }

  /**
   * 置信度时间衰减：对所有活跃知识体应用衰减因子
   * 跳过最近 7 天内有新碎片的知识体
   *
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async applyDecay(userId) {
    // 查询所有 lifecycleStatus="active" 的知识体
    const activeBodies = await prisma.knowledgeBody.findMany({
      where: {
        userId,
        lifecycleStatus: 'active',
      },
    });

    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const body of activeBodies) {
      // 跳过最近 7 天内有新碎片的知识体
      const lastActive = new Date(body.lastActiveAt);
      if (now.getTime() - lastActive.getTime() <= sevenDaysMs) {
        continue;
      }

      // 解析 relatedFragmentIds
      let fragmentIds = [];
      try {
        fragmentIds = JSON.parse(body.relatedFragmentIds || '[]');
      } catch {
        fragmentIds = [];
      }

      // 查询关联碎片
      let fragments = [];
      if (fragmentIds.length > 0) {
        fragments = await prisma.cognitiveFragment.findMany({
          where: { id: { in: fragmentIds } },
          select: { id: true, createdAt: true },
        });
      }

      // 计算加权碎片数量
      const weightedCount = this.calculateWeightedFragmentCount(fragments);

      // 计算 timeSpanDays 和 avgSimilarity
      let timeSpanDays = 0;
      let avgSimilarity = 0;

      if (fragments.length > 0) {
        const dates = fragments.map(f => new Date(f.createdAt).getTime());
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        timeSpanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      }

      // avgSimilarity: use body's existing confidenceScore context or default
      // Since CognitiveFragment doesn't have a similarity field, we derive it
      // from the current confidence formula by back-calculating, or use a default.
      // The design says to use avgSimilarity from fragments, but the schema has no
      // similarity field on CognitiveFragment. We'll use 0.5 as a reasonable default.
      avgSimilarity = 0.5;

      // 计算原始置信度
      const originalConfidence = this.calculateOriginalConfidence({
        weightedCount,
        timeSpanDays,
        avgSimilarity,
      });

      // 应用衰减因子
      const decayFactor = this.calculateDecayFactor(body.lastActiveAt);
      let decayedConfidence = originalConfidence * decayFactor;

      // 确保不低于 0.03
      decayedConfidence = Math.max(0.03, decayedConfidence);

      // 根据衰减后的 confidenceScore 确定 growthPhase
      let growthPhase;
      if (decayedConfidence >= 0.8) {
        growthPhase = 'flesh';
      } else if (decayedConfidence >= 0.6) {
        growthPhase = 'skeleton';
      } else {
        growthPhase = 'discovery';
      }

      // 更新知识体
      await prisma.knowledgeBody.update({
        where: { id: body.id },
        data: {
          confidenceScore: decayedConfidence,
          growthPhase,
        },
      });
    }
  }

  /**
   * 陈旧检测：将超过 staleDays 未活跃的 active 知识体标记为 stale
   * 跳过 lifecycleStatus="archived" 的知识体（仅查询 active 状态）
   *
   * @param {string} userId
   * @param {number} staleDays - 默认 30
   * @returns {Promise<number>} 标记为 stale 的数量
   * Requirements: 3.1, 3.2, 3.4
   */
  async detectStale(userId, staleDays = 30) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

    // 查询 lifecycleStatus="active" 且 lastActiveAt 距今超过 staleDays 的知识体
    // 这自然跳过了 "archived" 和 "stale" 状态的知识体
    const staleBodies = await prisma.knowledgeBody.findMany({
      where: {
        userId,
        lifecycleStatus: 'active',
        lastActiveAt: {
          lt: cutoffDate,
        },
      },
      select: { id: true, themeName: true, lastActiveAt: true },
    });

    if (staleBodies.length === 0) {
      return 0;
    }

    const staleIds = staleBodies.map(b => b.id);

    // 批量更新为 stale
    await prisma.knowledgeBody.updateMany({
      where: { id: { in: staleIds } },
      data: { lifecycleStatus: 'stale' },
    });

    // 记录状态变更时间戳到日志
    for (const body of staleBodies) {
      console.log(
        `[LifecycleService] ${now.toISOString()} - KnowledgeBody "${body.themeName}" (${body.id}) marked as stale. lastActiveAt: ${new Date(body.lastActiveAt).toISOString()}`
      );
    }

    return staleBodies.length;
  }

  /**
   * 自动归档：将超过 archiveDays 未活跃的 stale 知识体标记为 archived
   * 仅更改 lifecycleStatus，保留所有数据（碎片关联、节点、演化日志）
   *
   * @param {string} userId
   * @param {number} archiveDays - 默认 60
   * @returns {Promise<number>} 归档的数量
   * Requirements: 4.1, 4.2
   */
  async autoArchive(userId, archiveDays = 60) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - archiveDays * 24 * 60 * 60 * 1000);

    // 查询 lifecycleStatus="stale" 且 lastActiveAt 距今超过 archiveDays 的知识体
    const archivableBodies = await prisma.knowledgeBody.findMany({
      where: {
        userId,
        lifecycleStatus: 'stale',
        lastActiveAt: {
          lt: cutoffDate,
        },
      },
      select: { id: true, themeName: true, lastActiveAt: true },
    });

    if (archivableBodies.length === 0) {
      return 0;
    }

    const archiveIds = archivableBodies.map(b => b.id);

    // 批量更新为 archived（仅更改 lifecycleStatus，保留所有其他数据）
    await prisma.knowledgeBody.updateMany({
      where: { id: { in: archiveIds } },
      data: { lifecycleStatus: 'archived' },
    });

    // 记录归档日志
    for (const body of archivableBodies) {
      console.log(
        `[LifecycleService] ${now.toISOString()} - KnowledgeBody "${body.themeName}" (${body.id}) archived. lastActiveAt: ${new Date(body.lastActiveAt).toISOString()}`
      );
    }

    return archivableBodies.length;
  }

  /**
   * 意图体级联归档：当所有子知识体均为 archived 时，归档父意图体
   * 对于没有 children 的意图体，按照与 TopicBody 相同的 staleDays/archiveDays 规则处理
   *
   * @param {string} userId
   * @param {number} staleDays - 默认 30
   * @param {number} archiveDays - 默认 60
   * @returns {Promise<void>}
   * Requirements: 6.1, 6.3
   */
  async cascadeArchiveIntentBodies(userId, staleDays = 30, archiveDays = 60) {
    const now = new Date();

    // 获取所有 bodyType="intent" 且 lifecycleStatus != "archived" 的意图体，包含 children
    const intentBodies = await prisma.knowledgeBody.findMany({
      where: {
        userId,
        bodyType: 'intent',
        lifecycleStatus: { not: 'archived' },
      },
      include: { children: true },
    });

    for (const intentBody of intentBodies) {
      if (intentBody.children.length > 0) {
        // 有 children：如果所有 children 的 lifecycleStatus 均为 "archived"，归档该意图体
        const allChildrenArchived = intentBody.children.every(
          child => child.lifecycleStatus === 'archived'
        );

        if (allChildrenArchived) {
          await prisma.knowledgeBody.update({
            where: { id: intentBody.id },
            data: { lifecycleStatus: 'archived' },
          });

          console.log(
            `[LifecycleService] ${now.toISOString()} - IntentBody "${intentBody.themeName}" (${intentBody.id}) cascade archived. All children are archived.`
          );
        }
      } else {
        // 没有 children：按照与 TopicBody 相同的 staleDays/archiveDays 规则处理
        const lastActive = new Date(intentBody.lastActiveAt);
        const daysSinceLastActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24);

        if (intentBody.lifecycleStatus === 'active' && daysSinceLastActive > staleDays) {
          // active → stale
          await prisma.knowledgeBody.update({
            where: { id: intentBody.id },
            data: { lifecycleStatus: 'stale' },
          });

          console.log(
            `[LifecycleService] ${now.toISOString()} - IntentBody "${intentBody.themeName}" (${intentBody.id}) marked as stale (no children, ${daysSinceLastActive.toFixed(1)} days inactive).`
          );
        } else if (intentBody.lifecycleStatus === 'stale' && daysSinceLastActive > archiveDays) {
          // stale → archived
          await prisma.knowledgeBody.update({
            where: { id: intentBody.id },
            data: { lifecycleStatus: 'archived' },
          });

          console.log(
            `[LifecycleService] ${now.toISOString()} - IntentBody "${intentBody.themeName}" (${intentBody.id}) archived (no children, ${daysSinceLastActive.toFixed(1)} days inactive).`
          );
        }
      }
    }
  }

  /**
   * 重新激活知识体（从 stale/archived → active）
   * 同时更新 lastActiveAt，重算 confidenceScore（不应用衰减），级联激活父意图体
   *
   * @param {string} bodyId
   * @returns {Promise<object>} 更新后的知识体
   * Requirements: 5.1, 5.2, 5.3, 6.2
   */
  async reactivateBody(bodyId) {
    const now = new Date();

    // 查找知识体
    const body = await prisma.knowledgeBody.findUnique({
      where: { id: bodyId },
    });

    if (!body) {
      throw new Error('KnowledgeBody not found');
    }

    // 已经是 active 的知识体幂等处理，仅更新 lastActiveAt
    if (body.lifecycleStatus === 'active') {
      const updated = await prisma.knowledgeBody.update({
        where: { id: bodyId },
        data: { lastActiveAt: now },
      });
      return updated;
    }

    // 重新计算 confidenceScore（不应用衰减因子）
    let fragmentIds = [];
    try {
      fragmentIds = JSON.parse(body.relatedFragmentIds || '[]');
    } catch {
      fragmentIds = [];
    }

    let fragments = [];
    if (fragmentIds.length > 0) {
      fragments = await prisma.cognitiveFragment.findMany({
        where: { id: { in: fragmentIds } },
        select: { id: true, createdAt: true },
      });
    }

    const weightedCount = this.calculateWeightedFragmentCount(fragments);

    // 计算 timeSpanDays
    let timeSpanDays = 0;
    if (fragments.length > 0) {
      const dates = fragments.map(f => new Date(f.createdAt).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      timeSpanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    }

    // avgSimilarity: use 0.5 as default (same as applyDecay)
    const avgSimilarity = 0.5;

    // 计算原始置信度（不应用衰减因子）
    const confidenceScore = this.calculateOriginalConfidence({
      weightedCount,
      timeSpanDays,
      avgSimilarity,
    });

    // 更新知识体：lifecycleStatus → active, lastActiveAt → now, confidenceScore 重算
    const updated = await prisma.knowledgeBody.update({
      where: { id: bodyId },
      data: {
        lifecycleStatus: 'active',
        lastActiveAt: now,
        confidenceScore,
      },
    });

    console.log(
      `[LifecycleService] ${now.toISOString()} - KnowledgeBody "${body.themeName}" (${body.id}) reactivated from "${body.lifecycleStatus}" to "active". confidenceScore: ${confidenceScore.toFixed(4)}`
    );

    // 级联激活：如果有 parentId，检查父意图体
    if (body.parentId) {
      const parent = await prisma.knowledgeBody.findUnique({
        where: { id: body.parentId },
      });

      if (parent && parent.lifecycleStatus !== 'active') {
        await prisma.knowledgeBody.update({
          where: { id: parent.id },
          data: {
            lifecycleStatus: 'active',
            lastActiveAt: now,
          },
        });

        console.log(
          `[LifecycleService] ${now.toISOString()} - IntentBody "${parent.themeName}" (${parent.id}) cascade reactivated from "${parent.lifecycleStatus}" to "active".`
        );
      }
    }

    return updated;
  }

  /**
   * 执行完整的生命周期扫描（衰减 + 陈旧检测 + 自动归档 + 级联归档）
   * 各阶段部分失败时记录错误但继续执行后续阶段
   * @param {string} userId
   * @returns {Promise<{staleCount: number, archivedCount: number}>}
   * Requirements: 8.1, 8.2
   */
  async runLifecycleScan(userId) {
    let staleCount = 0;
    let archivedCount = 0;

    // Stage 1: 置信度时间衰减
    try {
      await this.applyDecay(userId);
    } catch (err) {
      console.error('[LifecycleService] runLifecycleScan - applyDecay failed:', err.message);
    }

    // Stage 2: 陈旧检测
    try {
      staleCount = await this.detectStale(userId);
    } catch (err) {
      console.error('[LifecycleService] runLifecycleScan - detectStale failed:', err.message);
    }

    // Stage 3: 自动归档
    try {
      archivedCount = await this.autoArchive(userId);
    } catch (err) {
      console.error('[LifecycleService] runLifecycleScan - autoArchive failed:', err.message);
    }

    // Stage 4: 意图体级联归档
    try {
      await this.cascadeArchiveIntentBodies(userId);
    } catch (err) {
      console.error('[LifecycleService] runLifecycleScan - cascadeArchiveIntentBodies failed:', err.message);
    }

    return { staleCount, archivedCount };
  }





}

// Export singleton instance and class
const lifecycleService = new LifecycleService();
module.exports = lifecycleService;
module.exports.LifecycleService = LifecycleService;
