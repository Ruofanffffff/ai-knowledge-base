/**
 * IntentAggregationService - 意图聚合服务
 *
 * 提供以下核心功能：
 * - assignFragment(userId, candidate): 碎片归属判定，将主题候选匹配到已有知识体
 * - aggregateBodies(userId): 知识体聚合，推断共同意图并建立层级
 * - _computeBodySimilarity(bodyA, bodyB): 计算两个知识体之间的语义相似度
 * - calculateIntentConfidence(intentBodyId): 计算意图知识体的置信度
 *
 * Requirements: 2.1-2.7, 3.1-3.6, 4.1-4.5, 8.1-8.4, 9.1-9.5
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const embeddingService = require('./embeddingService');
const llmClient = require('./llmClient');

const { validateParentId, validateChildBodies } = require('./parentIdValidator');
const lifecycleService = require('./lifecycleService');

const NAME_WEIGHT = 0.6;
const OVERLAP_WEIGHT = 0.4;
const MATCH_THRESHOLD = 0.4;
const AGGREGATION_SIMILARITY_THRESHOLD = 0.5;
const INTENT_NAME_MAX_LENGTH = 25;
const INTENT_DESC_MAX_LENGTH = 80;

class IntentAggregationService {
  /**
   * 碎片归属判定：将主题候选匹配到已有知识体
   * 优先匹配 bodyType="topic" 的知识体
   *
   * @param {string} userId
   * @param {{ themeName: string, themeDescription: string, fragmentIds: string[] }} candidate
   * @returns {Promise<Object|null>} 匹配到的知识体或 null
   */
  async assignFragment(userId, candidate) {
    const existingBodies = await prisma.knowledgeBody.findMany({
      where: { userId },
    });

    if (existingBodies.length === 0) {
      return null;
    }

    // Separate topic and intent bodies; prioritize topic (Req 3.6)
    const topicBodies = existingBodies.filter(b => b.bodyType === 'topic');
    const intentBodies = existingBodies.filter(b => b.bodyType === 'intent');

    // Generate candidate embedding once
    let candidateEmbedding = null;
    try {
      candidateEmbedding = await embeddingService.generateEmbedding(candidate.themeName);
    } catch (e) {
      // On embedding failure, candidateEmbedding stays null
    }

    // First try to match topic bodies (Req 3.6: topic priority)
    let bestBody = null;
    let bestScore = -1;

    for (const body of topicBodies) {
      const score = this._calculateMatchScore(candidateEmbedding, candidate.fragmentIds, body);
      if (score > bestScore) {
        bestScore = score;
        bestBody = body;
      }
    }

    // Only try intent bodies if no topic body matched above threshold
    if (bestScore < MATCH_THRESHOLD) {
      for (const body of intentBodies) {
        const score = this._calculateMatchScore(candidateEmbedding, candidate.fragmentIds, body);
        if (score > bestScore) {
          bestScore = score;
          bestBody = body;
        }
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestBody) {
      // Merge fragments into the matched body (Req 3.3)
      await this._mergeToBody(bestBody, candidate);
      return bestBody;
    }

    // Score < 0.4: return null, caller creates new body (Req 3.4)
    return null;
  }

  /**
   * 计算候选与知识体之间的加权匹配分数
   * matchScore = 0.6 × cosineSimilarity + 0.4 × jaccardSimilarity
   *
   * @param {number[]|null} candidateEmbedding - 候选的 embedding 向量
   * @param {string[]} candidateFragmentIds - 候选的碎片 ID 列表
   * @param {Object} body - 知识体
   * @returns {number} 匹配分数 [0, 1]
   */
  _calculateMatchScore(candidateEmbedding, candidateFragmentIds, body) {
    // Cosine similarity from embeddings
    let cosineSim = 0;
    if (candidateEmbedding && body.themeEmbedding) {
      try {
        const bodyEmbedding = JSON.parse(body.themeEmbedding);
        if (Array.isArray(bodyEmbedding) && bodyEmbedding.length > 0) {
          cosineSim = embeddingService.cosineSimilarity(candidateEmbedding, bodyEmbedding);
        }
      } catch (e) {
        // Parse failure, cosineSim stays 0
      }
    }

    // Jaccard similarity of fragment IDs
    const bodyFragmentIds = new Set(JSON.parse(body.relatedFragmentIds || '[]'));
    const candidateIds = new Set(candidateFragmentIds || []);
    const intersection = [...candidateIds].filter(id => bodyFragmentIds.has(id));
    const unionSize = new Set([...bodyFragmentIds, ...candidateIds]).size;
    const jaccardSim = unionSize > 0 ? intersection.length / unionSize : 0;

    // Weighted combination (Req 3.2)
    return NAME_WEIGHT * cosineSim + OVERLAP_WEIGHT * jaccardSim;
  }

  /**
   * 合并碎片到已有知识体，并重新计算置信度 (Req 3.3, 3.5)
   *
   * @param {Object} body - 目标知识体
   * @param {{ fragmentIds: string[] }} candidate - 候选主题
   */
  async _mergeToBody(body, candidate) {
      // Check if the target body is stale or archived, trigger reactivation
      if (body.lifecycleStatus === 'stale' || body.lifecycleStatus === 'archived') {
        await lifecycleService.reactivateBody(body.id);
      }

      // Merge fragment IDs (set union)
      const existingIds = JSON.parse(body.relatedFragmentIds || '[]');
      const mergedIds = [...new Set([...existingIds, ...(candidate.fragmentIds || [])])];

      // Update fragment IDs
      await prisma.knowledgeBody.update({
        where: { id: body.id },
        data: {
          relatedFragmentIds: JSON.stringify(mergedIds),
        },
      });

      // Recalculate confidence (Req 3.5)
      await this._recalculateConfidence(body.id, mergedIds);
    }

  /**
   * 重新计算知识体置信度
   * 使用与 ThemeDiscoveryEngine.calculateConfidence 相同的公式
   *
   * @param {string} bodyId
   * @param {string[]} fragmentIds
   */
  async _recalculateConfidence(bodyId, fragmentIds) {
    const fragments = await prisma.cognitiveFragment.findMany({
      where: { id: { in: fragmentIds } },
      select: { id: true, createdAt: true },
    });

    let timeSpanDays = 0;
    if (fragments.length >= 2) {
      const times = fragments.map(f => new Date(f.createdAt).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      timeSpanDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
    }

    // Same formula as ThemeDiscoveryEngine.calculateConfidence
    const n = Math.max(0, fragmentIds.length);
    const d = Math.max(0, timeSpanDays);
    const s = 0.7; // default similarity for keyword-based matching

    const newConfidence = 0.4 * Math.min(n / 10, 1) + 0.3 * Math.min(d / 14, 1) + 0.3 * s;

    // Update growth phase based on confidence thresholds
    let growthPhase;
    if (newConfidence >= 0.8) {
      growthPhase = 'flesh';
    } else if (newConfidence >= 0.6) {
      growthPhase = 'skeleton';
    } else {
      growthPhase = 'discovery';
    }

    await prisma.knowledgeBody.update({
      where: { id: bodyId },
      data: {
        confidenceScore: newConfidence,
        growthPhase,
      },
    });
  }

  /**
   * 计算两个知识体之间的语义相似度
   * 使用 themeEmbedding 余弦相似度
   *
   * @param {Object} bodyA - 知识体 A
   * @param {Object} bodyB - 知识体 B
   * @returns {number} 相似度 [0, 1]
   */
  _computeBodySimilarity(bodyA, bodyB) {
    if (!bodyA.themeEmbedding || !bodyB.themeEmbedding) {
      return 0;
    }

    try {
      const embeddingA = JSON.parse(bodyA.themeEmbedding);
      const embeddingB = JSON.parse(bodyB.themeEmbedding);

      if (!Array.isArray(embeddingA) || !Array.isArray(embeddingB)) {
        return 0;
      }

      if (embeddingA.length !== embeddingB.length) {
        console.warn('[IntentAggregationService] Embedding dimension mismatch, skipping comparison');
        return 0;
      }

      return embeddingService.cosineSimilarity(embeddingA, embeddingB);
    } catch (e) {
      return 0;
    }
  }

  /**
   * 知识体聚合：检查无父节点的 topic 知识体，推断共同意图并建立层级
   * (Req 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4)
   *
   * @param {string} userId
   * @returns {Promise<{intentBodiesCreated: number, bodiesMerged: number, errors: string[]}>}
   */
  async aggregateBodies(userId) {
    const result = { intentBodiesCreated: 0, bodiesMerged: 0, errors: [] };

    // Step 1: Get all parentId=null and bodyType="topic" bodies (Req 4.1)
    const orphanBodies = await prisma.knowledgeBody.findMany({
      where: { userId, parentId: null, bodyType: 'topic' },
    });

    if (orphanBodies.length < 2) {
      return result;
    }

    // Step 2: Compute pairwise themeEmbedding cosine similarity
    // Build groups of similar bodies using union-find approach
    const groups = this._buildSimilarityGroups(orphanBodies);

    // Step 3: For each group with similarity > 0.5, call LLM to infer common intent
    for (const group of groups) {
      if (group.length < 2) continue;

      try {
        const intent = await this._inferIntent(group, userId);
        if (!intent) continue;

        // Step 4: Check if existing intent body matches semantically (Req 2.7, 4.4)
        const existingIntent = await this._findExistingIntentBody(userId, intent.intentName);

        const relatedBodyIds = (intent.relatedBodyIds || []).filter(id =>
          group.some(b => b.id === id)
        );
        // If relatedBodyIds is empty, use all group body IDs
        const childBodyIds = relatedBodyIds.length > 0 ? relatedBodyIds : group.map(b => b.id);

        if (existingIntent) {
          // Attach new bodies to existing intent body (Req 2.7)
          await this._attachToExistingIntent(existingIntent, childBodyIds);
          result.bodiesMerged += childBodyIds.length;
        } else {
          // Create new intent body (Req 2.3, 4.3)
          await this._createIntentBody(userId, intent, childBodyIds);
          result.intentBodiesCreated += 1;
          result.bodiesMerged += childBodyIds.length;
        }
      } catch (error) {
        const errMsg = `Aggregation error for group: ${error.message}`;
        console.error('[IntentAggregationService]', errMsg);
        result.errors.push(errMsg);
        // Req 4.5: On failure, keep current hierarchy unchanged
      }
    }

    return result;
  }

  /**
   * Build groups of bodies with pairwise similarity > 0.5
   * Uses a simple greedy grouping approach
   *
   * @param {Object[]} bodies - orphan topic bodies
   * @returns {Object[][]} groups of similar bodies
   */
  _buildSimilarityGroups(bodies) {
    const n = bodies.length;
    // Union-Find
    const parent = Array.from({ length: n }, (_, i) => i);

    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }

    function union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    }

    // Compute pairwise similarity and union bodies with similarity > 0.5 (Req 4.2)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const similarity = this._computeBodySimilarity(bodies[i], bodies[j]);
        if (similarity > AGGREGATION_SIMILARITY_THRESHOLD) {
          union(i, j);
        }
      }
    }

    // Collect groups
    const groupMap = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groupMap.has(root)) groupMap.set(root, []);
      groupMap.get(root).push(bodies[i]);
    }

    return [...groupMap.values()];
  }

  /**
   * 调用 LLM 推断一组知识体的共同意图 (Req 2.1, 2.6)
   * Uses the prompt template from design doc
   *
   * @param {Object[]} bodies - 语义相关的知识体列表
   * @param {string} userId - 用户 ID，用于获取已有意图知识体
   * @returns {Promise<{intentName: string, intentDescription: string, relatedBodyIds: string[]}|null>}
   */
  async _inferIntent(bodies, userId) {
    // Get existing intent bodies to avoid duplicates (Req 2.6)
    const existingIntents = await prisma.knowledgeBody.findMany({
      where: { userId, bodyType: 'intent' },
      select: { id: true, themeName: true, themeDescription: true },
    });

    // Build prompt from design doc template
    const bodiesSection = bodies
      .map(b => `- ${b.themeName}: ${b.themeDescription}`)
      .join('\n');

    const existingIntentsSection = existingIntents.length > 0
      ? existingIntents.map(i => `- ${i.themeName}: ${i.themeDescription}`).join('\n')
      : '（无）';

    const prompt = `你是一个知识管理助手。以下是用户的多个知识主题，请分析它们之间的共同意图。

已有知识体：
${bodiesSection}

已有意图知识体（避免重复创建）：
${existingIntentsSection}

请判断以上知识体是否有共同的上层意图。如果有，返回：
{"intent": {"intentName": "不超过25个字符", "intentDescription": "不超过80个字符", "relatedBodyIds": [${bodies.map(b => `"${b.id}"`).join(', ')}]}}
如果没有共同意图，返回：
{"intent": null}`;

    const response = await llmClient.callJSON(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    if (!response || !response.intent) {
      return null;
    }

    const { intentName, intentDescription, relatedBodyIds } = response.intent;

    // Truncate to enforce length constraints (Req 2.2)
    return {
      intentName: String(intentName || '').slice(0, INTENT_NAME_MAX_LENGTH),
      intentDescription: String(intentDescription || '').slice(0, INTENT_DESC_MAX_LENGTH),
      relatedBodyIds: Array.isArray(relatedBodyIds) ? relatedBodyIds : [],
    };
  }

  /**
   * 查找已有的意图知识体中是否有语义匹配的 (Req 2.7, 4.4)
   *
   * @param {string} userId
   * @param {string} intentName
   * @returns {Promise<Object|null>} 匹配的意图知识体或 null
   */
  async _findExistingIntentBody(userId, intentName) {
    const existingIntents = await prisma.knowledgeBody.findMany({
      where: { userId, bodyType: 'intent' },
    });

    if (existingIntents.length === 0) return null;

    // Generate embedding for the new intent name
    let intentEmbedding = null;
    try {
      intentEmbedding = await embeddingService.generateEmbedding(intentName);
    } catch (e) {
      return null;
    }

    if (!intentEmbedding) return null;

    // Find the most similar existing intent body
    let bestMatch = null;
    let bestSimilarity = -1;

    for (const intent of existingIntents) {
      if (!intent.themeEmbedding) continue;

      try {
        const existingEmbedding = JSON.parse(intent.themeEmbedding);
        if (!Array.isArray(existingEmbedding) || existingEmbedding.length === 0) continue;

        const similarity = embeddingService.cosineSimilarity(intentEmbedding, existingEmbedding);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = intent;
        }
      } catch (e) {
        // Skip on parse error
      }
    }

    // Use a high threshold (0.7) for semantic matching of intent bodies
    return bestSimilarity >= 0.7 ? bestMatch : null;
  }

  /**
   * 创建意图知识体并设置子知识体的 parentId (Req 2.3, 2.4, 9.1, 9.5)
   * 在事务中执行，确保原子性 (Req 9.4)
   *
   * @param {string} userId
   * @param {{intentName: string, intentDescription: string}} intent
   * @param {string[]} childBodyIds
   * @returns {Promise<Object>} 创建的意图知识体
   */
  async _createIntentBody(userId, intent, childBodyIds) {
    // Use reusable validator for hierarchy constraints (Req 9.1, 9.3)
    const { validChildIds, skipped } = await validateChildBodies(null, childBodyIds);

    for (const s of skipped) {
      console.warn(`[IntentAggregationService] Body ${s.id}: ${s.reason}, skipping`);
    }

    if (validChildIds.length < 2) {
      // Not enough valid children to form an intent group
      return null;
    }

    // Generate embedding for the intent name
    let themeEmbedding = null;
    try {
      const embedding = await embeddingService.generateEmbedding(intent.intentName);
      if (embedding) {
        themeEmbedding = JSON.stringify(embedding);
      }
    } catch (e) {
      // Proceed without embedding
    }

    // Execute in transaction for atomicity (Req 9.4)
    const intentBody = await prisma.$transaction(async (tx) => {
      // Create the intent body
      const newIntentBody = await tx.knowledgeBody.create({
        data: {
          userId,
          themeName: intent.intentName,
          themeDescription: intent.intentDescription,
          bodyType: 'intent',
          confidenceScore: 0.3,
          growthPhase: 'discovery',
          relatedFragmentIds: '[]',
          themeEmbedding,
        },
      });

      // Set children's parentId to the new intent body (Req 2.4)
      await tx.knowledgeBody.updateMany({
        where: { id: { in: validChildIds } },
        data: { parentId: newIntentBody.id },
      });

      return newIntentBody;
    });

    // Calculate intent confidence after creation (Req 8.1, 8.2)
    await this.calculateIntentConfidence(intentBody.id);

    return intentBody;
  }

  /**
   * 将知识体挂到已有意图知识体下 (Req 2.7, 4.4)
   *
   * @param {Object} existingIntent - 已有的意图知识体
   * @param {string[]} childBodyIds - 要挂载的子知识体 ID 列表
   */
  async _attachToExistingIntent(existingIntent, childBodyIds) {
    // Validate parent body type using reusable validator (Req 9.5)
    const parentValidation = await validateParentId(existingIntent.id);
    if (!parentValidation.valid) {
      throw new Error(parentValidation.error);
    }

    // Use reusable validator for child constraints (Req 9.1, 9.3)
    const { validChildIds } = await validateChildBodies(existingIntent.id, childBodyIds);

    if (validChildIds.length === 0) return;

    // Update in transaction (Req 9.4)
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeBody.updateMany({
        where: { id: { in: validChildIds } },
        data: { parentId: existingIntent.id },
      });
    });

    // Recalculate intent confidence (Req 8.2)
    await this.calculateIntentConfidence(existingIntent.id);
  }

  /**
   * 计算意图知识体的置信度（子知识体置信度加权平均）(Req 8.1, 8.2)
   * 特殊规则：所有子知识体均为 mature 时，标记为 mature (Req 8.4)
   *
   * @param {string} intentBodyId
   * @returns {Promise<number>} 计算后的置信度
   */
  async calculateIntentConfidence(intentBodyId) {
    const children = await prisma.knowledgeBody.findMany({
      where: { parentId: intentBodyId },
    });

    if (children.length === 0) {
      return 0;
    }

    // Arithmetic mean of child confidence scores (Req 8.1)
    const avgConfidence = children.reduce((sum, c) => sum + c.confidenceScore, 0) / children.length;

    // Determine growth phase (Req 8.3)
    const allMature = children.every(c => c.growthPhase === 'mature');

    let growthPhase;
    if (allMature) {
      growthPhase = 'mature'; // Req 8.4
    } else if (avgConfidence >= 0.8) {
      growthPhase = 'flesh';
    } else if (avgConfidence >= 0.6) {
      growthPhase = 'skeleton';
    } else {
      growthPhase = 'discovery';
    }

    await prisma.knowledgeBody.update({
      where: { id: intentBodyId },
      data: {
        confidenceScore: avgConfidence,
        growthPhase,
      },
    });

    return avgConfidence;
  }
}

// Export singleton instance and class
const intentAggregationService = new IntentAggregationService();
module.exports = intentAggregationService;
module.exports.IntentAggregationService = IntentAggregationService;
