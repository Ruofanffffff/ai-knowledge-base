const llmClient = require('./llmClient');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

class UnificationService {
  /**
   * 读取所有分文章图谱数据
   * @returns {Promise<{entities: Array, relations: Array}>}
   */
  async loadAllDocGraphData() {
    const docEntities = await prisma.docEntity.findMany();
    const docRelations = await prisma.docRelation.findMany({
      include: {
        source: true,
        target: true,
      },
    });

    const entities = docEntities.map((e) => ({
      id: e.id,
      docId: e.docId,
      name: e.cleanedName,
      description: e.description,
    }));

    const relations = docRelations.map((r) => ({
      id: r.id,
      docId: r.docId,
      source: r.source.cleanedName,
      target: r.target.cleanedName,
      name: r.cleanedName,
      description: r.description,
    }));

    return { entities, relations };
  }

  /**
   * 通过 LLM 进行语义归纳合并
   * @param {Array} allDocEntities - 所有分文章实体
   * @param {Array} allDocRelations - 所有分文章关系
   * @returns {Promise<{entities: Array, relations: Array}>}
   */
  async unifyWithLLM(allDocEntities, allDocRelations) {
    // Step 1: 归纳实体
    const entityPrompt = `你是一个知识图谱归纳专家。请将以下多篇文档的实体进行语义归纳合并，生成上层概念。

要求：
- 语义相似的实体合并为一个上层概念（例如：垂直拍摄、光圈控制、逆光拍摄 → 拍摄手法）
- 上层概念名称不超过6个字
- 上层概念描述不超过20个字，需包含该概念涵盖的具体内容的总结
- 保留无法归纳的独立实体
- 以JSON数组格式返回：[{"name": "概念名", "description": "总结描述", "sourceEntityIds": ["id1", "id2"]}]

所有分文章实体：
${JSON.stringify(allDocEntities)}`;

    const entityResult = await llmClient.callJSON(entityPrompt, { 
      temperature: 0.3,
      maxTokens: 4000,
    });

    const unifiedEntitiesRaw = Array.isArray(entityResult) ? entityResult : [];
    
    // 截断并验证实体
    const unifiedEntities = unifiedEntitiesRaw.map((e) => {
      const truncated = truncateEntity(e.name, e.description);
      return {
        name: truncated.name,
        description: truncated.description,
        sourceDocEntityIds: Array.isArray(e.sourceEntityIds) ? e.sourceEntityIds : [],
      };
    }).filter((e) => e.name && e.description);

    // Step 2: 归纳关系
    const unifiedEntityNames = unifiedEntities.map((e) => e.name);

    const relationPrompt = `请根据以下统一实体列表和所有分文章关系，归纳生成统一关系。

要求：
- 关系名称不超过4个字
- 关系描述不超过20个字
- source和target必须是统一实体列表中的实体名称
- 合并语义相似的关系
- 以JSON数组格式返回：[{"source": "源实体名", "target": "目标实体名", "name": "关系名", "description": "描述", "sourceRelationIds": ["id1", "id2"]}]

统一实体列表：${JSON.stringify(unifiedEntityNames)}
所有分文章关系：${JSON.stringify(allDocRelations)}`;

    const relationResult = await llmClient.callJSON(relationPrompt, { 
      temperature: 0.3,
      maxTokens: 4000,
    });

    const unifiedRelationsRaw = Array.isArray(relationResult) ? relationResult : [];
    
    // 截断并验证关系
    const truncatedRelations = unifiedRelationsRaw.map((r) => {
      const truncated = truncateRelation(r.name, r.description);
      return {
        source: r.source,
        target: r.target,
        name: truncated.name,
        description: truncated.description,
        sourceDocRelationIds: Array.isArray(r.sourceRelationIds) ? r.sourceRelationIds : [],
      };
    });

    // 过滤无效关系
    const unifiedRelations = filterValidRelations(truncatedRelations, unifiedEntityNames)
      .map((r) => ({
        ...r,
        sourceDocRelationIds: r.sourceDocRelationIds || [],
      }));

    return { entities: unifiedEntities, relations: unifiedRelations };
  }

  /**
   * 保存统一图谱数据（全量替换）
   * @param {Array} unifiedEntities - 统一实体
   * @param {Array} unifiedRelations - 统一关系
   * @param {string} triggeredBy - 触发方式
   */
  async saveUnifiedGraph(unifiedEntities, unifiedRelations, triggeredBy) {
    await prisma.$transaction(async (tx) => {
      // 全量删除现有统一图谱数据（关系先删除，因为外键约束）
      await tx.unifiedRelation.deleteMany({});
      await tx.unifiedEntity.deleteMany({});

      // 创建统一实体并建立 name → id 映射
      const nameToId = new Map();
      for (const entity of unifiedEntities) {
        const created = await tx.unifiedEntity.create({
          data: {
            cleanedName: entity.name,
            description: entity.description,
            sourceDocEntityIds: JSON.stringify(entity.sourceDocEntityIds),
          },
        });
        nameToId.set(entity.name, created.id);
      }

      // 创建统一关系，跳过任何缺少 source/target 的关系
      for (const relation of unifiedRelations) {
        const sourceId = nameToId.get(relation.source);
        const targetId = nameToId.get(relation.target);
        if (!sourceId || !targetId) continue;

        await tx.unifiedRelation.create({
          data: {
            cleanedName: relation.name,
            description: relation.description,
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            sourceDocRelationIds: JSON.stringify(relation.sourceDocRelationIds),
          },
        });
      }

      // 写入 UnificationLog
      await tx.unificationLog.create({
        data: {
          status: 'completed',
          entityCount: unifiedEntities.length,
          relationCount: unifiedRelations.length,
          triggeredBy,
          completedAt: new Date(),
        },
      });
    });
  }

  /**
   * 执行统一归纳
   * 读取所有 DocEntity/DocRelation，通过 LLM 归纳为上层概念
   * @param {string} triggeredBy - 触发方式: 'scheduler' | 'manual'
   * @returns {Promise<{entityCount: number, relationCount: number}>}
   */
  async runUnification(triggeredBy) {
    // 创建初始日志记录
    const log = await prisma.unificationLog.create({
      data: {
        status: 'running',
        triggeredBy,
      },
    });

    try {
      // Step 1: 读取所有分文章图谱数据
      const { entities: allDocEntities, relations: allDocRelations } = 
        await this.loadAllDocGraphData();

      // 如果没有数据，直接返回
      if (allDocEntities.length === 0) {
        await prisma.unificationLog.update({
          where: { id: log.id },
          data: {
            status: 'completed',
            entityCount: 0,
            relationCount: 0,
            completedAt: new Date(),
          },
        });
        return { entityCount: 0, relationCount: 0 };
      }

      // Step 2: 通过 LLM 进行语义归纳
      const { entities: unifiedEntities, relations: unifiedRelations } = 
        await this.unifyWithLLM(allDocEntities, allDocRelations);

      // Step 3: 保存统一图谱（全量替换）
      await this.saveUnifiedGraph(unifiedEntities, unifiedRelations, triggeredBy);

      return {
        entityCount: unifiedEntities.length,
        relationCount: unifiedRelations.length,
      };
    } catch (error) {
      // 记录失败状态
      await prisma.unificationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * 获取最近一次归纳记录
   * @returns {Promise<UnificationLog|null>}
   */
  async getLatestLog() {
    const log = await prisma.unificationLog.findFirst({
      orderBy: {
        startedAt: 'desc',
      },
    });
    return log;
  }
}

module.exports = new UnificationService();
module.exports.UnificationService = UnificationService;
module.exports.truncateEntity = truncateEntity;
module.exports.truncateRelation = truncateRelation;
module.exports.filterValidRelations = filterValidRelations;
module.exports.prisma = prisma;
