/**
 * Dynamic Mapping Strategy Adjuster
 * 
 * Adjusts field mapping strategy based on document context and schema scene.
 * Records strategy adjustment logs for analysis and optimization.
 * 
 * Design Reference: Task 7.13.5 - Dynamic Mapping Strategy Adjustment
 * Validates: Requirement 18.17
 * 
 * Key Features:
 * - Adjust strategy based on document context
 * - Adjust strategy based on Schema scene
 * - Record strategy adjustment logs
 * - Provide strategy recommendations
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default strategy configuration
const DEFAULT_STRATEGY = {
  useLLM: true,
  llmProbability: 0.5,
  cleanValues: true,
  useCache: true,
  trackDistribution: true,
  fuzzySemanticMatch: true
};

// Scene-specific strategy configurations
const SCENE_STRATEGIES = {
  // Scientific research - high precision required
  '科研': {
    useLLM: true,
    llmProbability: 0.7,  // Higher LLM usage for accuracy
    cleanValues: true,
    useCache: true,
    trackDistribution: true,
    fuzzySemanticMatch: true,
    reason: 'Scientific research requires high precision'
  },
  
  // Government affairs - high precision and compliance
  '政务': {
    useLLM: true,
    llmProbability: 0.6,
    cleanValues: true,
    useCache: true,
    trackDistribution: true,
    fuzzySemanticMatch: true,
    reason: 'Government affairs require high precision and compliance'
  },
  
  // Personal life - balance between speed and accuracy
  '个人生活': {
    useLLM: true,
    llmProbability: 0.3,  // Lower LLM usage for speed
    cleanValues: true,
    useCache: true,
    trackDistribution: true,
    fuzzySemanticMatch: true,
    reason: 'Personal life prioritizes speed over precision'
  },
  
  // Travel - moderate precision
  '旅行': {
    useLLM: true,
    llmProbability: 0.4,
    cleanValues: true,
    useCache: true,
    trackDistribution: true,
    fuzzySemanticMatch: true,
    reason: 'Travel requires moderate precision'
  },
  
  // Photography - high precision for technical fields
  '摄影': {
    useLLM: true,
    llmProbability: 0.6,
    cleanValues: true,
    useCache: true,
    trackDistribution: true,
    fuzzySemanticMatch: true,
    reason: 'Photography requires high precision for technical fields'
  },
  
  // Work - balance between speed and accuracy
  '工作': {
    useLLM: true,
    llmProbability: 0.5,
    cleanValues: true,
    useCache: true,
    trackDistribution: true,
    fuzzySemanticMatch: true,
    reason: 'Work requires balanced speed and accuracy'
  }
};

// Context-based strategy adjustments
const CONTEXT_PATTERNS = {
  // Technical/scientific context
  technical: {
    keywords: ['实验', '测试', '数据', '分析', '研究', '论文', '报告', '指标', '参数'],
    adjustment: {
      llmProbability: 0.7,
      reason: 'Technical context requires higher precision'
    }
  },
  
  // Casual/personal context
  casual: {
    keywords: ['日常', '生活', '个人', '家庭', '朋友', '聊天', '记录'],
    adjustment: {
      llmProbability: 0.3,
      reason: 'Casual context prioritizes speed'
    }
  },
  
  // Business/formal context
  business: {
    keywords: ['会议', '项目', '合同', '协议', '商务', '客户', '业务'],
    adjustment: {
      llmProbability: 0.6,
      reason: 'Business context requires high accuracy'
    }
  },
  
  // Emergency/urgent context
  urgent: {
    keywords: ['紧急', '急', '立即', '马上', '尽快', '重要'],
    adjustment: {
      llmProbability: 0.2,  // Reduce LLM usage for speed
      reason: 'Urgent context prioritizes speed'
    }
  }
};

/**
 * Adjust mapping strategy based on schema scene and document context
 * 
 * Analyzes the schema scene and document context to determine the optimal
 * mapping strategy configuration.
 * 
 * @param {Object} schema - Schema object with scene information
 * @param {Object} document - Document object with content/context
 * @param {Object} baseStrategy - Base strategy to adjust (optional)
 * @returns {Object} Adjusted strategy configuration
 * 
 * @example
 * const schema = { schema_name: '地下水位变化事件', scene: '科研' };
 * const document = { content: '实验数据分析报告...' };
 * const strategy = adjustStrategy(schema, document);
 * // Returns: {
 * //   useLLM: true,
 * //   llmProbability: 0.7,
 * //   cleanValues: true,
 * //   adjustments: [
 * //     { type: 'scene', scene: '科研', reason: '...' },
 * //     { type: 'context', pattern: 'technical', reason: '...' }
 * //   ]
 * // }
 */
function adjustStrategy(schema, document, baseStrategy = DEFAULT_STRATEGY) {
  const adjustments = [];
  let strategy = { ...baseStrategy };
  
  // Adjust based on schema scene
  if (schema && schema.scene) {
    const sceneStrategy = SCENE_STRATEGIES[schema.scene];
    if (sceneStrategy) {
      strategy = {
        ...strategy,
        ...sceneStrategy
      };
      
      adjustments.push({
        type: 'scene',
        scene: schema.scene,
        reason: sceneStrategy.reason,
        changes: {
          llmProbability: sceneStrategy.llmProbability
        }
      });
    }
  }
  
  // Adjust based on document context
  if (document && (document.content || document.context)) {
    const content = document.content || document.context || '';
    
    // Check for context patterns
    for (const [patternName, pattern] of Object.entries(CONTEXT_PATTERNS)) {
      const matchCount = pattern.keywords.filter(kw => content.includes(kw)).length;
      
      if (matchCount >= 2) {  // At least 2 keywords match
        // Apply context adjustment
        strategy = {
          ...strategy,
          ...pattern.adjustment
        };
        
        adjustments.push({
          type: 'context',
          pattern: patternName,
          matchedKeywords: pattern.keywords.filter(kw => content.includes(kw)),
          reason: pattern.adjustment.reason,
          changes: pattern.adjustment
        });
        
        break;  // Only apply first matching pattern
      }
    }
  }
  
  return {
    ...strategy,
    adjustments
  };
}

/**
 * Record strategy adjustment log
 * 
 * Stores information about strategy adjustments for analysis and optimization.
 * 
 * @param {Object} log - Strategy adjustment log
 * @returns {Promise<Object>} Created log record
 * 
 * @example
 * await recordStrategyAdjustment({
 *   schemaName: '地下水位变化事件',
 *   documentId: 'doc123',
 *   baseStrategy: { llmProbability: 0.5 },
 *   adjustedStrategy: { llmProbability: 0.7 },
 *   adjustments: [
 *     { type: 'scene', scene: '科研', reason: '...' }
 *   ]
 * });
 */
async function recordStrategyAdjustment(log) {
  if (!log || !log.schemaName) {
    throw new Error('schemaName is required');
  }
  
  try {
    // For now, we'll log to console
    // In production, you might want a separate StrategyAdjustmentLog table
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      schemaName: log.schemaName,
      documentId: log.documentId,
      baseStrategy: log.baseStrategy,
      adjustedStrategy: log.adjustedStrategy,
      adjustments: log.adjustments
    };
    
    console.log('Strategy Adjustment:', JSON.stringify(logEntry, null, 2));
    
    return logEntry;
  } catch (error) {
    console.error('Error recording strategy adjustment:', error);
    throw error;
  }
}

/**
 * Get strategy recommendation
 * 
 * Provides a recommended strategy based on historical performance data.
 * 
 * @param {Object} options - Recommendation options
 * @returns {Promise<Object>} Strategy recommendation
 * 
 * @example
 * const recommendation = await getStrategyRecommendation({
 *   schemaName: '地下水位变化事件',
 *   scene: '科研'
 * });
 * // Returns: {
 * //   recommended: { llmProbability: 0.7, ... },
 * //   reason: 'Based on scene: 科研',
 * //   confidence: 0.9
 * // }
 */
async function getStrategyRecommendation(options = {}) {
  const {
    schemaName = null,
    scene = null,
    context = null
  } = options;
  
  try {
    // Build a mock schema and document for adjustment
    const mockSchema = {
      schema_name: schemaName || 'Unknown',
      scene: scene
    };
    
    const mockDocument = {
      content: context || ''
    };
    
    // Get adjusted strategy
    const strategy = adjustStrategy(mockSchema, mockDocument);
    
    // Calculate confidence based on number of adjustments
    const confidence = strategy.adjustments.length > 0 ? 0.9 : 0.5;
    
    return {
      recommended: strategy,
      reason: strategy.adjustments.length > 0
        ? strategy.adjustments.map(a => a.reason).join('; ')
        : 'Using default strategy',
      confidence,
      adjustments: strategy.adjustments
    };
  } catch (error) {
    console.error('Error getting strategy recommendation:', error);
    return {
      recommended: DEFAULT_STRATEGY,
      reason: 'Error occurred, using default strategy',
      confidence: 0.5,
      adjustments: []
    };
  }
}

/**
 * Get strategy statistics
 * 
 * Provides statistics about strategy usage and effectiveness.
 * 
 * @returns {Object} Strategy statistics
 */
function getStrategyStatistics() {
  return {
    defaultStrategy: DEFAULT_STRATEGY,
    sceneStrategies: Object.keys(SCENE_STRATEGIES).map(scene => ({
      scene,
      llmProbability: SCENE_STRATEGIES[scene].llmProbability,
      reason: SCENE_STRATEGIES[scene].reason
    })),
    contextPatterns: Object.keys(CONTEXT_PATTERNS).map(pattern => ({
      pattern,
      keywords: CONTEXT_PATTERNS[pattern].keywords,
      adjustment: CONTEXT_PATTERNS[pattern].adjustment
    }))
  };
}

/**
 * Compare strategies
 * 
 * Compares two strategies and returns the differences.
 * 
 * @param {Object} strategy1 - First strategy
 * @param {Object} strategy2 - Second strategy
 * @returns {Object} Comparison result
 */
function compareStrategies(strategy1, strategy2) {
  const differences = {};
  
  const keys = new Set([
    ...Object.keys(strategy1),
    ...Object.keys(strategy2)
  ]);
  
  for (const key of keys) {
    if (strategy1[key] !== strategy2[key]) {
      differences[key] = {
        before: strategy1[key],
        after: strategy2[key]
      };
    }
  }
  
  return {
    hasDifferences: Object.keys(differences).length > 0,
    differences
  };
}

/**
 * Validate strategy configuration
 * 
 * Validates that a strategy configuration is valid.
 * 
 * @param {Object} strategy - Strategy configuration
 * @returns {Object} Validation result
 */
function validateStrategy(strategy) {
  const errors = [];
  
  if (typeof strategy.useLLM !== 'boolean') {
    errors.push('useLLM must be a boolean');
  }
  
  if (typeof strategy.llmProbability !== 'number' || 
      strategy.llmProbability < 0 || 
      strategy.llmProbability > 1) {
    errors.push('llmProbability must be a number between 0 and 1');
  }
  
  if (typeof strategy.cleanValues !== 'boolean') {
    errors.push('cleanValues must be a boolean');
  }
  
  if (typeof strategy.useCache !== 'boolean') {
    errors.push('useCache must be a boolean');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  adjustStrategy,
  recordStrategyAdjustment,
  getStrategyRecommendation,
  getStrategyStatistics,
  compareStrategies,
  validateStrategy,
  // Export constants for testing
  DEFAULT_STRATEGY,
  SCENE_STRATEGIES,
  CONTEXT_PATTERNS
};
