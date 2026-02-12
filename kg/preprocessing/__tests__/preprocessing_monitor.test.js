/**
 * Unit Tests for Preprocessing Monitor
 * 
 * Tests logging and monitoring functionality for preprocessing operations
 * 
 * Requirements: 9.1, 9.2, 9.5
 */

const preprocessingMonitor = require('../preprocessing_monitor');

describe('Preprocessing Monitor', () => {
  beforeEach(() => {
    // Reset metrics before each test
    preprocessingMonitor.reset();
  });

  describe('recordIndexGeneration', () => {
    it('should record successful index generation', () => {
      const metric = preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_001',
        duration: 5000,
        fact_count: 15,
        token_count: 1200,
        success: true
      });

      expect(metric).toBeDefined();
      expect(metric.doc_id).toBe('doc_001');
      expect(metric.duration).toBe(5000);
      expect(metric.fact_count).toBe(15);
      expect(metric.success).toBe(true);
      expect(metric.is_within_budget).toBe(true); // 5000ms < 30000ms threshold
    });

    it('should record failed index generation', () => {
      const metric = preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_002',
        duration: 2000,
        fact_count: 0,
        token_count: 0,
        success: false,
        error: 'LLM timeout'
      });

      expect(metric).toBeDefined();
      expect(metric.success).toBe(false);
      expect(metric.error).toBe('LLM timeout');
    });

    it('should flag slow index generation', () => {
      const metric = preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_003',
        duration: 35000, // Exceeds 30s threshold
        fact_count: 20,
        token_count: 2000,
        success: true
      });

      expect(metric.is_within_budget).toBe(false);
    });
  });

  describe('recordCorrection', () => {
    it('should record correction operation', () => {
      const metric = preprocessingMonitor.recordCorrection({
        doc_id: 'doc_001',
        stage: 'field_correction',
        duration: 3000,
        corrections_made: 5,
        items_processed: 10,
        success: true
      });

      expect(metric).toBeDefined();
      expect(metric.stage).toBe('field_correction');
      expect(metric.corrections_made).toBe(5);
      expect(metric.items_processed).toBe(10);
      expect(metric.success).toBe(true);
    });

    it('should record failed correction', () => {
      const metric = preprocessingMonitor.recordCorrection({
        doc_id: 'doc_002',
        stage: 'schema_correction',
        duration: 1000,
        corrections_made: 0,
        items_processed: 5,
        success: false,
        error: 'Validation failed'
      });

      expect(metric.success).toBe(false);
      expect(metric.error).toBe('Validation failed');
    });
  });

  describe('recordValidation', () => {
    it('should record validation operation', () => {
      const metric = preprocessingMonitor.recordValidation({
        doc_id: 'doc_001',
        stage: 'field_extraction',
        duration: 2000,
        items_validated: 20,
        validation_passed: 18,
        validation_failed: 2,
        coverage_rate: 0.9,
        success: true
      });

      expect(metric).toBeDefined();
      expect(metric.stage).toBe('field_extraction');
      expect(metric.items_validated).toBe(20);
      expect(metric.coverage_rate).toBe(0.9);
      expect(metric.success).toBe(true);
    });
  });

  describe('recordPreprocessingLLMCall', () => {
    it('should record successful LLM call', () => {
      const metric = preprocessingMonitor.recordPreprocessingLLMCall({
        doc_id: 'doc_001',
        stage: 'index_generation',
        operation: 'generate_indexed_text',
        duration: 8000,
        success: true,
        timeout: false,
        model: 'qwen-plus',
        tokens: 1500,
        input_tokens: 1000,
        output_tokens: 500
      });

      expect(metric).toBeDefined();
      expect(metric.stage).toBe('index_generation');
      expect(metric.success).toBe(true);
      expect(metric.timeout).toBe(false);
      expect(metric.tokens).toBe(1500);
    });

    it('should record LLM timeout', () => {
      const metric = preprocessingMonitor.recordPreprocessingLLMCall({
        doc_id: 'doc_002',
        stage: 'field_validation',
        operation: 'validate_fields',
        duration: 15000,
        success: false,
        timeout: true
      });

      expect(metric.success).toBe(false);
      expect(metric.timeout).toBe(true);
    });
  });

  describe('recordDecision', () => {
    it('should record preprocessing decision', () => {
      const decision = preprocessingMonitor.recordDecision({
        doc_id: 'doc_001',
        stage: 'field_validation',
        decision: 'supplement_fields',
        reason: 'Coverage rate below threshold',
        confidence: 0.85
      });

      expect(decision).toBeDefined();
      expect(decision.decision).toBe('supplement_fields');
      expect(decision.confidence).toBe(0.85);
    });
  });

  describe('getPreprocessingStats', () => {
    beforeEach(() => {
      // Record some test metrics
      preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_001',
        duration: 5000,
        fact_count: 15,
        token_count: 1200,
        success: true
      });

      preprocessingMonitor.recordCorrection({
        doc_id: 'doc_001',
        stage: 'field_correction',
        duration: 3000,
        corrections_made: 5,
        items_processed: 10,
        success: true
      });

      preprocessingMonitor.recordValidation({
        doc_id: 'doc_001',
        stage: 'field_extraction',
        duration: 2000,
        items_validated: 20,
        validation_passed: 18,
        validation_failed: 2,
        coverage_rate: 0.9,
        success: true
      });

      preprocessingMonitor.recordPreprocessingLLMCall({
        doc_id: 'doc_001',
        stage: 'index_generation',
        operation: 'generate_indexed_text',
        duration: 8000,
        success: true,
        tokens: 1500
      });
    });

    it('should return preprocessing statistics', () => {
      const stats = preprocessingMonitor.getPreprocessingStats();

      expect(stats).toBeDefined();
      expect(stats.index_generation).toBeDefined();
      expect(stats.corrections).toBeDefined();
      expect(stats.validations).toBeDefined();
      expect(stats.llm_calls).toBeDefined();
    });

    it('should calculate index generation stats correctly', () => {
      const stats = preprocessingMonitor.getPreprocessingStats();

      expect(stats.index_generation.count).toBe(1);
      expect(stats.index_generation.success_count).toBe(1);
      expect(stats.index_generation.success_rate).toBe(1);
      expect(stats.index_generation.avg_duration).toBe(5000);
      expect(stats.index_generation.avg_fact_count).toBe(15);
    });

    it('should calculate correction stats by stage', () => {
      const stats = preprocessingMonitor.getPreprocessingStats();

      expect(stats.corrections.total_count).toBe(1);
      expect(stats.corrections.by_stage).toBeDefined();
      expect(stats.corrections.by_stage.field_correction).toBeDefined();
      expect(stats.corrections.by_stage.field_correction.count).toBe(1);
      expect(stats.corrections.by_stage.field_correction.total_corrections).toBe(5);
    });

    it('should calculate validation stats by stage', () => {
      const stats = preprocessingMonitor.getPreprocessingStats();

      expect(stats.validations.total_count).toBe(1);
      expect(stats.validations.by_stage).toBeDefined();
      expect(stats.validations.by_stage.field_extraction).toBeDefined();
      expect(stats.validations.by_stage.field_extraction.avg_coverage_rate).toBe(0.9);
    });

    it('should calculate LLM call stats', () => {
      const stats = preprocessingMonitor.getPreprocessingStats();

      expect(stats.llm_calls.count).toBe(1);
      expect(stats.llm_calls.success_count).toBe(1);
      expect(stats.llm_calls.success_rate).toBe(1);
      expect(stats.llm_calls.total_tokens).toBe(1500);
    });

    it('should filter stats by docId', () => {
      // Add metrics for another document
      preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_002',
        duration: 6000,
        fact_count: 20,
        token_count: 1500,
        success: true
      });

      const stats = preprocessingMonitor.getPreprocessingStats({ docId: 'doc_001' });

      expect(stats.docId).toBe('doc_001');
      expect(stats.index_generation.count).toBe(1);
      expect(stats.index_generation.avg_fact_count).toBe(15); // Only doc_001's facts
    });

    it('should filter stats by time range', async () => {
      // Wait a bit to ensure metrics are old
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const stats = preprocessingMonitor.getPreprocessingStats({ timeRange: 100 }); // 100ms

      // All metrics should be filtered out as they're older than 100ms
      expect(stats.index_generation.count).toBe(0);
      expect(stats.corrections.total_count).toBe(0);
    });
  });

  describe('getDocumentSummary', () => {
    beforeEach(() => {
      // Record metrics for a document
      preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_001',
        duration: 5000,
        fact_count: 15,
        token_count: 1200,
        success: true
      });

      preprocessingMonitor.recordCorrection({
        doc_id: 'doc_001',
        stage: 'field_correction',
        duration: 3000,
        corrections_made: 5,
        items_processed: 10,
        success: true
      });

      preprocessingMonitor.recordCorrection({
        doc_id: 'doc_001',
        stage: 'schema_correction',
        duration: 2000,
        corrections_made: 3,
        items_processed: 8,
        success: true
      });
    });

    it('should return document summary', () => {
      const summary = preprocessingMonitor.getDocumentSummary('doc_001');

      expect(summary).toBeDefined();
      expect(summary.doc_id).toBe('doc_001');
      expect(summary.index_generation).toBeDefined();
      expect(summary.corrections).toBeDefined();
      expect(summary.total_duration).toBe(10000); // 5000 + 3000 + 2000
    });

    it('should include index generation details', () => {
      const summary = preprocessingMonitor.getDocumentSummary('doc_001');

      expect(summary.index_generation.success).toBe(true);
      expect(summary.index_generation.duration).toBe(5000);
      expect(summary.index_generation.fact_count).toBe(15);
    });

    it('should include correction summary', () => {
      const summary = preprocessingMonitor.getDocumentSummary('doc_001');

      expect(summary.corrections.total_count).toBe(2);
      expect(summary.corrections.total_corrections_made).toBe(8); // 5 + 3
      expect(summary.corrections.by_stage).toBeDefined();
    });

    it('should return null for non-existent document', () => {
      const summary = preprocessingMonitor.getDocumentSummary('doc_999');

      expect(summary).toBeNull();
    });
  });

  describe('clearOldMetrics', () => {
    it('should clear old metrics', async () => {
      // Record some metrics
      preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_001',
        duration: 5000,
        fact_count: 15,
        token_count: 1200,
        success: true
      });

      // Wait a bit to ensure metrics are old
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Clear metrics older than 100ms
      const cleared = preprocessingMonitor.clearOldMetrics(100);

      expect(cleared).toBeDefined();
      expect(cleared.indexGeneration).toBeGreaterThan(0);

      // Verify metrics are cleared
      const stats = preprocessingMonitor.getPreprocessingStats();
      expect(stats.index_generation.count).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      // Record some metrics
      preprocessingMonitor.recordIndexGeneration({
        doc_id: 'doc_001',
        duration: 5000,
        fact_count: 15,
        token_count: 1200,
        success: true
      });

      // Reset
      preprocessingMonitor.reset();

      // Verify all metrics are cleared
      const stats = preprocessingMonitor.getPreprocessingStats();
      expect(stats.index_generation.count).toBe(0);
      expect(stats.corrections.total_count).toBe(0);
      expect(stats.validations.total_count).toBe(0);
      expect(stats.llm_calls.count).toBe(0);
    });
  });
});
