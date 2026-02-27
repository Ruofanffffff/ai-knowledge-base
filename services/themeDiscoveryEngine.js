/**
 * ThemeDiscoveryEngine - 主题发现引擎
 * 
 * 定期扫描认知碎片，通过语义聚类发现正在形成的主题，
 * 计算置信度并管理知识体的生长阶段。
 * 
 * 需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const embeddingService = require('./embeddingService');
const llmClient = require('./llmClient');
const intentAggregationService = require('./intentAggregationService');
const lifecycleService = require('./lifecycleService');

class ThemeDiscoveryEngine {
  constructor() {
    this._isRunning = false;
  }

    /**
     * 阶段1: 从碎片中提取关键词并统计频率
     * 调用 LLM 提取每条碎片的关键词/实体，统计全局频率，归并同义词
     * @param {Array<{id: string, content: string}>} fragments
     * @returns {Promise<KeywordIndex>} { keywords: Map<string, {count, fragmentIds}>, totalFragments, isFallback }
     */
    async extractKeywords(fragments) {
          const keywordIndex = {
            keywords: new Map(),
            totalFragments: fragments.length,
            isFallback: false,
          };

          let llmSuccessCount = 0;

          for (const fragment of fragments) {
            let keywords;
            try {
              keywords = await this._extractKeywordsFromContent(fragment.content || '');
              llmSuccessCount++;
            } catch (error) {
              console.error(`[ThemeDiscoveryEngine] LLM keyword extraction failed for fragment ${fragment.id}:`, error.message);
              continue;
            }

            for (const kw of keywords) {
              const normalized = kw.trim().toLowerCase();
              if (!normalized) continue;

              if (keywordIndex.keywords.has(normalized)) {
                const entry = keywordIndex.keywords.get(normalized);
                if (!entry.fragmentIds.includes(fragment.id)) {
                  entry.count += 1;
                  entry.fragmentIds.push(fragment.id);
                }
              } else {
                keywordIndex.keywords.set(normalized, {
                  count: 1,
                  fragmentIds: [fragment.id],
                });
              }
            }
          }

          // If no LLM call succeeded for any fragment, fall back to simple tokenization
          if (llmSuccessCount === 0 && fragments.length > 0) {
            console.warn('[ThemeDiscoveryEngine] All LLM keyword extractions failed, falling back to simple tokenization');
            return this._fallbackTokenize(fragments);
          }

          return keywordIndex;
        }

    /**
     * LLM 提取单条碎片的关键词（内部方法）
     * @param {string} content - 碎片内容
     * @returns {Promise<string[]>} 关键词列表
     */
    async _extractKeywordsFromContent(content) {
      const prompt = `从以下内容中提取关键词和实体。要求：
  1. 提取内容中的核心关键词、人名、地名、专有名词等实体
  2. 将同一概念的不同表述归并为同一关键词（例如"乌镇"和"乌镇古镇"应归并为"乌镇"）
  3. 每个关键词尽量简短精炼
  4. 返回 JSON 格式：{"keywords": ["关键词1", "关键词2", ...]}

  内容：
  ${content}`;

      const result = await llmClient.callJSON(prompt, {
        temperature: 0.1,
        maxTokens: 500,
      });

      if (Array.isArray(result.keywords)) {
        return result.keywords.map(k => String(k));
      }

      return [];
    }

    /**
     * LLM 失败时的回退：简单分词统计
     * 按标点/空格切分碎片内容，过滤停用词，构建 KeywordIndex
     * @param {Array<{id: string, content: string}>} fragments
     * @returns {KeywordIndex} { keywords: Map<string, {count, fragmentIds}>, totalFragments, isFallback: true }
     */
    _fallbackTokenize(fragments) {
      const STOP_WORDS = new Set([
        // 中文停用词
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
        '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
        '自己', '这', '他', '她', '它', '们', '那', '些', '什么', '怎么', '如何', '可以',
        '这个', '那个', '但是', '因为', '所以', '如果', '虽然', '还是', '或者', '以及',
        '而且', '不过', '然后', '已经', '正在', '将要', '应该', '可能', '需要', '能够',
        '比较', '非常', '特别', '其实', '当然', '一些', '这些', '那些', '每个', '所有',
        '其他', '之后', '之前', '关于', '通过', '进行', '使用', '对于', '还有',
        // 英文停用词
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
        'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
        'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
        'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same',
        'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
        'if', 'while', 'about', 'up', 'it', 'its', 'this', 'that', 'i', 'me',
        'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
        'they', 'them', 'their', 'what', 'which', 'who', 'whom',
      ]);

      const keywordIndex = {
        keywords: new Map(),
        totalFragments: fragments.length,
        isFallback: true,
      };

      for (const fragment of fragments) {
        const content = fragment.content || '';
        if (!content.trim()) continue;

        // Split by punctuation and whitespace
        const tokens = content
          .split(/[\s,，。.!！?？;；:：、""''""''()（）【】\[\]{}<>《》\-—–\n\r\t]+/)
          .map(t => t.trim().toLowerCase())
          .filter(t => t.length > 0 && !STOP_WORDS.has(t));

        // Deduplicate tokens per fragment
        const uniqueTokens = [...new Set(tokens)];

        for (const token of uniqueTokens) {
          if (keywordIndex.keywords.has(token)) {
            const entry = keywordIndex.keywords.get(token);
            entry.count += 1;
            entry.fragmentIds.push(fragment.id);
          } else {
            keywordIndex.keywords.set(token, {
              count: 1,
              fragmentIds: [fragment.id],
            });
          }
        }
      }

      return keywordIndex;
    }

    /**
     * 阶段2: 筛选高频关键词并关联碎片 ID
     * 按频率降序排列，筛选 count ≥ threshold 的关键词
     * @param {KeywordIndex} keywordIndex - 关键词索引
     * @param {number} threshold - 频率阈值，默认 2
     * @returns {HighFrequencyResult} { highFreqKeywords: HighFrequencyKeyword[], skipped: boolean }
     * 需求: 2.1, 2.2, 2.3, 2.4
     */
    filterHighFrequency(keywordIndex, threshold = 2) {
      const highFreqKeywords = [];

      for (const [keyword, entry] of keywordIndex.keywords) {
        if (entry.count >= threshold) {
          highFreqKeywords.push({
            keyword,
            count: entry.count,
            fragmentIds: [...entry.fragmentIds],
          });
        }
      }

      // Sort by count descending
      highFreqKeywords.sort((a, b) => b.count - a.count);

      const skipped = highFreqKeywords.length === 0;

      if (skipped) {
        console.log('[ThemeDiscoveryEngine] 无高频关键词，跳过本次主题发现');
      }

      return { highFreqKeywords, skipped };
    }

      /**
       * 阶段3: LLM 主题分析
       * 将高频关键词及其关联碎片内容发送给 LLM，返回主题候选列表
       * @param {HighFrequencyKeyword[]} highFreqKeywords
       * @param {Map<string, CognitiveFragment>} fragmentMap - 碎片 ID → 碎片对象
       * @returns {Promise<ThemeCandidate[]>}
       * 需求: 3.1, 3.2, 3.3, 3.5
       */
      async analyzeThemes(highFreqKeywords, fragmentMap) {
        // Build keyword-fragment context for the prompt
        const keywordSections = highFreqKeywords.map(kw => {
          const fragmentContents = kw.fragmentIds
            .filter(id => fragmentMap.has(id))
            .map(id => {
              const fragment = fragmentMap.get(id);
              return `  [${id}] ${fragment.content || ''}`;
            })
            .join('\n');
          return `关键词: "${kw.keyword}" (出现 ${kw.count} 次)\n关联碎片:\n${fragmentContents}`;
        }).join('\n\n');

        const validFragmentIds = [...fragmentMap.keys()];

        const prompt = `基于以下高频关键词及其关联的认知碎片内容，分析并归纳出主题候选列表。

    要求：
    1. 每个主题包含：themeName（主题名称，不超过20个字符）、themeDescription（主题描述，不超过50个字符）、fragmentIds（关联的碎片ID列表）
    2. 将语义相近但地理位置不同的内容（如不同城市的旅行笔记）拆分为独立主题
    3. 每个碎片可以属于多个主题
    4. fragmentIds 必须从以下有效ID中选取: ${validFragmentIds.join(', ')}

    高频关键词及关联碎片:
    ${keywordSections}

    请以 JSON 格式返回：
    {"themes": [{"themeName": "主题名称", "themeDescription": "主题描述", "fragmentIds": ["id1", "id2"]}]}`;

        const result = await llmClient.callJSON(prompt, {
          temperature: 0.3,
          maxTokens: 2000,
        });

        const themes = Array.isArray(result.themes) ? result.themes : [];

        // Validate and filter each ThemeCandidate
        return themes
          .filter(t => t && typeof t === 'object')
          .map(t => ({
            themeName: String(t.themeName || '').slice(0, 20),
            themeDescription: String(t.themeDescription || '').slice(0, 50),
            fragmentIds: (Array.isArray(t.fragmentIds) ? t.fragmentIds : [])
              .map(id => String(id))
              .filter(id => fragmentMap.has(id)),
          }));
      }

      /**
       * 将主题候选与已有知识体匹配（基于名称语义相似度 + 碎片 ID 重叠度）
       * @param {string} userId
       * @param {{themeName: string, themeDescription: string, fragmentIds: string[]}} candidate - ThemeCandidate
       * @returns {Promise<object|null>} 匹配到的 KnowledgeBody 或 null
       */
      async _matchExistingBody(userId, candidate) {
        const existingBodies = await prisma.knowledgeBody.findMany({
          where: { userId }
        });

        if (existingBodies.length === 0) {
          return null;
        }

        const NAME_WEIGHT = 0.6;
        const OVERLAP_WEIGHT = 0.4;
        const MATCH_THRESHOLD = 0.4;

        let bestBody = null;
        let bestScore = -1;

        for (const body of existingBodies) {
          // Compute name similarity via embedding
          let nameSimilarity = 0;
          try {
            const candidateEmbedding = await embeddingService.generateEmbedding(candidate.themeName);
            const bodyEmbedding = await embeddingService.generateEmbedding(body.themeName);
            if (candidateEmbedding && bodyEmbedding) {
              nameSimilarity = embeddingService.cosineSimilarity(candidateEmbedding, bodyEmbedding);
            }
          } catch (e) {
            // On embedding failure, nameSimilarity stays 0
          }

          // Compute fragment ID overlap (Jaccard similarity)
          const bodyFragmentIds = new Set(JSON.parse(body.relatedFragmentIds || '[]'));
          const candidateFragmentIds = new Set(candidate.fragmentIds || []);
          const intersection = [...candidateFragmentIds].filter(id => bodyFragmentIds.has(id));
          const unionSize = new Set([...bodyFragmentIds, ...candidateFragmentIds]).size;
          const overlapScore = unionSize > 0 ? intersection.length / unionSize : 0;

          // Weighted combination
          const score = NAME_WEIGHT * nameSimilarity + OVERLAP_WEIGHT * overlapScore;

          if (score > bestScore) {
            bestScore = score;
            bestBody = body;
          }
        }

        return bestScore >= MATCH_THRESHOLD ? bestBody : null;
      }

      /**
       * 更新已有知识体（合并碎片 ID，重新计算置信度，更新关联实体）
       * @param {object} body - 已有 KnowledgeBody 记录
       * @param {{themeName: string, themeDescription: string, fragmentIds: string[]}} candidate - ThemeCandidate
       * 需求: 4.2, 4.5
       */
      async _updateBody(body, candidate) {
        // 1. Merge candidate.fragmentIds into body.relatedFragmentIds (set union, no duplicates)
        const existingIds = JSON.parse(body.relatedFragmentIds || '[]');
        const mergedIds = [...new Set([...existingIds, ...candidate.fragmentIds])];

        // 2. Recalculate confidenceScore
        // Fetch fragments to compute time span
        const fragments = await prisma.cognitiveFragment.findMany({
          where: { id: { in: mergedIds } },
          select: { id: true, content: true, createdAt: true },
        });

        let timeSpanDays = 0;
        if (fragments.length >= 2) {
          const times = fragments.map(f => new Date(f.createdAt).getTime());
          const minTime = Math.min(...times);
          const maxTime = Math.max(...times);
          timeSpanDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
        }

        const newConfidence = this.calculateConfidence({
          fragmentCount: mergedIds.length,
          timeSpanDays,
          avgSimilarity: 0.7, // default similarity for keyword-based matching
        });

        // 3. Call updateGrowthPhase
        await this.updateGrowthPhase(body.id, newConfidence);

        // 4. Query UnifiedEntity table for related entities
        const fragmentContents = fragments.map(f => f.content || '');
        const relatedEntityIds = await this._findRelatedEntities(fragmentContents);
        const existingEntityIds = JSON.parse(body.relatedEntityIds || '[]');
        const mergedEntityIds = [...new Set([...existingEntityIds, ...relatedEntityIds])];

        // 5. Update the body in database
        await prisma.knowledgeBody.update({
          where: { id: body.id },
          data: {
            relatedFragmentIds: JSON.stringify(mergedIds),
            relatedEntityIds: JSON.stringify(mergedEntityIds),
          },
        });
      }

      /**
       * 创建新知识体
       * 初始值: confidenceScore=0.3, growthPhase="discovery"
       * @param {string} userId
       * @param {{themeName: string, themeDescription: string, fragmentIds: string[]}} candidate - ThemeCandidate
       * @returns {Promise<object>} 创建的 KnowledgeBody
       * 需求: 4.3, 4.4, 4.5
       */
      async _createBody(userId, candidate) {
        // 1. Generate themeEmbedding via embeddingService
        let themeEmbedding = undefined;
        try {
          const embedding = await embeddingService.generateEmbedding(candidate.themeName);
          if (embedding) {
            themeEmbedding = JSON.stringify(embedding);
          }
        } catch (err) {
          console.error('[ThemeDiscoveryEngine] Failed to generate themeEmbedding for new body:', err.message);
        }

        // 2. Find related entities via _findRelatedEntities
        const candidateFragmentIds = (candidate.fragmentIds || []);
        // We need fragment content for entity matching - fetch from DB
        let fragments = [];
        if (candidateFragmentIds.length > 0) {
          try {
            fragments = await prisma.cognitiveFragment.findMany({
              where: { id: { in: candidate.fragmentIds } },
              select: { id: true, content: true },
            });
          } catch (err) {
            console.error('[ThemeDiscoveryEngine] Failed to fetch fragments for entity matching:', err.message);
          }
        }
        const fragmentContents = fragments.map(f => f.content || '');
        const relatedEntityIds = await this._findRelatedEntities(fragmentContents);

        // 3. Create new KnowledgeBody
        const createData = {
          userId,
          themeName: candidate.themeName,
          themeDescription: candidate.themeDescription,
          confidenceScore: 0.3,
          growthPhase: 'discovery',
          relatedFragmentIds: JSON.stringify(candidate.fragmentIds || []),
          relatedEntityIds: JSON.stringify(relatedEntityIds),
        };

        if (themeEmbedding) {
          createData.themeEmbedding = themeEmbedding;
        }

        const created = await prisma.knowledgeBody.create({ data: createData });
        return created;
      }

      /**
       * 检测主题演化（比较更新前后的名称/描述）
       * @param {object} body - 更新前的知识体 (KnowledgeBody)
       * @param {object} candidate - 新的主题候选 { themeName, themeDescription, fragmentIds }
       * @returns {Promise<boolean>} 是否检测到演化
       * 需求: 6.1, 6.2, 6.3
       */
      async _detectEvolution(body, candidate) {
        const oldName = body.themeName || '';
        const newName = candidate.themeName || '';
        const oldDesc = body.themeDescription || '';
        const newDesc = candidate.themeDescription || '';

        // If neither changed, do nothing
        if (oldName === newName && oldDesc === newDesc) {
          return false;
        }

        // Calculate driftScore via embedding cosine distance
        let driftScore = 0;
        try {
          const oldText = oldName + ' ' + oldDesc;
          const newText = newName + ' ' + newDesc;
          const oldEmbedding = await embeddingService.generateEmbedding(oldText);
          const newEmbedding = await embeddingService.generateEmbedding(newText);

          if (oldEmbedding && newEmbedding) {
            const similarity = embeddingService.cosineSimilarity(oldEmbedding, newEmbedding);
            driftScore = 1 - similarity;
          }
        } catch (error) {
          console.error('[ThemeDiscoveryEngine] Failed to compute driftScore:', error.message);
          // driftScore remains 0 on error
        }

        // Record in ThemeEvolutionLog
        await prisma.themeEvolutionLog.create({
          data: {
            bodyId: body.id,
            previousThemeName: oldName,
            previousThemeDescription: oldDesc,
            newThemeName: newName,
            newThemeDescription: newDesc,
            driftScore,
          },
        });

        return true;
      }

      /**
       * 检查自上次成功发现以来是否有新碎片
       * @param {string} userId
       * @returns {Promise<boolean>}
       * 需求: 5.2, 5.3
       */
      async _hasNewFragments(userId) {
        // 1. Query ThemeDiscoveryLog for the last successful completion
        const lastCompleted = await prisma.themeDiscoveryLog.findFirst({
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
        });

        // 2. If no previous successful discovery exists, return true (first run)
        if (!lastCompleted || !lastCompleted.completedAt) {
          return true;
        }

        // 3. Check if there are CognitiveFragments created after the last completed timestamp
        const newFragmentCount = await prisma.cognitiveFragment.count({
          where: {
            userId,
            createdAt: { gt: lastCompleted.completedAt },
          },
        });

        return newFragmentCount > 0;
      }




  /**
   * 执行一次完整的主题发现扫描
   * @param {'scheduler' | 'manual'} triggeredBy - 触发方式
   * @returns {Promise<object>} ThemeDiscoveryResult
   */
  /**
     * 执行一次完整的主题发现（重构后的入口）
     * 三阶段流水线：关键词提取 → 高频筛选 → LLM 分析
     * @param {'scheduler' | 'manual'} triggeredBy - 触发方式
     * @returns {Promise<DiscoverResult>}
     */
    async discover(triggeredBy) {
      // 并发防护 (Req 8.1)
      if (this._isRunning) {
        return {
          status: 'rejected',
          reason: 'Discovery is already running',
          triggeredBy
        };
      }

      this._isRunning = true;
      let log = null;

      try {
        // 获取 userId（从配置或第一个用户）
        const firstUser = await prisma.cognitiveFragment.findFirst({
          select: { userId: true },
        });
        const userId = firstUser ? firstUser.userId : null;

        if (!userId) {
          // 无用户碎片，记录 skipped 日志
          log = await prisma.themeDiscoveryLog.create({
            data: {
              status: 'skipped',
              triggeredBy,
              startedAt: new Date(),
              completedAt: new Date(),
            }
          });
          return {
            status: 'skipped',
            reason: 'No users with fragments found',
            triggeredBy,
            logId: log.id,
          };
        }

        // 增量检查：调用 _hasNewFragments (Req 5.2, 5.3)
        const hasNew = await this._hasNewFragments(userId);
        if (!hasNew) {
          // 无新碎片时记录 skipped 日志并返回 (Req 7.4)
          log = await prisma.themeDiscoveryLog.create({
            data: {
              status: 'skipped',
              triggeredBy,
              startedAt: new Date(),
              completedAt: new Date(),
            }
          });
          return {
            status: 'skipped',
            reason: 'No new fragments since last discovery',
            triggeredBy,
            logId: log.id,
          };
        }

        // 创建 running 日志 (Req 7.1, 7.5)
        log = await prisma.themeDiscoveryLog.create({
          data: {
            status: 'running',
            triggeredBy,
            startedAt: new Date()
          }
        });

        // 获取用户在 30 天窗口内的所有碎片
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const fragments = await prisma.cognitiveFragment.findMany({
          where: {
            userId,
            createdAt: { gte: since },
          },
        });

        const fragmentsScanned = fragments.length;

        // 阶段1: extractKeywords (Req 1.1-1.5)
        const keywordIndex = await this.extractKeywords(fragments);

        // 阶段2: filterHighFrequency (Req 2.1-2.4)
        const highFreqResult = this.filterHighFrequency(keywordIndex);

        // 无高频关键词时记录 completed（themesFound=0）并返回 (Req 2.3)
        if (highFreqResult.skipped) {
          await prisma.themeDiscoveryLog.update({
            where: { id: log.id },
            data: {
              status: 'completed',
              themesFound: 0,
              fragmentsScanned,
              completedAt: new Date(),
            }
          });
          return {
            status: 'completed',
            themesFound: 0,
            fragmentsScanned,
            triggeredBy,
            logId: log.id,
          };
        }

        // 构建 fragmentMap
        const fragmentMap = new Map();
        for (const f of fragments) {
          fragmentMap.set(f.id, f);
        }

        // 阶段3: analyzeThemes (Req 3.1-3.5)
        const candidates = await this.analyzeThemes(highFreqResult.highFreqKeywords, fragmentMap);

        // 遍历 ThemeCandidate 进行知识体匹配/创建/更新 (Req 4.1-4.5)
        // 阶段3.5: 碎片归属判定 — 优先使用 intentAggregationService.assignFragment() (Req 7.2)
        let themesFound = 0;
        for (const candidate of candidates) {
          // Prioritize intentAggregationService for fragment assignment (Req 3.1, 3.6)
          let matchedBody = null;
          try {
            matchedBody = await intentAggregationService.assignFragment(userId, candidate);
          } catch (assignErr) {
            // Fallback to original _matchExistingBody on failure
            console.error('[ThemeDiscoveryEngine] assignFragment failed, falling back to _matchExistingBody:', assignErr.message);
            matchedBody = await this._matchExistingBody(userId, candidate);
          }

          if (matchedBody) {
            // assignFragment already merges fragments internally; still detect evolution
            await this._detectEvolution(matchedBody, candidate);
          } else {
            await this._createBody(userId, candidate);
            themesFound++;
          }
        }

        // 阶段4: 意图推断与聚合 (Req 7.1, 7.2)
        // Wrapped in try-catch for fault isolation — Stage 4 failure must NOT affect Stage 1-3 results (Req 7.5)
        let intentBodiesCreated = 0;
        let bodiesMerged = 0;
        let stage4Error = null;

        try {
          const aggregationResult = await intentAggregationService.aggregateBodies(userId);
          intentBodiesCreated = aggregationResult.intentBodiesCreated || 0;
          bodiesMerged = aggregationResult.bodiesMerged || 0;
          if (aggregationResult.errors && aggregationResult.errors.length > 0) {
            stage4Error = aggregationResult.errors.join('; ');
          }
        } catch (stage4Err) {
          stage4Error = stage4Err.message;
          console.error('[ThemeDiscoveryEngine] Stage 4 (intent aggregation) failed:', stage4Err.message);
          // Preserve Stage 1-3 results — do not rethrow
        }

        // 阶段5: 生命周期扫描（衰减 + 陈旧检测 + 自动归档 + 级联归档）
        // 与阶段4相同的容错隔离模式
        let staleCount = 0;
        let archivedCount = 0;
        let stage5Error = null;

        try {
          const lifecycleResult = await lifecycleService.runLifecycleScan(userId);
          staleCount = lifecycleResult.staleCount || 0;
          archivedCount = lifecycleResult.archivedCount || 0;
        } catch (stage5Err) {
          stage5Error = stage5Err.message;
          console.error('[ThemeDiscoveryEngine] Stage 5 (lifecycle scan) failed:', stage5Err.message);
        }

        // 更新日志为 completed (Req 7.2, 7.3)
        await prisma.themeDiscoveryLog.update({
          where: { id: log.id },
          data: {
            status: 'completed',
            themesFound,
            fragmentsScanned,
            intentBodiesCreated,
            bodiesMerged,
            stage4Error,
            staleCount,
            archivedCount,
            stage5Error,
            completedAt: new Date(),
          }
        });

        return {
          status: 'completed',
          themesFound,
          fragmentsScanned,
          intentBodiesCreated,
          bodiesMerged,
          stage4Error,
          staleCount,
          archivedCount,
          stage5Error,
          triggeredBy,
          logId: log.id,
        };
      } catch (error) {
        // 更新日志为 failed (Req 7.3)
        if (log) {
          await prisma.themeDiscoveryLog.update({
            where: { id: log.id },
            data: {
              status: 'failed',
              error: error.message,
              completedAt: new Date(),
            }
          });
        }
        return {
          status: 'failed',
          reason: error.message,
          triggeredBy,
          logId: log ? log.id : undefined,
        };
      } finally {
        // 释放运行锁 (Req 8.3)
        this._isRunning = false;
      }
    }

  /**
   * 计算置信度
   * 公式: 0.4 * min(n/10, 1) + 0.3 * min(d/14, 1) + 0.3 * s
   * 
   * @param {object} params
   * @param {number} params.fragmentCount - 碎片数量 (n)
   * @param {number} params.timeSpanDays - 时间跨度天数 (d)
   * @param {number} params.avgSimilarity - 平均余弦相似度 (s)
   * @returns {number} 置信度分数 [0, 1]
   */
  calculateConfidence({ fragmentCount, timeSpanDays, avgSimilarity }) {
    const n = Math.max(0, fragmentCount);
    const d = Math.max(0, timeSpanDays);
    const s = Math.max(0, Math.min(1, avgSimilarity));

    return 0.4 * Math.min(n / 10, 1) + 0.3 * Math.min(d / 14, 1) + 0.3 * s;
  }

  /**
   * 根据置信度阈值更新生长阶段
   * <0.6 = discovery, ≥0.6 = skeleton, ≥0.8 = flesh
   * 
   * @param {string} bodyId - 知识体 ID
   * @param {number} newConfidence - 新的置信度分数
   */
  async updateGrowthPhase(bodyId, newConfidence) {
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
        growthPhase
      }
    });
  }

  /**
   * 查询 Knowledge_Graph 中与碎片内容语义相关的 UnifiedEntity 数据
   * 使用文本匹配：检查 UnifiedEntity 的 cleanedName 是否出现在碎片内容中
   *
   * @param {string[]} fragmentContents - 碎片内容数组
   * @returns {Promise<string[]>} 关联的 UnifiedEntity ID 列表
   * @private
   * 需求: 6.1, 6.2, 6.3
   */
  async _findRelatedEntities(fragmentContents) {
    try {
      const entities = await prisma.unifiedEntity.findMany();
      if (!entities || entities.length === 0) return [];

      // Concatenate all fragment content for matching
      const allContent = (fragmentContents || [])
        .map(c => (c || '').toLowerCase())
        .join(' ');

      const relatedIds = [];
      for (const entity of entities) {
        const name = (entity.cleanedName || '').toLowerCase().trim();
        if (name.length === 0) continue;

        if (allContent.includes(name)) {
          relatedIds.push(entity.id);
        }
      }

      return relatedIds;
    } catch (error) {
      console.error('[ThemeDiscoveryEngine] Failed to find related entities:', error.message);
      return [];
    }
  }

}

// 导出单例实例和类
const themeDiscoveryEngine = new ThemeDiscoveryEngine();
module.exports = themeDiscoveryEngine;
module.exports.ThemeDiscoveryEngine = ThemeDiscoveryEngine;
