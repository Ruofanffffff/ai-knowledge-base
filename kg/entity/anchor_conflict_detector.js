/**
 * Anchor Conflict Detector
 * 
 * 检测锚点冲突和语义不一致。
 * 
 * 核心原则：
 * - 规则驱动：基于规则检测冲突，不使用LLM决策
 * - 多维度检测：时间一致性、数值冲突、状态矛盾
 * - 严重性评估：low/medium/high
 * - 建议输出：auto_merge/review/split
 */

const anchorMetrics = require('./anchor_metrics');

/**
 * 检测锚点冲突
 * 
 * @param {string} anchor - 锚点指纹
 * @param {Array<Object>} group - 同一锚点的实例组 [{instance, schema, anchor}, ...]
 * @returns {Object} 冲突检测结果
 */
function detectAnchorConflict(anchor, group) {
  if (!anchor) {
    throw new Error('[AnchorConflictDetector] anchor is required');
  }

  if (!Array.isArray(group) || group.length === 0) {
    throw new Error('[AnchorConflictDetector] group must be a non-empty array');
  }

  const conflicts = [];

  // 1. 时间策略一致性检查
  const timeConflict = checkTimeConsistency(group);
  if (timeConflict) {
    conflicts.push(timeConflict);
  }

  // 2. 数值字段冲突检查
  const valueConflicts = checkValueConflicts(group);
  conflicts.push(...valueConflicts);

  // 3. 状态字段矛盾检查
  const stateConflicts = checkStateContradictions(group);
  conflicts.push(...stateConflicts);

  // 4. 计算冲突严重性
  const severity = calculateConflictSeverity(conflicts);

  // 5. 生成建议
  const recommendation = generateRecommendation(conflicts, severity);

  // 6. 记录监控指标
  for (const conflict of conflicts) {
    anchorMetrics.recordConflict(conflict.type, conflict.severity || severity);
  }

  return {
    anchor,
    has_conflict: conflicts.length > 0,
    conflicts,
    severity,
    recommendation,
    instance_count: group.length,
    schema_names: group.map(item => item.instance.schema_name)
  };
}

/**
 * 时间一致性检查
 * 检查同一锚点下的实例时间字段是否一致
 * 
 * @param {Array<Object>} group - 实例组
 * @returns {Object|null} 冲突对象或null
 */
function checkTimeConsistency(group) {
  // 提取时间字段
  const timeFieldNames = ['时间', 'Time', 'time', 'Timestamp', 'timestamp', 'Date', 'date', '日期'];
  const timeValues = [];

  for (const item of group) {
    for (const fieldName of timeFieldNames) {
      const value = item.instance.fields[fieldName];
      if (value) {
        timeValues.push({
          value,
          schema: item.instance.schema_name,
          fieldName
        });
        break; // 只取第一个时间字段
      }
    }
  }

  if (timeValues.length < 2) {
    return null; // 少于2个时间值，无法比较
  }

  // 提取月份进行比较
  const months = timeValues.map(tv => ({
    month: extractMonth(tv.value),
    schema: tv.schema,
    original: tv.value
  }));

  const uniqueMonths = new Set(months.map(m => m.month).filter(Boolean));

  if (uniqueMonths.size > 1) {
    return {
      type: 'time_inconsistency',
      message: `时间字段不一致: ${Array.from(uniqueMonths).join(', ')}`,
      severity: 'high',
      details: months.map(m => ({
        schema: m.schema,
        month: m.month,
        original: m.original
      }))
    };
  }

  return null;
}

/**
 * 从时间值提取月份
 * 
 * @param {string} timeValue - 时间值
 * @returns {string|null} 月份 (YYYY-MM) 或 null
 */
function extractMonth(timeValue) {
  if (!timeValue) return null;

  const str = String(timeValue);

  // 匹配 YYYY-MM-DD 或 YYYY-MM 格式
  let match = str.match(/(\d{4})[-/](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  // 匹配中文格式：2025年1月
  match = str.match(/(\d{4})年(\d{1,2})月?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
}

/**
 * 数值冲突检查
 * 检查数值字段是否有显著差异
 * 
 * @param {Array<Object>} group - 实例组
 * @returns {Array<Object>} 冲突列表
 */
function checkValueConflicts(group) {
  const conflicts = [];
  const numericFieldNames = ['数值', 'Value', 'value', '值', 'Amount', 'amount', 'Quantity', 'quantity'];

  for (const fieldName of numericFieldNames) {
    const values = [];

    for (const item of group) {
      const value = item.instance.fields[fieldName];
      if (value !== undefined && value !== null) {
        values.push({
          value,
          schema: item.instance.schema_name,
          confidence: item.instance.confidence
        });
      }
    }

    if (values.length < 2) continue;

    // 转换为数值
    const numbers = values
      .map(v => ({
        number: parseFloat(v.value),
        schema: v.schema,
        confidence: v.confidence,
        original: v.value
      }))
      .filter(v => !isNaN(v.number));

    if (numbers.length < 2) continue;

    // 检查差异
    const numberValues = numbers.map(n => n.number);
    const max = Math.max(...numberValues);
    const min = Math.min(...numberValues);
    const diff = max - min;
    const diffPercent = Math.abs(min) > 0 ? (diff / Math.abs(min)) * 100 : 0;

    if (diffPercent > 10) { // 差异超过10%
      conflicts.push({
        type: 'value_conflict',
        field: fieldName,
        message: `数值字段 ${fieldName} 差异过大: ${diffPercent.toFixed(2)}%`,
        severity: diffPercent > 50 ? 'high' : 'medium',
        details: {
          values: numbers.map(n => ({
            value: n.original,
            number: n.number,
            schema: n.schema,
            confidence: n.confidence
          })),
          min,
          max,
          difference: diff,
          difference_percent: diffPercent.toFixed(2) + '%'
        }
      });
    }
  }

  return conflicts;
}

/**
 * 状态矛盾检查
 * 检查状态/状况字段是否有矛盾
 * 
 * @param {Array<Object>} group - 实例组
 * @returns {Array<Object>} 冲突列表
 */
function checkStateContradictions(group) {
  const conflicts = [];
  const stateFieldNames = ['状态', 'State', 'state', 'Status', 'status', '状况', 'Condition', 'condition'];

  // 矛盾状态对
  const contradictoryStates = [
    ['正常', '异常'],
    ['开启', '关闭'],
    ['启用', '禁用'],
    ['active', 'inactive'],
    ['enabled', 'disabled'],
    ['on', 'off'],
    ['open', 'closed'],
    ['running', 'stopped'],
    ['success', 'failure'],
    ['成功', '失败'],
    ['通过', '未通过']
  ];

  for (const fieldName of stateFieldNames) {
    const states = [];

    for (const item of group) {
      const value = item.instance.fields[fieldName];
      if (value) {
        states.push({
          value: String(value).toLowerCase().trim(),
          schema: item.instance.schema_name,
          original: value
        });
      }
    }

    if (states.length < 2) continue;

    // 检查是否存在矛盾状态
    const stateValues = states.map(s => s.value);

    for (const [state1, state2] of contradictoryStates) {
      const hasState1 = stateValues.some(v => v.includes(state1.toLowerCase()));
      const hasState2 = stateValues.some(v => v.includes(state2.toLowerCase()));

      if (hasState1 && hasState2) {
        conflicts.push({
          type: 'state_contradiction',
          field: fieldName,
          message: `状态字段 ${fieldName} 存在矛盾: ${state1} vs ${state2}`,
          severity: 'high',
          details: {
            contradictory_pair: [state1, state2],
            states: states.map(s => ({
              value: s.original,
              schema: s.schema
            }))
          }
        });
        break; // 找到一个矛盾即可
      }
    }
  }

  return conflicts;
}

/**
 * 计算冲突严重性
 * 
 * @param {Array<Object>} conflicts - 冲突列表
 * @returns {string} 严重性: 'low' | 'medium' | 'high'
 */
function calculateConflictSeverity(conflicts) {
  if (conflicts.length === 0) {
    return 'none';
  }

  // 检查是否有高严重性冲突
  const hasHighSeverity = conflicts.some(c => c.severity === 'high');
  if (hasHighSeverity) {
    return 'high';
  }

  // 检查是否有中等严重性冲突
  const hasMediumSeverity = conflicts.some(c => c.severity === 'medium');
  if (hasMediumSeverity) {
    return 'medium';
  }

  return 'low';
}

/**
 * 生成建议
 * 
 * @param {Array<Object>} conflicts - 冲突列表
 * @param {string} severity - 严重性
 * @returns {string} 建议: 'auto_merge' | 'review' | 'split'
 */
function generateRecommendation(conflicts, severity) {
  if (conflicts.length === 0) {
    return 'auto_merge';
  }

  if (severity === 'high') {
    // 高严重性冲突，建议人工审核或拆分
    const hasStateContradiction = conflicts.some(c => c.type === 'state_contradiction');
    const hasTimeInconsistency = conflicts.some(c => c.type === 'time_inconsistency');

    if (hasStateContradiction || hasTimeInconsistency) {
      return 'split'; // 状态矛盾或时间不一致，建议拆分
    }

    return 'review'; // 其他高严重性冲突，建议人工审核
  }

  if (severity === 'medium') {
    return 'review'; // 中等严重性，建议人工审核
  }

  return 'auto_merge'; // 低严重性，可以自动合并
}

/**
 * 批量检测冲突
 * 
 * @param {Map<string, Array<Object>>} anchorGroups - 锚点分组 (anchor -> group)
 * @returns {Array<Object>} 冲突检测结果列表
 */
function detectAnchorConflictsBatch(anchorGroups) {
  if (!anchorGroups || !(anchorGroups instanceof Map)) {
    throw new Error('[AnchorConflictDetector] anchorGroups must be a Map');
  }

  const results = [];

  for (const [anchor, group] of anchorGroups.entries()) {
    try {
      const result = detectAnchorConflict(anchor, group);
      if (result.has_conflict) {
        results.push(result);
      }
    } catch (error) {
      console.error(`[AnchorConflictDetector] Error detecting conflict for anchor ${anchor}:`, error.message);
    }
  }

  return results;
}

/**
 * 获取冲突统计信息
 * 
 * @param {Array<Object>} conflictResults - 冲突检测结果列表
 * @returns {Object} 统计信息
 */
function getConflictStatistics(conflictResults) {
  const stats = {
    total_conflicts: conflictResults.length,
    by_severity: {
      high: 0,
      medium: 0,
      low: 0
    },
    by_type: {},
    by_recommendation: {
      auto_merge: 0,
      review: 0,
      split: 0
    }
  };

  for (const result of conflictResults) {
    // 按严重性统计
    if (result.severity in stats.by_severity) {
      stats.by_severity[result.severity]++;
    }

    // 按建议统计
    if (result.recommendation in stats.by_recommendation) {
      stats.by_recommendation[result.recommendation]++;
    }

    // 按类型统计
    for (const conflict of result.conflicts) {
      if (!stats.by_type[conflict.type]) {
        stats.by_type[conflict.type] = 0;
      }
      stats.by_type[conflict.type]++;
    }
  }

  return stats;
}

module.exports = {
  detectAnchorConflict,
  checkTimeConsistency,
  checkValueConflicts,
  checkStateContradictions,
  calculateConflictSeverity,
  generateRecommendation,
  detectAnchorConflictsBatch,
  getConflictStatistics,
  extractMonth
};
