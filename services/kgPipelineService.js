const llmClient = require('./llmClient');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 旧文档数据库路径
const USERS_DB_PATH = path.join(__dirname, '../data/users.db');

/**
 * 从旧的 users.db 读取文档内容
 */
function getDocumentFromLegacyDB(docId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(USERS_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Cannot open legacy DB: ${err.message}`));
    });
    db.get('SELECT id, title, content FROM documents WHERE id = ?', [docId], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// 内存中的Pipeline状态追踪
const pipelineStatus = new Map();

// 四层认知结构验证常量
const VALID_ENTITY_TYPES = ['concept', 'object', 'process', 'role', 'rule', 'tool', 'target', 'data'];
const VALID_SOURCE_TAGS = ['fact', 'inferred', 'pattern'];
const VALID_LAYERS = ['how', 'why'];
const WEAK_RELATION_NAMES = ['相关', '有关', '影响', '关联'];

/**
 * 截断实体字段：名称≤6字符，描述≤20字符
 */
function truncateEntity(name, description) {
  return {
    name: typeof name === 'string' ? name.slice(0, 6) : '',
    description: typeof description === 'string' ? description.slice(0, 20) : '',
  };
}

/**
 * 截断关系字段：名称≤4字符，描述≤20字符
 */
function truncateRelation(name, description) {
  return {
    name: typeof name === 'string' ? name.slice(0, 4) : '',
    description: typeof description === 'string' ? description.slice(0, 20) : '',
  };
}

/**
 * 过滤无效关系：source和target必须存在于entityNames中
 */
function filterValidRelations(relations, entityNames) {
  const nameSet = new Set(entityNames);
  return relations.filter(
    (r) => nameSet.has(r.source) && nameSet.has(r.target)
  );
}

/**
 * 截断实体字段（四层版本）：名称≤6字符，定义≤30字符
 */
function truncateEntityFourLayer(entity) {
  return {
    name: typeof entity.name === 'string' ? entity.name.slice(0, 6) : '',
    type: VALID_ENTITY_TYPES.includes(entity.type) ? entity.type : 'concept',
    definition: typeof entity.definition === 'string' ? entity.definition.slice(0, 30) : '',
    source: VALID_SOURCE_TAGS.includes(entity.source) ? entity.source : 'fact',
  };
}

/**
 * 截断关系字段（四层版本）：名称≤4字符，描述≤20字符
 */
function truncateRelationFourLayer(relation) {
  return {
    source: relation.source,
    target: relation.target,
    name: typeof relation.name === 'string' ? relation.name.slice(0, 4) : '',
    description: typeof relation.description === 'string' ? relation.description.slice(0, 20) : '',
    layer: VALID_LAYERS.includes(relation.layer) ? relation.layer : 'how',
    source_tag: VALID_SOURCE_TAGS.includes(relation.source_tag) ? relation.source_tag : 'fact',
  };
}

/**
 * 截断原则字段：名称≤8字符，描述≤40字符
 */
function truncatePrinciple(principle) {
  return {
    name: typeof principle.name === 'string' ? principle.name.slice(0, 8) : '',
    description: typeof principle.description === 'string' ? principle.description.slice(0, 40) : '',
    related_entities: Array.isArray(principle.related_entities) ? principle.related_entities : [],
    source: VALID_SOURCE_TAGS.includes(principle.source) ? principle.source : 'pattern',
  };
}

/**
 * 验证并清洗四层提取结果
 */
function validateAndCleanFourLayerResult(result) {
  const raw = result || {};

  // 1. 清洗实体
  const rawEntities = Array.isArray(raw.entities) ? raw.entities : [];
  const entities = rawEntities
    .map(truncateEntityFourLayer)
    .filter(e => e.name.length > 0);

  const entityNames = new Set(entities.map(e => e.name));

  // 2. 清洗关系：截断 + 过滤空名称 + 过滤弱关系 + 过滤无效引用
  const rawRelations = Array.isArray(raw.relations) ? raw.relations : [];
  const relations = rawRelations
    .map(truncateRelationFourLayer)
    .filter(r => r.name.length > 0)
    .filter(r => !WEAK_RELATION_NAMES.includes(r.name))
    .filter(r => entityNames.has(r.source) && entityNames.has(r.target));

  // 3. 清洗原则：截断 + 过滤空名称 + 过滤无关联实体的原则
  const rawPrinciples = Array.isArray(raw.principles_or_patterns) ? raw.principles_or_patterns : [];
  const principles = rawPrinciples
    .map(truncatePrinciple)
    .filter(p => p.name.length > 0)
    .filter(p => p.related_entities.some(e => entityNames.has(e)));

  return { entities, relations, principles };
}

class KGPipelineService {
  /**
   * Step 1: 生成LLM索引
   * @param {string} docContent - 文档全文
   * @returns {Promise<string>} 压缩后的LLM索引文本
   */
  async generateIndex(docContent) {
    const prompt = `你是一个文档分析专家。请深入理解以下文档，生成一段结构化的索引摘要。

分析步骤：
1. 首先判断文档的主题领域和核心主旨
2. 识别文档围绕哪些核心概念/主体展开论述
3. 梳理这些核心概念之间的逻辑关系（因果、包含、依赖、对比等）
4. 提炼关键论点、结论和重要细节

输出要求：
- 第一行用一句话概括文档主旨
- 然后列出核心概念及其角色（如：主体、方法、目标、工具等）
- 最后描述概念之间的关键关系
- 保持精简，但确保核心语义完整

文档内容：
${docContent}`;

    const indexText = await llmClient.call(prompt, { temperature: 0.3 });
    return indexText.trim();
  }

  /** Step 2: 从LLM索引提取实体（待实现） */
  /** Step 2: 从LLM索引提取实体 */
    async extractEntities(indexText) {
      const prompt = `你是知识图谱构建专家。请从以下文档索引中提取核心实体。

提取原则：
1. 先理解文档的主旨和核心内容
2. 实体应该是文档论述的核心主体、关键概念、重要方法或目标对象
3. 优先提取：文档主题词、核心理论/技术、关键人物/组织、重要工具/方法、目标/成果
4. 避免提取：过于宽泛的通用词（如"方法"、"系统"）、修饰性词语、非核心的细节名词
5. 每个实体的描述应说明它在文档语境中的具体角色或含义

格式要求：
- 实体名称不超过6个字（精炼但有辨识度）
- 实体描述不超过20个字（说明在文档中的角色）
- 以JSON数组格式返回：[{"name": "实体名", "description": "在文档中的角色描述"}]
- 提取8-15个最核心的实体

文本：
${indexText}`;

      const result = await llmClient.callJSON(prompt, { temperature: 0.3 });

      const entities = Array.isArray(result) ? result : [];

      return entities.map((e) => truncateEntity(e.name, e.description));
    }
      /**
       * 构建四层认知结构提取 prompt
       * @param {string} indexText - 文档索引文本
       * @returns {string} 完整 prompt
       */
      /**
         * 构建四层认知结构提取 prompt
         * @param {string} indexText - 文档索引文本
         * @returns {string} 完整 prompt
         */
        buildFourLayerPrompt(indexText) {
          return `你是知识图谱构建专家，擅长从文档中提取多层认知结构。请从以下文档索引中提取四层认知结构数据。

      ## 四层认知结构说明

      ### 第一层：事实层（What）— 提取核心实体
      每个实体包含：
      - name: 实体名称，≤6个字，精炼且有辨识度
      - type: 实体类型，必须是以下之一：
        - concept: 抽象概念、理论、思想
        - object: 具体对象、产品、作品
        - process: 流程、步骤、方法
        - role: 人物、角色、组织
        - rule: 规则、规范、标准
        - tool: 工具、技术、框架
        - target: 目标、指标、成果
        - data: 数据、资源、信息
      - definition: 精确定义，≤30个字，说明该实体在文档语境中的具体含义
      - source: 来源标注，取值：
        - fact: 文档中明确陈述的事实
        - inferred: 基于文档内容合理推断
        - pattern: 跨概念归纳的模式

      ### 第二层：结构层（How）— 提取结构性关系
      描述实体间的组织结构关系（包含、组成、依赖、实现、使用等）。

      ### 第三层：机制/因果层（Why）— 提取因果性关系
      描述实体间的因果、触发、约束关系（导致、触发、约束、要求、决定等）。

      每条关系包含：
      - source: 主动方实体名称（必须在实体列表中）
      - target: 被动方实体名称（必须在实体列表中）
      - name: 关系名称，≤4个字，具体明确
      - description: 关系描述，≤20个字
      - layer: "how"（结构层）或 "why"（因果层）
      - source_tag: 来源标注（fact/inferred/pattern）

      ### 第四层：抽象/方法论层（So What）— 提取可迁移原则
      提取文档中蕴含的可迁移规则、设计原则、方法论模式。
      每条原则包含：
      - name: 原则名称，≤8个字
      - description: 原则描述，≤40个字
      - related_entities: 关联的实体名称列表
      - source: 来源标注（fact/inferred/pattern）

      ## 禁止事项
      - 禁止使用弱关系词作为关系名称："相关"、"有关"、"影响"、"关联"
      - 禁止提取过于宽泛的通用词作为实体（如"方法"、"系统"、"技术"）
      - 禁止关系的 source 和 target 指向不在实体列表中的名称

      ## 负面示例
      ❌ 关系名称"相关" → 应改为具体关系如"驱动"、"包含"、"依赖"
      ❌ 实体名称"方法" → 应改为具体方法如"梯度下降"、"A/B测试"
      ❌ 来源标注缺失 → 每个元素必须有 source 字段

      ## 数量约束
      - 实体：8-20个
      - 关系：合理数量，确保核心逻辑脉络完整
      - 原则/模式：0-5个（如文档无明显方法论内容可为空数组）

      ## 输出格式
      严格以JSON格式返回，不要包含任何其他文字：
      {
        "entities": [
          {"name": "实体名", "type": "concept", "definition": "精确定义", "source": "fact"}
        ],
        "relations": [
          {"source": "源实体", "target": "目标实体", "name": "关系名", "description": "描述", "layer": "how", "source_tag": "fact"}
        ],
        "principles_or_patterns": [
          {"name": "原则名", "description": "原则描述", "related_entities": ["实体1", "实体2"], "source": "pattern"}
        ]
      }

      ## 文档索引
      ${indexText}`;
        }
        /**
         * Step 2+3: 四层认知结构提取（替换原 extractEntities + extractRelations）
         * @param {string} indexText - Step 1 生成的索引文本
         * @returns {Promise<{entities: Array, relations: Array, principles: Array}>}
         */
        async extractFourLayers(indexText) {
          const prompt = this.buildFourLayerPrompt(indexText);
          const result = await llmClient.callJSON(prompt, { temperature: 0.3, maxTokens: 4000 });
          return validateAndCleanFourLayerResult(result);
        }



  /** Step 3: 从LLM索引提取关系（待实现） */
  /** Step 3: 从LLM索引提取关系 */
    async extractRelations(indexText, entities) {
      const entityNames = entities.map((e) => e.name);

      const prompt = `你是知识图谱构建专家。请根据文档索引和实体列表，提取实体之间有意义的关系。

提取原则：
1. 关系应反映文档中实体之间的真实语义联系
2. 优先提取：因果关系、包含/组成关系、依赖关系、作用/影响关系、实现/应用关系
3. 关系名称应具体明确（如"驱动"、"包含"、"依赖"、"产出"），避免模糊的"相关"
4. 每对实体之间只保留最重要的一条关系
5. 确保关系链能串联起文档的核心逻辑脉络

格式要求：
- 关系名称不超过4个字
- 关系描述不超过20个字（说明具体的关联方式）
- source和target必须是已有实体列表中的实体名称
- 以JSON数组格式返回：[{"source": "源实体名", "target": "目标实体名", "name": "关系名", "description": "具体关联描述"}]

已有实体：${entityNames.join('、')}

文本：
${indexText}`;

      const result = await llmClient.callJSON(prompt, { temperature: 0.3 });

      const relations = Array.isArray(result) ? result : [];

      const truncated = relations.map((r) => {
        const { name, description } = truncateRelation(r.name, r.description);
        return { source: r.source, target: r.target, name, description };
      });

      return filterValidRelations(truncated, entityNames);
    }

  /** Step 4: 增量合并（待实现） */
  /**
     * Step 4: 增量合并新旧实体和关系（仅在同一文档范围内）
     * @param {Array} newEntities - 新提取的实体 [{name, description}]
     * @param {Array} newRelations - 新提取的关系 [{source, target, name, description}]
     * @param {string} docId - 文档ID
     * @returns {Promise<{entities: Array, relations: Array}>} 合并后的完整列表
     */
    async mergeIncremental(newData, docId) {
          // newData = { entities, relations, principles }
          const { entities: newEntities, relations: newRelations, principles: newPrinciples } = newData;

          // Fetch existing DocEntity for this specific document (including entityType and source)
          const existingEntitiesRaw = await prisma.docEntity.findMany({ where: { docId } });
          const existingEntities = existingEntitiesRaw.map((e) => ({
            name: e.cleanedName,
            type: e.entityType || 'concept',
            definition: e.description,
            source: e.source || 'fact',
          }));

          const existingRelationsRaw = await prisma.docRelation.findMany({
            where: { docId },
            include: { source: true, target: true },
          });
          const existingRelations = existingRelationsRaw.map((r) => ({
            source: r.source.cleanedName,
            target: r.target.cleanedName,
            name: r.cleanedName,
            description: r.description,
            layer: r.layer || 'how',
            source_tag: r.source || 'fact',
          }));

          // Step 4a: Merge entities via LLM (four-layer version with type and source)
          const entityPrompt = `请将新提取的实体与已有实体进行合并。
    要求：
    - 含义相同或相似的实体合并为一个
    - 已有实体的定义如有新信息则更新
    - 文本中提及但尚未建立的实体需补充
    - 合并时保留最准确的 type（实体类型）和 source（来源标注）
    - 如果新旧实体类型不同，优先采用更具体的类型
    - 如果新旧来源标注不同，优先级：fact > inferred > pattern
    - 输出格式：每个实体包含 name（≤6字）、type（Entity_Type枚举：concept/object/process/role/rule/tool/target/data）、definition（≤30字）、source（Source_Tag：fact/inferred/pattern）
    - 以JSON数组格式返回合并后的完整实体列表

    已有实体：${JSON.stringify(existingEntities)}
    新提取实体：${JSON.stringify(newEntities)}`;

          const entityResult = await llmClient.callJSON(entityPrompt, { temperature: 0.3 });
          const mergedEntitiesRaw = Array.isArray(entityResult) ? entityResult : [];
          const mergedEntities = mergedEntitiesRaw
            .map((e) => truncateEntityFourLayer(e))
            .filter((e) => e.name.length > 0);

          // Step 4b: Merge relations via LLM (four-layer version with layer and source_tag)
          const mergedEntityNames = mergedEntities.map((e) => e.name);

          const relationPrompt = `请将新提取的关系与已有关系进行合并。
    要求：
    - 含义相同或相似的关系合并为一个
    - 已有关系的描述如有新信息则更新
    - source和target必须是合并后实体列表中的实体名称
    - 合并时保留 layer（how/why）和 source_tag（fact/inferred/pattern）字段
    - 如果新旧关系 layer 不同，保留语义更深层的（why 优先于 how）
    - 如果新旧来源标注不同，优先级：fact > inferred > pattern
    - 输出格式：每个关系包含 source（源实体）、target（目标实体）、name（≤4字）、description（≤20字）、layer（how/why）、source_tag（fact/inferred/pattern）
    - 以JSON数组格式返回

    合并后实体列表：${JSON.stringify(mergedEntityNames)}
    已有关系：${JSON.stringify(existingRelations)}
    新提取关系：${JSON.stringify(newRelations)}`;

          const relationResult = await llmClient.callJSON(relationPrompt, { temperature: 0.3 });
          const mergedRelationsRaw = Array.isArray(relationResult) ? relationResult : [];
          const mergedRelations = mergedRelationsRaw
            .map((r) => truncateRelationFourLayer(r))
            .filter((r) => r.name.length > 0)
            .filter((r) => !WEAK_RELATION_NAMES.includes(r.name))
            .filter((r) => {
              const nameSet = new Set(mergedEntityNames);
              return nameSet.has(r.source) && nameSet.has(r.target);
            });

          // Step 4c: Merge principles via LLM
          const mergedPrinciples = await this.mergePrinciplesWithLLM(docId, newPrinciples, mergedEntities);

          return { entities: mergedEntities, relations: mergedRelations, principles: mergedPrinciples };
        }

        /**
         * Merge principles via LLM (four-layer So What layer)
         * @param {string} docId - Document ID
         * @param {Array} newPrinciples - Newly extracted principles
         * @param {Array} mergedEntities - Already merged entities (for filtering)
         * @returns {Promise<Array>} Merged principles
         */
        async mergePrinciplesWithLLM(docId, newPrinciples, mergedEntities) {
          // Fetch existing DocPrinciple for this document
          const existingPrinciplesRaw = await prisma.docPrinciple.findMany({ where: { docId } });
          const existingPrinciples = existingPrinciplesRaw.map((p) => ({
            name: p.name,
            description: p.description,
            related_entities: (() => { try { return JSON.parse(p.relatedEntityIds); } catch { return []; } })(),
            source: p.source || 'pattern',
          }));

          // If no principles to merge, return empty
          if (existingPrinciples.length === 0 && (!newPrinciples || newPrinciples.length === 0)) {
            return [];
          }

          const mergedEntityNames = mergedEntities.map((e) => e.name);

          const principlePrompt = `请将新提取的原则/模式与已有原则进行合并。
    要求：
    - 含义相同或相似的原则合并为一个
    - 已有原则的描述如有新信息则更新
    - related_entities 必须是合并后实体列表中的实体名称
    - 合并时保留 source（来源标注）字段
    - 如果新旧来源标注不同，优先级：fact > inferred > pattern
    - 输出格式：每个原则包含 name（≤8字）、description（≤40字）、related_entities（关联实体名称数组）、source（Source_Tag：fact/inferred/pattern）
    - 以JSON数组格式返回

    合并后实体列表：${JSON.stringify(mergedEntityNames)}
    已有原则：${JSON.stringify(existingPrinciples)}
    新提取原则：${JSON.stringify(newPrinciples || [])}`;

          const principleResult = await llmClient.callJSON(principlePrompt, { temperature: 0.3 });
          const mergedPrinciplesRaw = Array.isArray(principleResult) ? principleResult : [];
          const entityNameSet = new Set(mergedEntityNames);

          const mergedPrinciples = mergedPrinciplesRaw
            .map((p) => truncatePrinciple(p))
            .filter((p) => p.name.length > 0)
            .filter((p) => p.related_entities.some((e) => entityNameSet.has(e)));

          return mergedPrinciples;
        }

  /** Step 5: 持久化保存到数据库 */
  async persistToDatabase(mergedData, docId) {
    // mergedData = { entities, relations, principles }
    await prisma.$transaction(async (tx) => {
      // Delete existing DocRelation, DocEntity, and DocPrinciple for this docId
      await tx.docRelation.deleteMany({ where: { docId } });
      await tx.docEntity.deleteMany({ where: { docId } });
      await tx.docPrinciple.deleteMany({ where: { docId } });

      // Create entities and build name→id map (with entityType and source fields)
      const nameToId = new Map();
      for (const entity of mergedData.entities) {
        const created = await tx.docEntity.create({
          data: {
            docId,
            cleanedName: entity.name,
            description: entity.definition || entity.description,  // four-layer uses 'definition'
            entityType: entity.type || 'concept',
            source: entity.source || 'fact',
          },
        });
        nameToId.set(entity.name, created.id);
      }

      // Create relations (with layer and source fields), skipping any with missing source/target
      for (const relation of mergedData.relations) {
        const sourceId = nameToId.get(relation.source);
        const targetId = nameToId.get(relation.target);
        if (!sourceId || !targetId) continue;

        await tx.docRelation.create({
          data: {
            docId,
            cleanedName: relation.name,
            description: relation.description,
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            layer: relation.layer || 'how',
            source: relation.source_tag || 'fact',
          },
        });
      }

      // Create principles
      for (const principle of mergedData.principles || []) {
        const relatedIds = principle.related_entities
          .map(name => nameToId.get(name))
          .filter(Boolean);
        await tx.docPrinciple.create({
          data: {
            docId,
            name: principle.name,
            description: principle.description,
            relatedEntityIds: JSON.stringify(relatedIds),
            source: principle.source || 'pattern',
          },
        });
      }

      // Update DocumentIndex metadata with lastPipelineAt timestamp
      const existingIndex = await tx.documentIndex.findFirst({ where: { docId } });
      if (existingIndex) {
        const metadata = JSON.parse(existingIndex.metadata || '{}');
        metadata.lastPipelineAt = new Date().toISOString();
        
        await tx.documentIndex.update({
          where: { id: existingIndex.id },
          data: { metadata: JSON.stringify(metadata) },
        });
      }
    });
  }

  /** 保存LLM索引到数据库（待实现） */
  /** 保存LLM索引到数据库 */
    async saveIndex(docId, indexText, metadata) {
      const metadataStr = JSON.stringify(metadata);
      const existing = await prisma.documentIndex.findFirst({ where: { docId } });

      if (existing) {
        return prisma.documentIndex.update({
          where: { id: existing.id },
          data: {
            indexedText: indexText,
            metadata: metadataStr,
            version: existing.version + 1,
          },
        });
      }

      return prisma.documentIndex.create({
        data: {
          docId,
          indexedText: indexText,
          metadata: metadataStr,
        },
      });
    }

  /** 执行完整流水线（待实现） */
  /** 执行完整流水线 */
    async runPipeline(docId) {
      const updateStatus = (status, extra = {}) => {
        const current = pipelineStatus.get(docId) || {};
        pipelineStatus.set(docId, {
          docId,
          startedAt: current.startedAt || new Date(),
          completedAt: null,
          error: null,
          entityCount: 0,
          relationCount: 0,
          ...current,
          status,
          ...extra,
        });
      };

      try {
        // pending
        updateStatus('pending');

        // Read document from DB (try Prisma first, then legacy users.db)
        let doc = await prisma.document.findUnique({ where: { id: docId } });
        if (!doc) {
          doc = await getDocumentFromLegacyDB(docId);
        }
        if (!doc) {
          throw new Error(`Document not found: ${docId}`);
        }

        // indexing
        updateStatus('indexing');
        const indexText = await this.generateIndex(doc.content);
        await this.saveIndex(docId, indexText, {
          llm_model: 'qwen-plus',
          token_count: indexText.length,
          generated_at: new Date().toISOString(),
        });

        // extracting_four_layers (replaces extracting_entities + extracting_relations)
        updateStatus('extracting_four_layers');
        const { entities, relations, principles } = await this.extractFourLayers(indexText);

        // merging
        updateStatus('merging');
        const merged = await this.mergeIncremental({entities, relations, principles}, docId);

        // saving
        updateStatus('saving');
        await this.persistToDatabase(merged, docId);

        // completed
        updateStatus('completed', {
          completedAt: new Date(),
          entityCount: merged.entities.length,
          relationCount: merged.relations.length,
          principleCount: merged.principles.length,
        });

        return {
          docId,
          entityCount: merged.entities.length,
          relationCount: merged.relations.length,
          principleCount: merged.principles.length,
        };
      } catch (error) {
        updateStatus('failed', {
          completedAt: new Date(),
          error: error.message,
        });
        throw error;
      }
    }

  /** 获取Pipeline状态 */
  getStatus(docId) {
    return pipelineStatus.get(docId) || null;
  }
}

module.exports = new KGPipelineService();
module.exports.KGPipelineService = KGPipelineService;
module.exports.truncateEntity = truncateEntity;
module.exports.truncateRelation = truncateRelation;
module.exports.filterValidRelations = filterValidRelations;
module.exports.prisma = prisma;
module.exports.pipelineStatus = pipelineStatus;
module.exports.VALID_ENTITY_TYPES = VALID_ENTITY_TYPES;
module.exports.VALID_SOURCE_TAGS = VALID_SOURCE_TAGS;
module.exports.VALID_LAYERS = VALID_LAYERS;
module.exports.WEAK_RELATION_NAMES = WEAK_RELATION_NAMES;
module.exports.truncateEntityFourLayer = truncateEntityFourLayer;
module.exports.truncateRelationFourLayer = truncateRelationFourLayer;
module.exports.truncatePrinciple = truncatePrinciple;
module.exports.validateAndCleanFourLayerResult = validateAndCleanFourLayerResult;
