/**
 * parentIdValidator - 数据一致性验证工具
 *
 * 可复用的 parentId 验证逻辑，用于：
 * 1. IntentAggregationService 中的聚合操作
 * 2. 任何允许设置 parentId 的 API 路由
 *
 * 验证规则：
 * - parentId 引用的知识体必须存在 (Req 1.7, 9.5)
 * - parentId 引用的知识体 bodyType 必须为 "intent" (Req 9.5)
 * - 设置 parentId 后层级深度不超过 2 层 (Req 9.1, 9.2)
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5, 1.7
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * 验证 parentId 设置是否合法
 *
 * @param {string} parentId - 要设置的父知识体 ID
 * @param {string} [childId] - 当前知识体 ID（可选，用于防止自引用）
 * @returns {Promise<{valid: boolean, error: string|null, parentBody: object|null}>}
 */
async function validateParentId(parentId, childId = null) {
  // 1. Check that the referenced parent body exists (Req 1.7)
  const parentBody = await prisma.knowledgeBody.findUnique({
    where: { id: parentId },
    include: { parent: true },
  });

  if (!parentBody) {
    return {
      valid: false,
      error: `parentId 引用的知识体不存在: ${parentId}`,
      parentBody: null,
    };
  }

  // 2. Check that the referenced body has bodyType="intent" (Req 9.5)
  if (parentBody.bodyType !== 'intent') {
    return {
      valid: false,
      error: `parentId 引用的知识体 bodyType 必须为 "intent"，当前为 "${parentBody.bodyType}"`,
      parentBody: null,
    };
  }

  // 3. Check hierarchy depth won't exceed 2 levels (Req 9.1, 9.2)
  // The parent itself must be a top-level node (parentId=null)
  // to ensure max depth of 2: intent → topic
  if (parentBody.parentId !== null) {
    return {
      valid: false,
      error: '设置此 parentId 将创建超过两层的层级结构，已拒绝操作',
      parentBody: null,
    };
  }

  // 4. Prevent self-reference
  if (childId && childId === parentId) {
    return {
      valid: false,
      error: '知识体不能将自身设为父节点',
      parentBody: null,
    };
  }

  return { valid: true, error: null, parentBody };
}

/**
 * 批量验证子知识体 ID 列表，过滤出可以合法挂载到指定父节点下的子节点
 *
 * @param {string} parentId - 父知识体 ID
 * @param {string[]} childBodyIds - 候选子知识体 ID 列表
 * @returns {Promise<{validChildIds: string[], skipped: Array<{id: string, reason: string}>}>}
 */
async function validateChildBodies(parentId, childBodyIds) {
  const childBodies = await prisma.knowledgeBody.findMany({
    where: { id: { in: childBodyIds } },
  });

  const validChildIds = [];
  const skipped = [];

  for (const child of childBodies) {
    // Skip if child already has a parent (single parent constraint, Req 9.3)
    if (child.parentId) {
      skipped.push({ id: child.id, reason: `已有父节点 ${child.parentId}` });
      continue;
    }
    // Skip if child is an intent body (max 2 levels: intent → topic, Req 9.1)
    if (child.bodyType === 'intent') {
      skipped.push({ id: child.id, reason: 'intent 类型知识体不能作为子节点' });
      continue;
    }
    // Skip self-reference
    if (child.id === parentId) {
      skipped.push({ id: child.id, reason: '不能将自身设为子节点' });
      continue;
    }
    validChildIds.push(child.id);
  }

  return { validChildIds, skipped };
}

/**
 * Express 中间件：验证请求体中的 parentId 字段
 * 用于 PUT/PATCH 路由中设置 parentId 的场景
 *
 * 当请求体包含 parentId 时，验证其合法性；
 * parentId 为 null 时跳过验证（表示解除父子关系）。
 *
 * @returns {Function} Express middleware (req, res, next)
 */
function validateParentIdMiddleware() {
  return async (req, res, next) => {
    const { parentId } = req.body;

    // Skip validation if parentId is not in the request body or is null (unlinking)
    if (parentId === undefined || parentId === null) {
      return next();
    }

    try {
      const childId = req.params.id || null;
      const result = await validateParentId(parentId, childId);

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      // Attach validated parent body to request for downstream use
      req.validatedParentBody = result.parentBody;
      next();
    } catch (error) {
      console.error('[parentIdValidator] Validation error:', error);
      return res.status(500).json({
        success: false,
        error: '验证 parentId 时发生内部错误',
      });
    }
  };
}

module.exports = {
  validateParentId,
  validateChildBodies,
  validateParentIdMiddleware,
};
