/**
 * LLM Extractor for Enhanced Entity Extraction
 * 
 * Integrates PromptBuilder, LLMClient, and ResultParser to perform
 * semantic entity and relation extraction using LLM.
 */

const PromptBuilder = require('./prompt_builder');
const { createLLMClient } = require('./llm_client');
const { createCacheWrapper } = require('./llm_cache_wrapper');
const ResultParser = require('./result_parser');
const { createExtractionResult } = require('./types');

class LLMExtractor {
  constructor(options = {}) {
    this.config = {
      language: options.language || 'zh',
      enableCache: options.enableCache !== false,
      batchSize: options.batchSize || 5,
      timeout: options.timeout || 30000,
      enabled: options.config?.llm?.enabled !== false,  // Pass enabled flag
      ...options
    };

    // Initialize components
    this.promptBuilder = new PromptBuilder({
      language: this.config.language,
      includeExamples: this.config.includeExamples !== false
    });

    this.parser = new ResultParser({
      strictMode: this.config.strictMode || false
    });

    // Initialize LLM client with cache wrapper
    const llmClientConfig = {
      ...this.config,
      enabled: this.config.enabled,  // Explicitly pass enabled flag
      ...(options.config?.llm || {})  // Merge LLM config from Configuration
    };
    this.client = createLLMClient(llmClientConfig);
    
    // Initialize cache if enabled
    if (this.config.enableCache) {
      this.cache = createCacheWrapper(this.config);
    } else {
      this.cache = null;
    }
  }

  /**
   * Extract entities and relations from a single document
   * @param {string} text - Document text
   * @param {Object} context - Context information (e.g., algorithm results)
   * @returns {Promise<Object>} Extraction result
   */
  async extract(text, context = {}) {
    const startTime = Date.now();

    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return this._createEmptyResult('Empty or invalid input text');
      }

      // Build entity extraction prompt
      const entityPrompt = this.promptBuilder.buildEntityExtractionPrompt(text, {
        language: context.language || this.config.language,
        algorithmResults: context.algorithmResults || []
      });

      // Call LLM for entity extraction (with caching if enabled)
      let entityResponse;
      if (this.cache) {
        const cached = this.cache.get(entityPrompt, { temperature: this.config.temperature || 0.3 });
        if (cached) {
          entityResponse = cached;
        } else {
          entityResponse = await this.client.call(entityPrompt, {
            temperature: this.config.temperature || 0.3,
            maxTokens: this.config.maxTokens || 2000
          });
          this.cache.set(entityPrompt, { temperature: this.config.temperature || 0.3 }, entityResponse);
        }
      } else {
        entityResponse = await this.client.call(entityPrompt, {
          temperature: this.config.temperature || 0.3,
          maxTokens: this.config.maxTokens || 2000
        });
      }

      // Parse entities
      const entities = this.parser.parseEntities(entityResponse.content);

      // Build relation extraction prompt
      const relationPrompt = this.promptBuilder.buildRelationExtractionPrompt(entities, text);

      // Call LLM for relation extraction (with caching if enabled)
      let relationResponse;
      if (this.cache) {
        const cached = this.cache.get(relationPrompt, { temperature: this.config.temperature || 0.3 });
        if (cached) {
          relationResponse = cached;
        } else {
          relationResponse = await this.client.call(relationPrompt, {
            temperature: this.config.temperature || 0.3,
            maxTokens: this.config.maxTokens || 1000
          });
          this.cache.set(relationPrompt, { temperature: this.config.temperature || 0.3 }, relationResponse);
        }
      } else {
        relationResponse = await this.client.call(relationPrompt, {
          temperature: this.config.temperature || 0.3,
          maxTokens: this.config.maxTokens || 1000
        });
      }

      // Parse relations
      const relations = this.parser.parseRelations(relationResponse.content);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Calculate total tokens and cost
      const totalTokens = (entityResponse.tokens || 0) + (relationResponse.tokens || 0);
      const totalInputTokens = (entityResponse.inputTokens || 0) + (relationResponse.inputTokens || 0);
      const totalOutputTokens = (entityResponse.outputTokens || 0) + (relationResponse.outputTokens || 0);
      
      // Estimate cost (rough estimate for Qwen)
      // Input: ~$0.0005 per 1K tokens, Output: ~$0.002 per 1K tokens
      const estimatedCost = (totalInputTokens / 1000 * 0.0005) + (totalOutputTokens / 1000 * 0.002);

      // Create result
      return createExtractionResult({
        entities,
        relations,
        metadata: {
          language: context.language || this.config.language,
          llmTime: processingTime,
          tokensUsed: totalTokens,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cost: estimatedCost,
          llmModel: entityResponse.model || this.config.model || 'unknown',
          status: 'success'
        }
      });
    } catch (error) {
      // Handle errors gracefully - return empty result with error info
      return this._handleError(error, Date.now() - startTime);
    }
  }

  /**
   * Extract entities and relations from multiple documents in batch
   * @param {Array<string>} texts - Array of document texts
   * @param {Object} context - Shared context for all documents
   * @returns {Promise<Array<Object>>} Array of extraction results
   */
  async batchExtract(texts, context = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const results = [];
    const batchSize = this.config.batchSize;

    // Process in batches to avoid overwhelming the LLM
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(text => this.extract(text, context));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Create an empty result for error cases
   * @private
   */
  _createEmptyResult(reason) {
    return createExtractionResult({
      entities: [],
      relations: [],
      metadata: {
        status: 'failed',
        error: reason,
        llmTime: 0,
        tokensUsed: 0,
        cost: 0
      }
    });
  }

  /**
   * Handle extraction errors gracefully
   * @private
   */
  _handleError(error, processingTime) {
    console.error('[LLMExtractor] Extraction error:', error.message);

    return createExtractionResult({
      entities: [],
      relations: [],
      metadata: {
        status: 'failed',
        error: error.message,
        llmTime: processingTime,
        tokensUsed: 0,
        cost: 0
      }
    });
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update prompt builder language if changed
    if (newConfig.language) {
      this.promptBuilder.setLanguage(newConfig.language);
    }
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = LLMExtractor;
