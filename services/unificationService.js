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
   * @returns {Promise<{entities: Array, relations: Array, principles: Array}>}
   */
  async loadAllDocGraphData() {
    const docEntities = await prisma.docEntity.findMany();
    const docRelations = await prisma.docRelation.findMany({
      include: {
        sourceEntity: true,
        targetEntity: true,
      },
    });
    const docPrinciples = await prisma.docPrinciple.findMany();

    const entities = docEntities.map((e) => ({
      id: e.id,
      docId: e.docId,
      name: e.cleanedName,
      description: e.description,
      entityType: e.entityType,
      source: e.source,
    }));

    const relations = docRelations.map((r) => ({
      id: r.id,
      docId: r.docId,
      source: r.sourceEntity.cleanedName,
      target: r.targetEntity.cleanedName,
      name: r.cleanedName,
      description: r.description,
      layer: r.layer,
      source_tag: r.source,
    }));

    const principles = docPrinciples.map((p) => ({
      id: p.id,
      docId: p.docId,
      name: p.name,
      description: p.description,
      relatedEntityIds: p.relatedEntityIds,
      source: p.source,
    }));

    return { entities, relations, principles };
  }

  /**
   * 通过 LLM 进行语义归纳合并
   * @param {Array} allDocEntities - 所有分文章实体
   * @param {Array} allDocRelations - 所有分文章关系
   * @param {Array} allDocPrinciples - 所有分文章原则
   * @returns {Promise<{entities: Array, relations: Array, principles: Array}>}
   */
  async unifyWithLLM(allDocEntities, allDocRelations, allDocPrinciples = []) {
    // Step 1: 归纳实体
    const entityPrompt = `你是一个知识图谱归纳专家。请将以下多篇文档的实体进行语义归纳合并，生成上层概念。

要求：
- 语义相似的实体合并为一个上层概念（例如：垂直拍摄、光圈控制、逆光拍摄 → 拍摄手法）
- 上层概念名称不超过6个字
- 上层概念描述不超过20个字，需包含该概念涵盖的具体内容的总结
- 保留无法归纳的独立实体
- entityType（实体类型）：合并后选择最具代表性的类型，取值为 concept/object/process/role/rule/tool/target/data
- source（来源标注）：合并后选择最高置信度的来源，取值为 fact/inferred/pattern（优先级：fact > inferred > pattern）
- 以JSON数组格式返回：[{"name": "概念名", "description": "总结描述", "entityType": "concept", "source": "fact", "sourceEntityIds": ["id1", "id2"]}]

所有分文章实体：
${JSON.stringify(allDocEntities)}`;

    const entityResult = await llmClient.callJSON(entityPrompt, { 
      temperature: 0.3,
      maxTokens: 4000,
    });

    const unifiedEntitiesRaw = Array.isArray(entityResult) ? entityResult : [];
    
    // 有效枚举值
    const validEntityTypes = ['concept', 'object', 'process', 'role', 'rule', 'tool', 'target', 'data'];
    const validSourceTags = ['fact', 'inferred', 'pattern'];

    // 截断并验证实体
    const unifiedEntities = unifiedEntitiesRaw.map((e) => {
      const truncated = truncateEntity(e.name, e.description);
      return {
        name: truncated.name,
        description: truncated.description,
        entityType: validEntityTypes.includes(e.entityType) ? e.entityType : 'concept',
        source: validSourceTags.includes(e.source) ? e.source : 'fact',
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
- layer（关系层级）：合并后保留最具代表性的层级，取值为 how（结构层）或 why（因果层）
- source_tag（来源标注）：合并后选择最高置信度的来源，取值为 fact/inferred/pattern
- 以JSON数组格式返回：[{"source": "源实体名", "target": "目标实体名", "name": "关系名", "description": "描述", "layer": "how", "source_tag": "fact", "sourceRelationIds": ["id1", "id2"]}]

统一实体列表：${JSON.stringify(unifiedEntityNames)}
所有分文章关系：${JSON.stringify(allDocRelations)}`;

    const relationResult = await llmClient.callJSON(relationPrompt, { 
      temperature: 0.3,
      maxTokens: 4000,
    });

    const unifiedRelationsRaw = Array.isArray(relationResult) ? relationResult : [];
    const validLayers = ['how', 'why'];
    
    // 截断并验证关系
    const truncatedRelations = unifiedRelationsRaw.map((r) => {
      const truncated = truncateRelation(r.name, r.description);
      return {
        source: r.source,
        target: r.target,
        name: truncated.name,
        description: truncated.description,
        layer: validLayers.includes(r.layer) ? r.layer : 'how',
        source_tag: validSourceTags.includes(r.source_tag) ? r.source_tag : 'fact',
        sourceDocRelationIds: Array.isArray(r.sourceRelationIds) ? r.sourceRelationIds : [],
      };
    });

    // 过滤无效关系
    const unifiedRelations = filterValidRelations(truncatedRelations, unifiedEntityNames)
      .map((r) => ({
        ...r,
        sourceDocRelationIds: r.sourceDocRelationIds || [],
      }));

    // Step 3: 归纳原则
    const unifiedPrinciples = await this.unifyPrinciples(allDocPrinciples, unifiedEntityNames);

    return { entities: unifiedEntities, relations: unifiedRelations, principles: unifiedPrinciples };
  }

  /**
   * 归纳原则：将所有分文章原则通过 LLM 合并为统一原则
   * @param {Array} allDocPrinciples - 所有分文章原则
   * @param {Array} unifiedEntityNames - 统一实体名称列表
   * @returns {Promise<Array>}
   */
  async unifyPrinciples(allDocPrinciples, unifiedEntityNames) {
    if (!allDocPrinciples || allDocPrinciples.length === 0) {
      return [];
    }

    const validSourceTags = ['fact', 'inferred', 'pattern'];

    const principlePrompt = `你是一个知识图谱归纳专家。请将以下多篇文档的原则/模式进行语义归纳合并。

要求：
- 语义相似的原则合并为一个上层原则
- 原则名称不超过8个字
- 原则描述不超过40个字
- related_entities 应引用统一实体列表中的实体名称
- source（来源标注）：取值为 fact/inferred/pattern
- 以JSON数组格式返回：[{"name": "原则名", "description": "原则描述", "related_entities": ["实体1", "实体2"], "source": "pattern", "sourcePrincipleIds": ["id1", "id2"]}]

统一实体列表：${JSON.stringify(unifiedEntityNames)}
所有分文章原则：${JSON.stringify(allDocPrinciples)}`;

    const principleResult = await llmClient.callJSON(principlePrompt, {
      temperature: 0.3,
      maxTokens: 4000,
    });

    const rawPrinciples = Array.isArray(principleResult) ? principleResult : [];

    const unifiedPrinciples = rawPrinciples.map((p) => ({
      name: typeof p.name === 'string' ? p.name.slice(0, 8) : '',
      description: typeof p.description === 'string' ? p.description.slice(0, 40) : '',
      source: validSourceTags.includes(p.source) ? p.source : 'pattern',
      sourceDocPrincipleIds: Array.isArray(p.sourcePrincipleIds) ? p.sourcePrincipleIds : [],
    })).filter((p) => p.name.length > 0);

    return unifiedPrinciples;
  }

  /**
   * 保存统一图谱数据（全量替换）
   * @param {Array} unifiedEntities - 统一实体
   * @param {Array} unifiedRelations - 统一关系
   * @param {Array} unifiedPrinciples - 统一原则
   * @param {string} triggeredBy - 触发方式
   */
  async saveUnifiedGraph(unifiedEntities, unifiedRelations, unifiedPrinciples = [], triggeredBy) {
    await prisma.$transaction(async (tx) => {
      // 全量删除现有统一图谱数据（关系先删除，因为外键约束）
      await tx.unifiedRelation.deleteMany({});
      await tx.unifiedEntity.deleteMany({});
      await tx.unifiedPrinciple.deleteMany({});

      // 创建统一实体并建立 name → id 映射
      const nameToId = new Map();
      for (const entity of unifiedEntities) {
        const created = await tx.unifiedEntity.create({
          data: {
            cleanedName: entity.name,
            description: entity.description,
            entityType: entity.entityType || 'concept',
            source: entity.source || 'fact',
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
            layer: relation.layer || 'how',
            source: relation.source_tag || 'fact',
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            sourceDocRelationIds: JSON.stringify(relation.sourceDocRelationIds),
          },
        });
      }

      // 创建统一原则
      for (const principle of unifiedPrinciples) {
        await tx.unifiedPrinciple.create({
          data: {
            name: principle.name,
            description: principle.description,
            source: principle.source || 'pattern',
            sourceDocPrincipleIds: JSON.stringify(principle.sourceDocPrincipleIds || []),
          },
        });
      }

      // 写入 UnificationLog
      await tx.unificationLog.create({
        data: {
          status: 'completed',
          entityCount: unifiedEntities.length,
          relationCount: unifiedRelations.length,
          principleCount: unifiedPrinciples.length,
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
      const { entities: allDocEntities, relations: allDocRelations, principles: allDocPrinciples } = 
        await this.loadAllDocGraphData();

      // 如果没有数据，直接返回
      if (allDocEntities.length === 0) {
        await prisma.unificationLog.update({
          where: { id: log.id },
          data: {
            status: 'completed',
            entityCount: 0,
            relationCount: 0,
            principleCount: 0,
            completedAt: new Date(),
          },
        });
        return { entityCount: 0, relationCount: 0, principleCount: 0 };
      }

      // Step 2: 通过 LLM 进行语义归纳
      const { entities: unifiedEntities, relations: unifiedRelations, principles: unifiedPrinciples } = 
        await this.unifyWithLLM(allDocEntities, allDocRelations, allDocPrinciples);

      // Step 3: 保存统一图谱（全量替换）
      await this.saveUnifiedGraph(unifiedEntities, unifiedRelations, unifiedPrinciples, triggeredBy);

      return {
        entityCount: unifiedEntities.length,
        relationCount: unifiedRelations.length,
        principleCount: unifiedPrinciples.length,
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
