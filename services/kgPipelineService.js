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
     * Step 4: 增量合并新旧实体和关系
     * @param {Array} newEntities - 新提取的实体 [{name, description}]
     * @param {Array} newRelations - 新提取的关系 [{source, target, name, description}]
     * @param {Array} existingEntities - 已有的CleanedEntity [{name, description}]
     * @param {Array} existingRelations - 已有的CleanedRelation [{source, target, name, description}]
     * @returns {Promise<{entities: Array, relations: Array}>} 合并后的完整列表
     */
    async mergeIncremental(newEntities, newRelations, existingEntities, existingRelations) {
      // Step 4a: Merge entities via LLM
      const entityPrompt = `请将新提取的实体与已有实体进行合并。
  要求：
  - 含义相同或相似的实体合并为一个
  - 已有实体的描述如有新信息则更新
  - 文本中提及但尚未建立的实体需补充
  - 实体名称不超过6个字，描述不超过20个字
  - 以JSON数组格式返回合并后的完整实体列表

  已有实体：${JSON.stringify(existingEntities)}
  新提取实体：${JSON.stringify(newEntities)}`;

      const entityResult = await llmClient.callJSON(entityPrompt, { temperature: 0.3 });
      const mergedEntitiesRaw = Array.isArray(entityResult) ? entityResult : [];
      const mergedEntities = mergedEntitiesRaw.map((e) => truncateEntity(e.name, e.description));

      // Step 4b: Merge relations via LLM
      const mergedEntityNames = mergedEntities.map((e) => e.name);

      const relationPrompt = `请将新提取的关系与已有关系进行合并。
  要求：
  - 含义相同或相似的关系合并为一个
  - 已有关系的描述如有新信息则更新
  - source和target必须是合并后实体列表中的实体名称
  - 关系名称不超过4个字，描述不超过20个字
  - 以JSON数组格式返回：[{"source": "源实体名", "target": "目标实体名", "name": "关系名", "description": "描述"}]

  合并后实体列表：${JSON.stringify(mergedEntityNames)}
  已有关系：${JSON.stringify(existingRelations)}
  新提取关系：${JSON.stringify(newRelations)}`;

      const relationResult = await llmClient.callJSON(relationPrompt, { temperature: 0.3 });
      const mergedRelationsRaw = Array.isArray(relationResult) ? relationResult : [];
      const truncatedRelations = mergedRelationsRaw.map((r) => {
        const { name, description } = truncateRelation(r.name, r.description);
        return { source: r.source, target: r.target, name, description };
      });
      const mergedRelations = filterValidRelations(truncatedRelations, mergedEntityNames);

      return { entities: mergedEntities, relations: mergedRelations };
    }

  /** Step 5: 持久化保存到数据库 */
  async persistToDatabase(mergedEntities, mergedRelations, docId) {
    await prisma.$transaction(async (tx) => {
      // Delete existing data (relations first due to FK constraints)
      await tx.cleanedRelation.deleteMany();
      await tx.cleanedEntity.deleteMany();

      // Create entities and build name→id map
      const nameToId = new Map();
      for (const entity of mergedEntities) {
        const created = await tx.cleanedEntity.create({
          data: {
            cleanedName: entity.name,
            description: entity.description,
            sourceEntityIds: JSON.stringify([docId]),
          },
        });
        nameToId.set(entity.name, created.id);
      }

      // Create relations, skipping any with missing source/target
      for (const relation of mergedRelations) {
        const sourceId = nameToId.get(relation.source);
        const targetId = nameToId.get(relation.target);
        if (!sourceId || !targetId) continue;

        await tx.cleanedRelation.create({
          data: {
            cleanedName: relation.name,
            description: relation.description,
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            sourceRelationIds: JSON.stringify([docId]),
          },
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

        // extracting_entities
        updateStatus('extracting_entities');
        const entities = await this.extractEntities(indexText);

        // extracting_relations
        updateStatus('extracting_relations');
        const relations = await this.extractRelations(indexText, entities);

        // merging
        updateStatus('merging');
        const existingEntitiesRaw = await prisma.cleanedEntity.findMany();
        const existingEntities = existingEntitiesRaw.map((e) => ({
          name: e.cleanedName,
          description: e.description,
        }));

        const existingRelationsRaw = await prisma.cleanedRelation.findMany({
          include: { source: true, target: true },
        });
        const existingRelations = existingRelationsRaw.map((r) => ({
          source: r.source.cleanedName,
          target: r.target.cleanedName,
          name: r.cleanedName,
          description: r.description,
        }));

        const merged = await this.mergeIncremental(entities, relations, existingEntities, existingRelations);

        // saving
        updateStatus('saving');
        await this.persistToDatabase(merged.entities, merged.relations, docId);

        // completed
        updateStatus('completed', {
          completedAt: new Date(),
          entityCount: merged.entities.length,
          relationCount: merged.relations.length,
        });

        return {
          docId,
          entityCount: merged.entities.length,
          relationCount: merged.relations.length,
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
