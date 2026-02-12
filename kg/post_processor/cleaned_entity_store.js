/**
 * CleanedEntityStore — 图谱字段表的 CRUD 存储层
 * 
 * 封装对 CleanedEntity 和 CleanedRelation 表的操作。
 * Requirements: 13.1, 13.2
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CleanedEntityStore {
  /**
   * 获取所有清洗实体
   * @returns {Promise<Array>} CleanedEntity 列表
   */
  async getAllCleanedEntities() {
    try {
      return await prisma.cleanedEntity.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('[CleanedEntityStore] getAllCleanedEntities failed:', error.message);
      return [];
    }
  }

  /**
   * 获取所有清洗关系
   * @returns {Promise<Array>} CleanedRelation 列表（含 source/target 实体）
   */
  async getAllCleanedRelations() {
    try {
      return await prisma.cleanedRelation.findMany({
        include: { source: true, target: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('[CleanedEntityStore] getAllCleanedRelations failed:', error.message);
      return [];
    }
  }

  /**
   * 创建清洗实体
   * @param {Object} data - { cleanedName, description, sourceEntityIds }
   * @returns {Promise<Object>} 创建的 CleanedEntity
   */
  async createCleanedEntity(data) {
    try {
      return await prisma.cleanedEntity.create({
        data: {
          cleanedName: data.cleanedName,
          description: data.description,
          sourceEntityIds: typeof data.sourceEntityIds === 'string'
            ? data.sourceEntityIds
            : JSON.stringify(data.sourceEntityIds || [])
        }
      });
    } catch (error) {
      console.error('[CleanedEntityStore] createCleanedEntity failed:', error.message);
      throw error;
    }
  }

  /**
   * 更新清洗实体
   * @param {string} id - CleanedEntity ID
   * @param {Object} data - 要更新的字段 { cleanedName?, description?, sourceEntityIds? }
   * @returns {Promise<Object>} 更新后的 CleanedEntity
   */
  async updateCleanedEntity(id, data) {
    try {
      const updateData = {};
      if (data.cleanedName !== undefined) updateData.cleanedName = data.cleanedName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.sourceEntityIds !== undefined) {
        updateData.sourceEntityIds = typeof data.sourceEntityIds === 'string'
          ? data.sourceEntityIds
          : JSON.stringify(data.sourceEntityIds || []);
      }
      return await prisma.cleanedEntity.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      console.error(`[CleanedEntityStore] updateCleanedEntity(${id}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * 创建清洗关系
   * @param {Object} data - { cleanedName, description, sourceEntityId, targetEntityId, sourceRelationIds }
   * @returns {Promise<Object>} 创建的 CleanedRelation
   */
  async createCleanedRelation(data) {
    try {
      return await prisma.cleanedRelation.create({
        data: {
          cleanedName: data.cleanedName,
          description: data.description,
          sourceEntityId: data.sourceEntityId,
          targetEntityId: data.targetEntityId,
          sourceRelationIds: typeof data.sourceRelationIds === 'string'
            ? data.sourceRelationIds
            : JSON.stringify(data.sourceRelationIds || [])
        }
      });
    } catch (error) {
      console.error('[CleanedEntityStore] createCleanedRelation failed:', error.message);
      throw error;
    }
  }

  /**
   * 更新清洗关系
   * @param {string} id - CleanedRelation ID
   * @param {Object} data - 要更新的字段 { cleanedName?, description?, sourceRelationIds? }
   * @returns {Promise<Object>} 更新后的 CleanedRelation
   */
  async updateCleanedRelation(id, data) {
    try {
      const updateData = {};
      if (data.cleanedName !== undefined) updateData.cleanedName = data.cleanedName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.sourceRelationIds !== undefined) {
        updateData.sourceRelationIds = typeof data.sourceRelationIds === 'string'
          ? data.sourceRelationIds
          : JSON.stringify(data.sourceRelationIds || []);
      }
      return await prisma.cleanedRelation.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      console.error(`[CleanedEntityStore] updateCleanedRelation(${id}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * 获取清洗统计信息
   * @returns {Promise<Object>} { totalEntities, totalRelations }
   */
  async getCleanupStats() {
    try {
      const [totalEntities, totalRelations] = await Promise.all([
        prisma.cleanedEntity.count(),
        prisma.cleanedRelation.count()
      ]);
      return { totalEntities, totalRelations };
    } catch (error) {
      console.error('[CleanedEntityStore] getCleanupStats failed:', error.message);
      return { totalEntities: 0, totalRelations: 0 };
    }
  }
}

module.exports = CleanedEntityStore;
