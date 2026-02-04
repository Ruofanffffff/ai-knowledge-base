/**
 * Strategy Selector
 * 
 * Selects extraction strategy based on domain and configuration
 * Performance requirement: < 5ms per selection
 */

const { 
  DEFAULT_STRATEGIES, 
  PROMPT_BUILDERS, 
  STRATEGY_CONFIG,
  SUPPORTED_STRATEGIES 
} = require('./extraction_config');

/**
 * Select extraction strategy based on domain and options
 * @param {string} domain - Detected domain
 * @param {Object} options - User options
 * @param {Object} config - System configuration (optional, uses defaults if not provided)
 * @returns {Object} Strategy selection result
 */
function selectStrategy(domain, options = {}, config = {}) {
  const startTime = Date.now();
  
  try {
    // Use provided config or defaults
    const strategies = config.defaultStrategies || DEFAULT_STRATEGIES;
    const promptBuilders = config.promptBuilders || PROMPT_BUILDERS;
    const strategyConfigs = config.strategyConfig || STRATEGY_CONFIG;
    
    // Check for strategy override in options
    if (options.strategy) {
      // Validate strategy
      if (!SUPPORTED_STRATEGIES.includes(options.strategy)) {
        throw new Error(`Invalid strategy: ${options.strategy}. Supported strategies: ${SUPPORTED_STRATEGIES.join(', ')}`);
      }
      
      const strategyConfig = strategyConfigs[options.strategy];
      const promptBuilder = promptBuilders[domain] || 'buildFieldExtractionPrompt';
      
      return {
        strategy: options.strategy,
        promptBuilder,
        useLLM: strategyConfig.useLLM,
        useRules: strategyConfig.useRules,
        useNER: strategyConfig.useNER,
        reason: `User override: ${options.strategy}`,
        config: strategyConfig,
        executionTime: Date.now() - startTime
      };
    }
    
    // Get default strategy for domain
    const strategy = getDefaultStrategy(domain, strategies);
    const strategyConfig = strategyConfigs[strategy];
    const promptBuilder = promptBuilders[domain] || 'buildFieldExtractionPrompt';
    
    return {
      strategy,
      promptBuilder,
      useLLM: strategyConfig.useLLM,
      useRules: strategyConfig.useRules,
      useNER: strategyConfig.useNER,
      reason: `Default strategy for ${domain} domain`,
      config: strategyConfig,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    // Record error
    const performanceMonitor = require('../utils/performance_monitor');
    performanceMonitor.recordError({
      type: 'strategy_selection_error',
      module: 'strategy_selector',
      operation: 'selectStrategy',
      message: error.message,
      domain: domain,
      options: options,
      stack: error.stack
    });
    
    // Re-throw error for invalid strategy (user error)
    if (error.message.includes('Invalid strategy')) {
      throw error;
    }
    
    // Return safe default on other errors
    return {
      strategy: 'rule-first',
      promptBuilder: 'buildFieldExtractionPrompt',
      useLLM: true,
      useRules: true,
      useNER: true,
      reason: 'Error during selection, using safe default',
      config: STRATEGY_CONFIG['rule-first'],
      executionTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Get default strategy for domain
 * @param {string} domain - Domain name
 * @param {Object} strategies - Strategy configuration (optional)
 * @returns {string} Default strategy name
 */
function getDefaultStrategy(domain, strategies = null) {
  const strategyMap = strategies || DEFAULT_STRATEGIES;
  return strategyMap[domain] || 'rule-first';
}

/**
 * Validate strategy name
 * @param {string} strategy - Strategy name to validate
 * @returns {boolean} Whether strategy is valid
 */
function isValidStrategy(strategy) {
  return SUPPORTED_STRATEGIES.includes(strategy);
}

/**
 * Get strategy configuration
 * @param {string} strategy - Strategy name
 * @returns {Object} Strategy configuration
 */
function getStrategyConfig(strategy) {
  if (!isValidStrategy(strategy)) {
    throw new Error(`Invalid strategy: ${strategy}`);
  }
  return STRATEGY_CONFIG[strategy];
}

/**
 * Get prompt builder for domain
 * @param {string} domain - Domain name
 * @returns {string} Prompt builder function name
 */
function getPromptBuilder(domain) {
  return PROMPT_BUILDERS[domain] || 'buildFieldExtractionPrompt';
}

/**
 * Get all available strategies
 * @returns {Array<string>} List of supported strategies
 */
function getAvailableStrategies() {
  return [...SUPPORTED_STRATEGIES];
}

/**
 * Get strategy description
 * @param {string} strategy - Strategy name
 * @returns {string} Human-readable description
 */
function getStrategyDescription(strategy) {
  const descriptions = {
    'rule-first': 'Rule+NER extraction first, LLM fallback if insufficient fields',
    'llm-first': 'LLM extraction first, Rule+NER fallback if LLM fails',
    'semantic-only': 'LLM semantic extraction only (no rule-based methods)',
    'hybrid': 'Rule+NER and LLM extraction in parallel, merge results',
    'universal': 'Universal extractor (tokenization + keyword extraction + structured patterns)'
  };
  
  return descriptions[strategy] || 'Unknown strategy';
}

module.exports = {
  selectStrategy,
  getDefaultStrategy,
  isValidStrategy,
  getStrategyConfig,
  getPromptBuilder,
  getAvailableStrategies,
  getStrategyDescription
};
