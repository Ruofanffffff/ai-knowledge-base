/**
 * Relation Type Store
 * 
 * 关系类型数据库操作模块
 * 提供关系类型的CRUD操作和查询功能
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 创建关系类型
 * @param {Object} relationType - 关系类型定义
 * @returns {Promise<Object>} 创建的关系类型
 */
async function create(relationType) {
  try {
    // 验证必需字段
    const requiredFields = [
      'relationTypeId', 'name', 'displayName', 'domain', 'category',
      'sourceEntityTypes', 'targetEntityTypes'
    ];
    
    for (const field of requiredFields) {
      if (!relationType[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // 确保数组字段被序列化为JSON
    const data = {
      relationTypeId: relationType.relationTypeId,
      name: relationType.name,
      displayName: relationType.displayName,
      description: relationType.description || null,
      domain: relationType.domain,
      category: relationType.category,
      sourceEntityTypes: JSON.stringify(relationType.sourceEntityTypes),
      targetEntityTypes: JSON.stringify(relationType.targetEntityTypes),
      isDirectional: relationType.isDirectional !== undefined ? relationType.isDirectional : true,
      isTemporal: relationType.isTemporal !== undefined ? relationType.isTemporal : false,
      supportsConfidence: relationType.supportsConfidence !== undefined ? relationType.supportsConfidence : true,
      parentType: relationType.parentType || null,
      metadata: relationType.metadata ? JSON.stringify(relationType.metadata) : null,
      version: relationType.version || '1.0.0',
      active: relationType.active !== undefined ? relationType.active : true
    };

    const created = await prisma.relationType.create({ data });
    
    // 反序列化JSON字段
    return deserializeRelationType(created);
  } catch (error) {
    throw new Error(`Failed to create relation type: ${error.message}`);
  }
}

/**
 * 批量创建关系类型
 * @param {Array<Object>} relationTypes - 关系类型定义数组
 * @returns {Promise<Array<Object>>} 创建的关系类型数组
 */
async function createBatch(relationTypes) {
  const results = [];
  const errors = [];

  for (const relationType of relationTypes) {
    try {
      const created = await create(relationType);
      results.push(created);
    } catch (error) {
      errors.push({
        relationTypeId: relationType.relationTypeId,
        error: error.message
      });
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to create ${errors.length} relation types:`, errors);
  }

  return results;
}

/**
 * 根据ID查找关系类型
 * @param {string} relationTypeId - 关系类型ID
 * @returns {Promise<Object|null>} 关系类型或null
 */
async function findById(relationTypeId) {
  try {
    const relationType = await prisma.relationType.findUnique({
      where: { relationTypeId }
    });
    
    return relationType ? deserializeRelationType(relationType) : null;
  } catch (error) {
    throw new Error(`Failed to find relation type: ${error.message}`);
  }
}

/**
 * 查找所有关系类型
 * @param {Object} options - 查询选项
 * @param {boolean} options.activeOnly - 只返回激活的关系类型
 * @returns {Promise<Array<Object>>} 关系类型数组
 */
async function findAll(options = {}) {
  try {
    const where = {};
    
    if (options.activeOnly) {
      where.active = true;
    }

    const relationTypes = await prisma.relationType.findMany({
      where,
      orderBy: [
        { domain: 'asc' },
        { category: 'asc' },
        { name: 'asc' }
      ]
    });
    
    return relationTypes.map(deserializeRelationType);
  } catch (error) {
    throw new Error(`Failed to find all relation types: ${error.message}`);
  }
}

/**
 * 按领域查找关系类型
 * @param {string} domain - 领域名称
 * @param {Object} options - 查询选项
 * @returns {Promise<Array<Object>>} 关系类型数组
 */
async function findByDomain(domain, options = {}) {
  try {
    const where = { domain };
    
    if (options.activeOnly) {
      where.active = true;
    }

    const relationTypes = await prisma.relationType.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });
    
    return relationTypes.map(deserializeRelationType);
  } catch (error) {
    throw new Error(`Failed to find relation types by domain: ${error.message}`);
  }
}

/**
 * 按分类查找关系类型
 * @param {string} category - 分类名称
 * @param {Object} options - 查询选项
 * @returns {Promise<Array<Object>>} 关系类型数组
 */
async function findByCategory(category, options = {}) {
  try {
    const where = { category };
    
    if (options.activeOnly) {
      where.active = true;
    }

    const relationTypes = await prisma.relationType.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    
    return relationTypes.map(deserializeRelationType);
  } catch (error) {
    throw new Error(`Failed to find relation types by category: ${error.message}`);
  }
}

/**
 * 按实体类型查找关系类型
 * @param {string} entityType - 实体类型
 * @param {string} role - 角色：'source' | 'target' | 'both'
 * @param {Object} options - 查询选项
 * @returns {Promise<Array<Object>>} 关系类型数组
 */
async function findByEntityType(entityType, role = 'both', options = {}) {
  try {
    const where = {};
    
    if (options.activeOnly) {
      where.active = true;
    }

    // 获取所有关系类型并在内存中过滤
    // 因为SQLite不支持JSON查询
    const allTypes = await prisma.relationType.findMany({ where });
    
    const filtered = allTypes.filter(rt => {
      const sourceTypes = JSON.parse(rt.sourceEntityTypes);
      const targetTypes = JSON.parse(rt.targetEntityTypes);
      
      if (role === 'source') {
        return sourceTypes.includes(entityType);
      } else if (role === 'target') {
        return targetTypes.includes(entityType);
      } else {
        return sourceTypes.includes(entityType) || targetTypes.includes(entityType);
      }
    });
    
    return filtered.map(deserializeRelationType);
  } catch (error) {
    throw new Error(`Failed to find relation types by entity type: ${error.message}`);
  }
}

/**
 * 更新关系类型
 * @param {string} relationTypeId - 关系类型ID
 * @param {Object} updates - 更新数据
 * @returns {Promise<Object>} 更新后的关系类型
 */
async function update(relationTypeId, updates) {
  try {
    // 准备更新数据
    const data = {};
    
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.displayName !== undefined) data.displayName = updates.displayName;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.domain !== undefined) data.domain = updates.domain;
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.sourceEntityTypes !== undefined) {
      data.sourceEntityTypes = JSON.stringify(updates.sourceEntityTypes);
    }
    if (updates.targetEntityTypes !== undefined) {
      data.targetEntityTypes = JSON.stringify(updates.targetEntityTypes);
    }
    if (updates.isDirectional !== undefined) data.isDirectional = updates.isDirectional;
    if (updates.isTemporal !== undefined) data.isTemporal = updates.isTemporal;
    if (updates.supportsConfidence !== undefined) data.supportsConfidence = updates.supportsConfidence;
    if (updates.parentType !== undefined) data.parentType = updates.parentType;
    if (updates.metadata !== undefined) {
      data.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    }
    if (updates.version !== undefined) data.version = updates.version;
    if (updates.active !== undefined) data.active = updates.active;

    const updated = await prisma.relationType.update({
      where: { relationTypeId },
      data
    });
    
    return deserializeRelationType(updated);
  } catch (error) {
    throw new Error(`Failed to update relation type: ${error.message}`);
  }
}

/**
 * 删除关系类型
 * @param {string} relationTypeId - 关系类型ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteRelationType(relationTypeId) {
  try {
    await prisma.relationType.delete({
      where: { relationTypeId }
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') {
      // Record not found
      return false;
    }
    throw new Error(`Failed to delete relation type: ${error.message}`);
  }
}

/**
 * 获取统计信息
 * @returns {Promise<Object>} 统计信息
 */
async function getStats() {
  try {
    const total = await prisma.relationType.count();
    const active = await prisma.relationType.count({ where: { active: true } });
    
    // 按领域统计
    const allTypes = await prisma.relationType.findMany({
      select: { domain: true, category: true }
    });
    
    const byDomain = {};
    const byCategory = {};
    
    for (const rt of allTypes) {
      byDomain[rt.domain] = (byDomain[rt.domain] || 0) + 1;
      byCategory[rt.category] = (byCategory[rt.category] || 0) + 1;
    }
    
    return {
      total,
      active,
      inactive: total - active,
      byDomain,
      byCategory
    };
  } catch (error) {
    throw new Error(`Failed to get stats: ${error.message}`);
  }
}

/**
 * 反序列化关系类型（将JSON字符串转换为对象）
 * @param {Object} relationType - 数据库中的关系类型
 * @returns {Object} 反序列化后的关系类型
 */
function deserializeRelationType(relationType) {
  return {
    id: relationType.id,
    relationTypeId: relationType.relationTypeId,
    name: relationType.name,
    displayName: relationType.displayName,
    description: relationType.description,
    domain: relationType.domain,
    category: relationType.category,
    sourceEntityTypes: JSON.parse(relationType.sourceEntityTypes),
    targetEntityTypes: JSON.parse(relationType.targetEntityTypes),
    isDirectional: relationType.isDirectional,
    isTemporal: relationType.isTemporal,
    supportsConfidence: relationType.supportsConfidence,
    parentType: relationType.parentType,
    metadata: relationType.metadata ? JSON.parse(relationType.metadata) : null,
    version: relationType.version,
    active: relationType.active,
    createdAt: relationType.createdAt,
    updatedAt: relationType.updatedAt
  };
}

/**
 * 关闭数据库连接
 */
async function disconnect() {
  await prisma.$disconnect();
}

module.exports = {
  create,
  createBatch,
  findById,
  findAll,
  findByDomain,
  findByCategory,
  findByEntityType,
  update,
  delete: deleteRelationType,
  getStats,
  disconnect
};
