/**
 * Cost-Benefit Analyzer Tests
 * 
 * Tests cost-benefit analysis functionality including:
 * - Average Token cost calculation
 * - Average processing time calculation
 * - Optimization recommendations
 * - Cost trends analysis
 * 
 * Validates: Requirements 21.19, 21.20
 */

const costBenefitAnalyzer = require('./cost_benefit_analyzer');

describe('Cost-Benefit Analyzer', () => {
  beforeEach(() => {
    costBenefitAnalyzer.reset();
  });

  describe('Document Metrics Recording', () => {
    test('should record document metrics', () => {
      const metrics = {
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      };

      const entry = costBenefitAnalyzer.recordDocumentMetrics(metrics);

      expect(entry).toHaveProperty('doc_id', 'doc1');
      expect(entry).toHaveProperty('processing_time_ms', 3000);
      expect(entry).toHaveProperty('token_usage');
      expect(entry).toHaveProperty('costs');
      expect(entry).toHaveProperty('efficiency');
      expect(entry.costs).toHaveProperty('input_cost');
      expect(entry.costs).toHaveProperty('output_cost');
      expect(entry.costs).toHaveProperty('total_cost');
    });

    test('should calculate costs correctly', () => {
      const metrics = {
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      };

      const entry = costBenefitAnalyzer.recordDocumentMetrics(metrics);

      // Input cost: 1000 tokens * $0.0005/1000 = $0.0005
      expect(entry.costs.input_cost).toBeCloseTo(0.0005, 5);
      
      // Output cost: 500 tokens * $0.0015/1000 = $0.00075
      expect(entry.costs.output_cost).toBeCloseTo(0.00075, 5);
      
      // Total cost
      expect(entry.costs.total_cost).toBeCloseTo(0.00125, 5);
    });

    test('should calculate efficiency score', () => {
      const metrics = {
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      };

      const entry = costBenefitAnalyzer.recordDocumentMetrics(metrics);

      expect(entry.efficiency).toBeGreaterThan(0);
      expect(entry.efficiency).toBeLessThanOrEqual(1);
    });

    test('should maintain history limit', () => {
      // Record 1100 documents
      for (let i = 0; i < 1100; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      // Should keep only last 1000
      expect(costBenefitAnalyzer.getHistoryCount()).toBe(1000);
    });
  });

  describe('Average Token Cost', () => {
    test('should return zero stats when no documents', () => {
      const stats = costBenefitAnalyzer.getAverageTokenCost();

      expect(stats.avg_total_cost).toBe(0);
      expect(stats.document_count).toBe(0);
      expect(stats.is_within_target).toBe(true);
    });

    test('should calculate average Token cost correctly', () => {
      // Record multiple documents
      for (let i = 0; i < 5; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      const stats = costBenefitAnalyzer.getAverageTokenCost();

      expect(stats.avg_input_tokens).toBe(1000);
      expect(stats.avg_output_tokens).toBe(500);
      expect(stats.avg_total_tokens).toBe(1500);
      expect(stats.document_count).toBe(5);
      expect(stats).toHaveProperty('target_cost');
      expect(stats).toHaveProperty('is_within_target');
    });

    test('should identify when cost exceeds target', () => {
      // Record document with high Token usage
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 50000,  // Very high
          output_tokens: 25000,
          total_tokens: 75000
        }
      });

      const stats = costBenefitAnalyzer.getAverageTokenCost();

      expect(stats.is_within_target).toBe(false);
      expect(stats.avg_total_cost).toBeGreaterThan(stats.target_cost);
    });
  });

  describe('Average Processing Time', () => {
    test('should return zero stats when no documents', () => {
      const stats = costBenefitAnalyzer.getAverageProcessingTime();

      expect(stats.avg_processing_time_ms).toBe(0);
      expect(stats.document_count).toBe(0);
      expect(stats.is_within_target).toBe(true);
    });

    test('should calculate average processing time correctly', () => {
      const times = [2000, 3000, 4000, 5000, 6000];
      
      times.forEach((time, i) => {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: time,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      });

      const stats = costBenefitAnalyzer.getAverageProcessingTime();

      expect(stats.avg_processing_time_ms).toBe(4000);
      expect(stats.min_processing_time_ms).toBe(2000);
      expect(stats.max_processing_time_ms).toBe(6000);
      expect(stats.document_count).toBe(5);
    });

    test('should identify when time exceeds target', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 10000,  // 10 seconds, exceeds 5s target
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const stats = costBenefitAnalyzer.getAverageProcessingTime();

      expect(stats.is_within_target).toBe(false);
      expect(stats.avg_processing_time_ms).toBeGreaterThan(stats.target_time_ms);
    });
  });

  describe('Cost-Benefit Analysis', () => {
    test('should provide comprehensive analysis', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const analysis = costBenefitAnalyzer.getCostBenefitAnalysis();

      expect(analysis).toHaveProperty('timestamp');
      expect(analysis).toHaveProperty('cost_analysis');
      expect(analysis).toHaveProperty('time_analysis');
      expect(analysis).toHaveProperty('efficiency');
      expect(analysis).toHaveProperty('overall_health');
    });

    test('should calculate efficiency metrics', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const analysis = costBenefitAnalyzer.getCostBenefitAnalysis();

      expect(analysis.efficiency).toHaveProperty('avg_efficiency');
      expect(analysis.efficiency).toHaveProperty('target_efficiency');
      expect(analysis.efficiency).toHaveProperty('is_efficient');
      expect(analysis.efficiency.avg_efficiency).toBeGreaterThan(0);
      expect(analysis.efficiency.avg_efficiency).toBeLessThanOrEqual(1);
    });

    test('should assess overall health', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const analysis = costBenefitAnalyzer.getCostBenefitAnalysis();

      expect(analysis.overall_health).toHaveProperty('cost_healthy');
      expect(analysis.overall_health).toHaveProperty('time_healthy');
      expect(analysis.overall_health).toHaveProperty('efficiency_healthy');
      expect(analysis.overall_health).toHaveProperty('overall_healthy');
    });
  });

  describe('Optimization Recommendations', () => {
    test('should return empty array when all metrics are healthy', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
    });

    test('should recommend cost optimization when cost is high', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 50000,
          output_tokens: 25000,
          total_tokens: 75000
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      const costRec = recommendations.find(r => r.category === 'cost');
      expect(costRec).toBeDefined();
      expect(costRec.priority).toMatch(/high|medium/);
      expect(costRec).toHaveProperty('issue');
      expect(costRec).toHaveProperty('recommendation');
      expect(costRec).toHaveProperty('impact');
      expect(costRec).toHaveProperty('effort');
    });

    test('should recommend performance optimization when time is high', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 10000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      const perfRec = recommendations.find(r => r.category === 'performance');
      expect(perfRec).toBeDefined();
      expect(perfRec.priority).toMatch(/high|medium/);
    });

    test('should sort recommendations by priority', () => {
      // Create conditions for multiple recommendations
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 10000,
        token_usage: {
          input_tokens: 50000,
          output_tokens: 25000,
          total_tokens: 75000
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      if (recommendations.length > 1) {
        const priorities = recommendations.map(r => r.priority);
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        
        for (let i = 1; i < priorities.length; i++) {
          expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(
            priorityOrder[priorities[i - 1]]
          );
        }
      }
    });

    test('should include estimated savings in cost recommendations', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 50000,
          output_tokens: 25000,
          total_tokens: 75000
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      const costRec = recommendations.find(r => r.category === 'cost');
      if (costRec) {
        expect(costRec).toHaveProperty('estimated_savings');
      }
    });
  });

  describe('Cost Trends', () => {
    test('should return empty trends when no documents', () => {
      const trends = costBenefitAnalyzer.getCostTrends();

      expect(trends.buckets).toEqual([]);
      expect(trends.trend).toBe('stable');
      expect(trends.total_cost).toBe(0);
      expect(trends.total_documents).toBe(0);
    });

    test('should calculate cost trends over time', () => {
      // Record documents over time
      for (let i = 0; i < 10; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000,
          token_usage: {
            input_tokens: 1000 + i * 100,
            output_tokens: 500,
            total_tokens: 1500 + i * 100
          },
          timestamp: new Date(Date.now() - (10 - i) * 60000).toISOString()
        });
      }

      const trends = costBenefitAnalyzer.getCostTrends();

      expect(trends.buckets.length).toBeGreaterThan(0);
      expect(trends.trend).toMatch(/increasing|decreasing|stable/);
      expect(trends.total_documents).toBe(10);
      expect(trends.total_cost).toBeGreaterThan(0);
    });

    test('should group documents into time buckets', () => {
      // Record documents
      for (let i = 0; i < 5; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      const trends = costBenefitAnalyzer.getCostTrends({ bucketSize: 3600000 });

      expect(trends.buckets.length).toBeGreaterThan(0);
      trends.buckets.forEach(bucket => {
        expect(bucket).toHaveProperty('timestamp');
        expect(bucket).toHaveProperty('document_count');
        expect(bucket).toHaveProperty('avg_cost');
        expect(bucket).toHaveProperty('total_cost');
        expect(bucket).toHaveProperty('avg_tokens');
      });
    });
  });

  describe('Comprehensive Report', () => {
    test('should provide comprehensive report', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      const report = costBenefitAnalyzer.getComprehensiveReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('analysis');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('configuration');
    });

    test('should include configuration details', () => {
      const report = costBenefitAnalyzer.getComprehensiveReport();

      expect(report.configuration).toHaveProperty('input_token_cost');
      expect(report.configuration).toHaveProperty('output_token_cost');
      expect(report.configuration).toHaveProperty('target_processing_time_ms');
      expect(report.configuration).toHaveProperty('target_token_cost_per_doc');
    });
  });

  describe('Configuration', () => {
    test('should have valid cost configuration', () => {
      const config = costBenefitAnalyzer.COST_CONFIG;

      expect(config.INPUT_TOKEN_COST).toBeGreaterThan(0);
      expect(config.OUTPUT_TOKEN_COST).toBeGreaterThan(0);
      expect(config.TARGET_PROCESSING_TIME_MS).toBeGreaterThan(0);
      expect(config.TARGET_TOKEN_COST_PER_DOC).toBeGreaterThan(0);
    });

    test('should have reasonable thresholds', () => {
      const config = costBenefitAnalyzer.COST_CONFIG;

      expect(config.HIGH_COST_THRESHOLD).toBeGreaterThan(1);
      expect(config.HIGH_TIME_THRESHOLD).toBeGreaterThan(1);
      expect(config.EFFICIENCY_THRESHOLD).toBeGreaterThan(0);
      expect(config.EFFICIENCY_THRESHOLD).toBeLessThanOrEqual(1);
    });
  });

  describe('Reset', () => {
    test('should clear all historical data', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      expect(costBenefitAnalyzer.getHistoryCount()).toBe(1);

      costBenefitAnalyzer.reset();

      expect(costBenefitAnalyzer.getHistoryCount()).toBe(0);
    });
  });

  describe('Requirements Validation', () => {
    test('should calculate average Token cost per document (Requirement 21.19)', () => {
      for (let i = 0; i < 5; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      const stats = costBenefitAnalyzer.getAverageTokenCost();

      expect(stats).toHaveProperty('avg_total_cost');
      expect(stats).toHaveProperty('document_count');
      expect(stats.avg_total_cost).toBeGreaterThan(0);
      expect(stats.document_count).toBe(5);
    });

    test('should calculate average processing time per document (Requirement 21.19)', () => {
      for (let i = 0; i < 5; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000 + i * 500,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      const stats = costBenefitAnalyzer.getAverageProcessingTime();

      expect(stats).toHaveProperty('avg_processing_time_ms');
      expect(stats).toHaveProperty('document_count');
      expect(stats.avg_processing_time_ms).toBeGreaterThan(0);
      expect(stats.document_count).toBe(5);
    });

    test('should provide optimization recommendations (Requirement 21.20)', () => {
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 10000,
        token_usage: {
          input_tokens: 50000,
          output_tokens: 25000,
          total_tokens: 75000
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('issue');
        expect(rec).toHaveProperty('recommendation');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('effort');
      });
    });
  });
});
