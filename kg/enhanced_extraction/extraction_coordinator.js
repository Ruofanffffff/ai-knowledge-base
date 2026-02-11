/**
 * ExtractionCoordinator - Orchestrates the entire extraction process
 * 
 * Responsibilities:
 * - Coordinate algorithm and LLM extraction execution
 * - Manage extraction lifecycle
 * - Handle degradation strategies
 * - Generate status reports
 * 
 * Requirements: 5.3, 6.3, 6.4, 8.6
 */

const AlgorithmExtractor = require('./algorithm_extractor');
const LLMExtractor = require('./llm_extractor');
const ResultFusion = require('./result_fusion');
const ConflictResolver = require('./conflict_resolver');
const QualityValidator = require('./quality_validator');
const ErrorHandler = require('./error_handler');
const Configuration = require('./configuration');
const { PROCESSING_STATUS } = require('./constants');

/**
 * ExtractionCoordinator class
 */
class ExtractionCoordinator {
  constructor(options = {}) {
    // Initialize configuration
    this.config = options.config || new Configuration();
    
    // Initialize components
    this.algorithmExtractor = options.algorithmExtractor || new AlgorithmExtractor();
    this.llmExtractor = options.llmExtractor || new LLMExtractor({
      config: this.config
    });
    this.resultFusion = options.resultFusion || new ResultFusion({
      config: this.config
    });
    this.conflictResolver = options.conflictResolver || new ConflictResolver({
      strategy: this.config.fusion.conflictStrategy
    });
    this.qualityValidator = options.qualityValidator || new QualityValidator({
      config: this.config
    });
    this.errorHandler = options.errorHandler || new ErrorHandler({
      logger: options.logger || console
    });
    
    // Extraction options
    this.enableLLM = this.config.llm.enabled;
    this.enableAlgorithm = this.config.algorithm.enabled;
    this.timeout = this.config.performance.maxProcessingTime || 5000;
    this.language = this.config.language.default || 'auto';
  }

  /**
   * Configure extraction strategy
   * @param {Object} config - Configuration object
   */
  configure(config) {
    if (config.enableLLM !== undefined) {
      this.enableLLM = config.enableLLM;
    }
    if (config.enableAlgorithm !== undefined) {
      this.enableAlgorithm = config.enableAlgorithm;
    }
    if (config.timeout !== undefined) {
      this.timeout = config.timeout;
    }
    if (config.language !== undefined) {
      this.language = config.language;
    }
  }

  /**
   * Execute hybrid extraction
   * Requirement 5.3: Processing time bound
   * Requirement 6.3, 6.4: Multilingual support
   * Requirement 8.6: Status reporting
   * @param {string} documentText - Document text
   * @param {Object} options - Extraction options
   * @returns {Promise<ExtractionResult>}
   */
  async extract(documentText, options = {}) {
    const startTime = Date.now();
    
    // Merge options with instance configuration
    const extractOptions = {
      enableLLM: options.enableLLM !== undefined ? options.enableLLM : this.enableLLM,
      enableAlgorithm: options.enableAlgorithm !== undefined ? options.enableAlgorithm : this.enableAlgorithm,
      timeout: options.timeout || this.timeout,
      language: options.language || this.language
    };

    // Validate input
    if (!documentText || typeof documentText !== 'string') {
      throw new Error('Invalid input: documentText must be a non-empty string');
    }

    if (documentText.trim().length === 0) {
      throw new Error('Invalid input: documentText cannot be empty');
    }

    let algorithmResult = null;
    let llmResult = null;
    let algorithmTime = 0;
    let llmTime = 0;
    let status = PROCESSING_STATUS.SUCCESS;
    let errors = [];

    try {
      // Phase 1: Algorithm Extraction
      if (extractOptions.enableAlgorithm) {
        const algoStart = Date.now();
        try {
          algorithmResult = await this._executeWithTimeout(
            this.algorithmExtractor.extract(documentText),
            extractOptions.timeout,
            'Algorithm extraction timeout'
          );
          algorithmTime = Date.now() - algoStart;
        } catch (error) {
          algorithmTime = Date.now() - algoStart;
          this.errorHandler.logError(error, { phase: 'algorithm_extraction' });
          errors.push({ phase: 'algorithm', error: error.message });
          
          // Algorithm failure is critical if LLM is disabled
          if (!extractOptions.enableLLM) {
            throw error;
          }
          status = PROCESSING_STATUS.PARTIAL_SUCCESS;
        }
      }

      // Phase 2: LLM Extraction
      if (extractOptions.enableLLM) {
        const llmStart = Date.now();
        try {
          const context = algorithmResult ? { algorithmResult } : {};
          llmResult = await this._executeWithTimeout(
            this.llmExtractor.extract(documentText, context),
            extractOptions.timeout - algorithmTime,
            'LLM extraction timeout'
          );
          llmTime = Date.now() - llmStart;
        } catch (error) {
          llmTime = Date.now() - llmStart;
          this.errorHandler.logError(error, { phase: 'llm_extraction' });
          errors.push({ phase: 'llm', error: error.message });
          
          // LLM failure is acceptable if we have algorithm results
          if (algorithmResult) {
            status = PROCESSING_STATUS.PARTIAL_SUCCESS;
          } else if (!extractOptions.enableAlgorithm) {
            throw error;
          } else {
            status = PROCESSING_STATUS.PARTIAL_SUCCESS;
          }
        }
      }

      // Phase 3: Result Fusion
      let fusedResult;
      if (algorithmResult && llmResult) {
        // Both extractors succeeded
        fusedResult = this.resultFusion.fuse(algorithmResult, llmResult);
      } else if (algorithmResult) {
        // Only algorithm succeeded
        fusedResult = algorithmResult;
        status = PROCESSING_STATUS.PARTIAL_SUCCESS;
      } else if (llmResult) {
        // Only LLM succeeded
        fusedResult = llmResult;
        status = PROCESSING_STATUS.PARTIAL_SUCCESS;
      } else {
        // Both failed
        throw new Error('Both algorithm and LLM extraction failed');
      }

      // Phase 4: Quality Validation
      const validationReport = this.qualityValidator.validate(fusedResult);
      const qualityMetrics = this.qualityValidator.calculateMetrics(fusedResult);

      // Phase 5: Build final result
      const processingTime = Date.now() - startTime;
      
      const result = {
        ...fusedResult,
        metadata: {
          ...fusedResult.metadata,
          documentId: options.documentId,
          language: extractOptions.language,
          processingTime,
          algorithmTime,
          llmTime,
          status,
          errors: errors.length > 0 ? errors : undefined
        },
        quality: qualityMetrics,
        validation: validationReport
      };

      return result;

    } catch (error) {
      // Critical failure
      const processingTime = Date.now() - startTime;
      this.errorHandler.logError(error, { 
        phase: 'coordination',
        processingTime,
        algorithmTime,
        llmTime
      });

      return {
        entities: [],
        relations: [],
        metadata: {
          documentId: options.documentId,
          language: extractOptions.language,
          processingTime,
          algorithmTime,
          llmTime,
          status: PROCESSING_STATUS.FAILED,
          error: error.message,
          errors
        },
        quality: {
          entityCompleteness: 0,
          relationCompleteness: 0,
          averageConfidence: 0,
          fieldCompleteness: 0,
          warnings: ['Extraction failed completely']
        }
      };
    }
  }

  /**
   * Execute a promise with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} errorMessage - Error message on timeout
   * @returns {Promise}
   * @private
   */
  async _executeWithTimeout(promise, timeout, errorMessage) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }

  /**
   * Get extraction statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      errorMetrics: this.errorHandler.getMetrics(),
      config: {
        enableLLM: this.enableLLM,
        enableAlgorithm: this.enableAlgorithm,
        timeout: this.timeout,
        language: this.language
      }
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.errorHandler.resetMetrics();
  }
}

module.exports = ExtractionCoordinator;
