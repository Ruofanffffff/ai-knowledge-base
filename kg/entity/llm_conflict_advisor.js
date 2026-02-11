/**
 * LLM Conflict Advisor
 * 
 * 为锚点冲突提供LLM建议（仅建议，不决策）。
 * 
 * 核心原则：
 * - ❌ LLM不能决定是否合并
 * - ✅ LLM只能建议是否需要人工审核或拆分
 * - ✅ LLM输出必须包含reasoning和confidence
 * - ✅ 所有判断必须基于证据
 */

const { createQwenClient } = require('../utils/qwen_client');
const anchorMetrics = require('./anchor_metrics');

/**
 * LLM冲突建议
 * 
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Array<Object>} group - 实例组 [{instance, schema, anchor}, ...]
 * @param {Object} options - 选项
 * @param {string} options.apiKey - Qwen API key
 * @param {string} options.model - LLM model name
 * @param {number} options.temperature - Temperature (default: 0.2)
 * @param {number} options.maxTokens - Max tokens (default: 400)
 * @returns {Promise<Object>} LLM建议
 */
async function adviseMergeConflict(conflictResult, group, options = {}) {
  const startTime = Date.now();
  let success = false;
  
  try {
    if (!conflictResult) {
      throw new Error('[LLMConflictAdvisor] conflictResult is required');
    }

    if (!Array.isArray(group) || group.length === 0) {
      throw new Error('[LLMConflictAdvisor] group must be a non-empty array');
    }

    // 如果没有冲突，直接返回建议合并
    if (!conflictResult.has_conflict) {
      success = true;
      return {
        suggest_split: false,
        confidence: 1.0,
        reason: '无冲突，建议合并',
        llm_advisory: false
      };
    }

    // 构建LLM prompt
    const prompt = buildConflictAdvisoryPrompt(conflictResult, group);

    // 调用LLM
    const apiKey = options.apiKey || process.env.QWEN_API_KEY;
    
    if (!apiKey) {
      console.warn('[LLMConflictAdvisor] No API key provided, returning default recommendation');
      success = true;
      return {
        suggest_split: conflictResult.severity === 'high',
        confidence: 0.5,
        reason: 'LLM不可用，基于规则建议',
        llm_advisory: false
      };
    }

    const llmClient = createQwenClient(apiKey, {
      model: options.model || 'qwen-turbo'
    });

    const response = await llmClient.callJSON(prompt, {
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 400,
      systemPrompt: '你是一个知识图谱校正助手。'
    });

    // 验证响应格式
    validateLLMResponse(response);

    success = true;
    return {
      suggest_split: response.suggest_split || false,
      confidence: response.confidence || 0,
      reason: response.reason || '',
      llm_advisory: true,
      _meta: response._meta
    };
  } catch (error) {
    success = false;
    console.error('[LLMConflictAdvisor] LLM call failed:', error.message);
    
    // LLM失败时，降级到规则建议
    return {
      suggest_split: conflictResult.severity === 'high',
      confidence: 0.5,
      reason: `LLM调用失败: ${error.message}，基于规则建议`,
      llm_advisory: false,
      error: error.message
    };
  } finally {
    // 记录监控指标
    const duration = Date.now() - startTime;
    anchorMetrics.recordLLMCall(duration, success);
  }
}

/**
 * 构建LLM Prompt
 * 
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Array<Object>} group - 实例组
 * @returns {string} Prompt文本
 */
function buildConflictAdvisoryPrompt(conflictResult, group) {
  // 格式化实例信息
  const instancesText = group.map((item, i) => {
    const fields = Object.entries(item.instance.fields)
      .map(([key, value]) => `  - ${key}: ${value}`)
      .join('\n');

    return `Schema ${i + 1}: ${item.instance.schema_name}
置信度: ${item.instance.confidence}
字段:
${fields}
支撑CKB: ${item.instance.ckb_ids.join(', ')}`;
  }).join('\n\n');

  // 格式化冲突信息
  const conflictsText = conflictResult.conflicts.map((c, i) => {
    let details = '';
    
    if (c.details) {
      if (c.type === 'time_inconsistency') {
        details = c.details.map(d => `  - ${d.schema}: ${d.original} (月份: ${d.month})`).join('\n');
      } else if (c.type === 'value_conflict') {
        details = c.details.values.map(v => `  - ${v.schema}: ${v.value} (置信度: ${v.confidence})`).join('\n');
      } else if (c.type === 'state_contradiction') {
        details = c.details.states.map(s => `  - ${s.schema}: ${s.value}`).join('\n');
      }
    }

    return `冲突 ${i + 1}:
类型: ${c.type}
描述: ${c.message}
严重性: ${c.severity}
${details ? '详细信息:\n' + details : ''}`;
  }).join('\n\n');

  return `你是一个知识图谱校正助手。

已通过规则系统检测到以下Schema实例具有相同的锚点指纹，但存在字段冲突。
请判断这些Schema实例是否应该合并为同一实体，还是需要拆分。

⚠️ 重要约束:
- 你不能新建或删除实体
- 你只能给出"建议是否拆分"及理由
- 所有判断必须基于证据
- 如果不确定，建议人工审核（suggest_split: false, confidence: 0.5）

锚点指纹: ${conflictResult.anchor}

Schema实例列表:
${instancesText}

检测到的冲突:
${conflictsText}

任务:
1. 判断这些冲突是否严重到需要拆分实体
2. 如果冲突可以通过字段合并解决，建议合并（suggest_split: false）
3. 如果冲突表明是不同实体，建议拆分（suggest_split: true）
4. 提供清晰的理由，引用具体证据

输出 JSON 格式:
{
  "suggest_split": true/false,
  "confidence": 0.0-1.0,
  "reason": "详细说明判断理由，引用具体证据"
}`;
}

/**
 * 验证LLM响应格式
 * 
 * @param {Object} response - LLM响应
 * @throws {Error} 如果响应格式无效
 */
function validateLLMResponse(response) {
  if (typeof response.suggest_split !== 'boolean') {
    throw new Error('LLM response missing or invalid "suggest_split" field');
  }

  if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
    throw new Error('LLM response missing or invalid "confidence" field (must be 0-1)');
  }

  if (typeof response.reason !== 'string' || response.reason.trim().length === 0) {
    throw new Error('LLM response missing or invalid "reason" field');
  }
}

/**
 * 批量LLM建议
 * 
 * @param {Array<Object>} conflictResults - 冲突检测结果列表
 * @param {Map<string, Array<Object>>} anchorGroups - 锚点分组
 * @param {Object} options - 选项
 * @returns {Promise<Array<Object>>} LLM建议列表
 */
async function adviseMergeConflictsBatch(conflictResults, anchorGroups, options = {}) {
  if (!Array.isArray(conflictResults)) {
    throw new Error('[LLMConflictAdvisor] conflictResults must be an array');
  }

  if (!anchorGroups || !(anchorGroups instanceof Map)) {
    throw new Error('[LLMConflictAdvisor] anchorGroups must be a Map');
  }

  const results = [];

  for (const conflictResult of conflictResults) {
    try {
      const group = anchorGroups.get(conflictResult.anchor);

      if (!group) {
        console.warn(`[LLMConflictAdvisor] No group found for anchor: ${conflictResult.anchor}`);
        continue;
      }

      const advisory = await adviseMergeConflict(conflictResult, group, options);
      
      results.push({
        anchor: conflictResult.anchor,
        conflict_result: conflictResult,
        advisory
      });
    } catch (error) {
      console.error(`[LLMConflictAdvisor] Error processing anchor ${conflictResult.anchor}:`, error.message);
    }
  }

  return results;
}

/**
 * 获取LLM建议统计信息
 * 
 * @param {Array<Object>} advisories - LLM建议列表
 * @returns {Object} 统计信息
 */
function getAdvisoryStatistics(advisories) {
  const stats = {
    total_advisories: advisories.length,
    suggest_split: 0,
    suggest_merge: 0,
    avg_confidence: 0,
    llm_used: 0,
    llm_failed: 0
  };

  let totalConfidence = 0;

  for (const advisory of advisories) {
    if (advisory.advisory.suggest_split) {
      stats.suggest_split++;
    } else {
      stats.suggest_merge++;
    }

    totalConfidence += advisory.advisory.confidence;

    if (advisory.advisory.llm_advisory) {
      stats.llm_used++;
    }

    if (advisory.advisory.error) {
      stats.llm_failed++;
    }
  }

  if (advisories.length > 0) {
    stats.avg_confidence = totalConfidence / advisories.length;
  }

  return stats;
}

module.exports = {
  adviseMergeConflict,
  buildConflictAdvisoryPrompt,
  validateLLMResponse,
  adviseMergeConflictsBatch,
  getAdvisoryStatistics
};
