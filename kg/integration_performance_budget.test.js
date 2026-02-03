/**
 * Integration Tests for Performance Monitoring & Token Budget Management
 * 
 * Tests the complete integration of performance monitoring and token budget
 * management across all KG processing modules.
 */

const performanceMonitor = require('./utils/performance_monitor');
const tokenBudgetManager = require('./utils/token_budget_manager');

describe('Performance & Budget Integration Tests', () => {
  beforeEach(() => {
    // Reset state before each test
    performanceMonitor.reset();
    tokenBudgetManager.reset();
  });

  describe('Performance Monitoring Integration', () => {
    test('should record local processing metrics', () => {
      // Simulate field extraction
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        doc_id: 'doc_001',
        extract_time: 150,
        metadata: { method: 'field_extraction', fields_count: 5 }
      });

      const stats = performanceMonitor.getStats();
      
      expect(stats.local_processing.count).toBe(1);
      expect(stats.local_processing.avg_extract_time).toBe(150);
    });

    test('should record LLM call metrics', () => {
      // Simulate LLM call
      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'enhance_name',
        duration: 5000,
        success: true,
        tokens: 250,
        ckb_id: 'ckb_001',
        doc_id: 'doc_001'
      });

      const stats = performanceMonitor.getStats();
      
      expect(stats.llm_calls.count).toBe(1);
      expect(stats.llm_calls.success_count).toBe(1);
      expect(stats.llm_calls.avg_duration).toBe(5000);
    });

    test('should record document processing metrics', () => {
      // Simulate document processing
      performanceMonitor.recordDocumentProcessing({
        doc_id: 'doc_001',
        total_time: 25000,
        ckb_count: 10,
        entity_count: 15,
        relation_count: 20,
        success: true
      });

      const stats = performanceMonitor.getStats();
      
      expect(stats.document_processing.count).toBe(1);
      expect(stats.document_processing.success_count).toBe(1);
      expect(stats.document_processing.avg_total_time).toBe(25000);
    });

    test('should calculate health score', () => {
      // Record some operations
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        extract_time: 200
      });

      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'enhance_name',
        duration: 6000,
        success: true
      });

      const stats = performanceMonitor.getStats();
      
      expect(stats.health).toBeDefined();
      expect(stats.health.score).toBeGreaterThan(0);
      expect(stats.health.score).toBeLessThanOrEqual(100);
    });

    test('should track errors', () => {
      // Record an error
      performanceMonitor.recordError({
        type: 'extraction_error',
        module: 'field_extractor',
        operation: 'extractFields',
        message: 'Test error',
        ckb_id: 'ckb_001'
      });

      const stats = performanceMonitor.getStats();
      
      expect(stats.errors.count).toBe(1);
      expect(stats.errors.by_type.extraction_error).toBeDefined();
      expect(stats.errors.by_type.extraction_error.count).toBe(1);
    });
  });

  describe('Token Budget Management Integration', () => {
    test('should track token usage', async () => {
      // Record token usage
      await tokenBudgetManager.recordUsage({
        module: 'entity_builder',
        operation: 'enhance_name',
        tokens: 250,
        ckb_id: 'ckb_001',
        doc_id: 'doc_001',
        model_name: 'qwen'
      });

      const status = tokenBudgetManager.getBudgetStatus();
      
      expect(status.daily.usage).toBe(250);
      expect(status.daily.remaining).toBe(100000 - 250);
      expect(status.emergencyMode).toBe(false);
    });

    test('should trigger warning at 80% usage', async () => {
      const alerts = [];
      tokenBudgetManager.onAlert((alert) => {
        alerts.push(alert);
      });

      // Use 80% of budget
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 80000,
        model_name: 'qwen'
      });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('budget_warning');
    });

    test('should activate emergency mode at 100% usage', async () => {
      const alerts = [];
      tokenBudgetManager.onAlert((alert) => {
        alerts.push(alert);
      });

      // Use 100% of budget
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 100000,
        model_name: 'qwen'
      });

      const status = tokenBudgetManager.getBudgetStatus();
      
      expect(status.emergencyMode).toBe(true);
      expect(status.llmParticipationRate).toBe(0.2); // Emergency rate
      expect(alerts.some(a => a.type === 'budget_exceeded')).toBe(true);
    });

    test('should check document budget', () => {
      const check = tokenBudgetManager.checkDocumentBudget('doc_001', 3000);
      
      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(5000 - 3000);
    });

    test('should reject document exceeding budget', () => {
      const check = tokenBudgetManager.checkDocumentBudget('doc_001', 6000);
      
      expect(check.allowed).toBe(false);
      expect(check.exceeded).toBe(1000);
    });

    test('should adjust LLM participation rate in emergency mode', async () => {
      // Trigger emergency mode
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 100000,
        model_name: 'qwen'
      });

      const status = tokenBudgetManager.getBudgetStatus();
      
      expect(status.llmParticipationRate).toBe(0.2);
      expect(status.emergencyMode).toBe(true);
    });
  });

  describe('End-to-End Integration', () => {
    test('should track complete document processing workflow', async () => {
      const docId = 'doc_test_001';
      const ckbId = 'ckb_test_001';

      // 1. Start document processing
      const docStartTime = Date.now();

      // 2. Field extraction
      performanceMonitor.recordLocalProcessing({
        ckb_id: ckbId,
        doc_id: docId,
        extract_time: 200,
        metadata: { method: 'field_extraction', fields_count: 5 }
      });

      // 3. Schema matching
      performanceMonitor.recordLocalProcessing({
        ckb_id: ckbId,
        doc_id: docId,
        match_time: 150,
        metadata: { 
          method: 'schema_matching',
          schemas_checked: 10,
          matches_found: 2
        }
      });

      // 4. LLM field mapping
      await tokenBudgetManager.recordUsage({
        module: 'field_normalizer',
        operation: 'llm_match',
        tokens: 200,
        ckb_id: ckbId,
        doc_id: docId,
        model_name: 'qwen'
      });

      performanceMonitor.recordLLMCall({
        module: 'field_normalizer',
        operation: 'llm_match',
        duration: 5500,
        success: true,
        tokens: 200,
        ckb_id: ckbId,
        doc_id: docId
      });

      // 5. Entity building with LLM
      await tokenBudgetManager.recordUsage({
        module: 'entity_builder',
        operation: 'enhance_name',
        tokens: 250,
        ckb_id: ckbId,
        doc_id: docId,
        model_name: 'qwen'
      });

      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'enhance_name',
        duration: 6000,
        success: true,
        tokens: 250,
        ckb_id: ckbId,
        doc_id: docId
      });

      // 6. Complete document processing
      performanceMonitor.recordDocumentProcessing({
        doc_id: docId,
        total_time: Date.now() - docStartTime,
        ckb_count: 1,
        entity_count: 3,
        relation_count: 2,
        success: true
      });

      // Verify performance stats
      const perfStats = performanceMonitor.getStats();
      expect(perfStats.local_processing.count).toBe(2);
      expect(perfStats.llm_calls.count).toBe(2);
      expect(perfStats.document_processing.count).toBe(1);

      // Verify budget status
      const budgetStatus = tokenBudgetManager.getBudgetStatus();
      expect(budgetStatus.daily.usage).toBe(450); // 200 + 250
      expect(budgetStatus.emergencyMode).toBe(false);
    });

    test('should handle emergency mode during processing', async () => {
      // Set budget to near limit
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 95000,
        model_name: 'qwen'
      });

      const beforeStatus = tokenBudgetManager.getBudgetStatus();
      expect(beforeStatus.emergencyMode).toBe(false);

      // Process more and trigger emergency
      await tokenBudgetManager.recordUsage({
        module: 'entity_builder',
        operation: 'enhance_name',
        tokens: 6000,
        model_name: 'qwen'
      });

      const afterStatus = tokenBudgetManager.getBudgetStatus();
      expect(afterStatus.emergencyMode).toBe(true);
      expect(afterStatus.llmParticipationRate).toBe(0.2);
    });

    test('should provide budget recommendations', () => {
      // Use significant budget
      tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 85000,
        model_name: 'qwen'
      });

      const recommendations = tokenBudgetManager.getRecommendations();
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].category).toBe('budget');
    });

    test('should track performance over multiple documents', () => {
      // Process multiple documents
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordDocumentProcessing({
          doc_id: `doc_${i}`,
          total_time: 20000 + i * 1000,
          ckb_count: 5,
          entity_count: 10,
          relation_count: 15,
          success: true
        });
      }

      const stats = performanceMonitor.getStats();
      
      expect(stats.document_processing.count).toBe(5);
      expect(stats.document_processing.success_count).toBe(5);
      expect(stats.document_processing.avg_total_time).toBeGreaterThan(20000);
    });
  });

  describe('Performance Thresholds', () => {
    test('should record slow local processing', () => {
      // Record slow operation
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        extract_time: 1500, // > 1000ms threshold
        metadata: { method: 'field_extraction' }
      });

      const stats = performanceMonitor.getStats();
      
      // Verify it was recorded
      expect(stats.local_processing.count).toBe(1);
      expect(stats.local_processing.avg_extract_time).toBe(1500);
    });

    test('should record slow LLM calls', () => {
      // Record slow LLM call
      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'enhance_name',
        duration: 11000, // > 10000ms threshold
        success: true
      });

      const stats = performanceMonitor.getStats();
      
      // Verify it was recorded
      expect(stats.llm_calls.count).toBe(1);
      expect(stats.llm_calls.avg_duration).toBe(11000);
    });

    test('should record slow document processing', () => {
      // Record slow document
      performanceMonitor.recordDocumentProcessing({
        doc_id: 'doc_001',
        total_time: 35000, // > 30000ms threshold
        ckb_count: 10,
        entity_count: 15,
        relation_count: 20,
        success: true
      });

      const stats = performanceMonitor.getStats();
      
      // Verify it was recorded
      expect(stats.document_processing.count).toBe(1);
      expect(stats.document_processing.avg_total_time).toBe(35000);
    });
  });

  describe('Budget Enforcement', () => {
    test('should reduce LLM participation in emergency mode', async () => {
      // Trigger emergency mode
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 100000,
        model_name: 'qwen'
      });

      const status = tokenBudgetManager.getBudgetStatus();
      
      // Simulate LLM call decisions
      let llmCallsMade = 0;
      const totalAttempts = 100;

      for (let i = 0; i < totalAttempts; i++) {
        if (Math.random() < status.llmParticipationRate) {
          llmCallsMade++;
        }
      }

      // Should be around 20% (emergency rate)
      const actualRate = llmCallsMade / totalAttempts;
      expect(actualRate).toBeGreaterThan(0.1);
      expect(actualRate).toBeLessThanOrEqual(0.3);  // Changed to <= to handle edge case
    });

    test('should track per-document token usage', async () => {
      const docId = 'doc_001';

      // Record multiple operations for same document
      await tokenBudgetManager.recordUsage({
        module: 'field_normalizer',
        operation: 'llm_match',
        tokens: 200,
        doc_id: docId,
        model_name: 'qwen'
      });

      await tokenBudgetManager.recordUsage({
        module: 'entity_builder',
        operation: 'enhance_name',
        tokens: 250,
        doc_id: docId,
        model_name: 'qwen'
      });

      const status = tokenBudgetManager.getBudgetStatus();
      const topDocs = status.topDocuments;
      
      expect(topDocs.length).toBeGreaterThan(0);
      expect(topDocs[0].docId).toBe(docId);
      expect(topDocs[0].tokens).toBe(450);
    });
  });
});
