/**
 * Integration test for Anchor Generator Metrics
 * 
 * Verifies that metrics are properly recorded during anchor generation
 */

const { generateAnchorFingerprint, resetMetrics, getMetrics, getMetricsSummary } = require('./anchor_generator');

describe('Anchor Generator Metrics Integration', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetMetrics();
  });

  it('should record metrics when generating anchor fingerprints', () => {
    const instance = {
      schema_name: 'Test Schema',
      schema_id: 'test_001',
      entity_type: 'EventEntity',
      fields: {
        '区域': '阿里C区',
        '时间': '2025-01-15',
        '指标': '地下水位'
      }
    };

    const schema = {
      schema_id: 'test_001',
      schema_name: 'Test Schema',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' },
        { name: '指标', normalization_strategy: 'indicator' },
        { name: '时间', normalization_strategy: 'time_month' }
      ]
    };

    // Generate anchor fingerprint
    const anchor = generateAnchorFingerprint(instance, schema);

    // Verify anchor was generated
    expect(anchor).toBeTruthy();
    expect(anchor).toContain('EventEntity');

    // Verify metrics were recorded
    const metrics = getMetrics();
    expect(metrics.anchorGeneration.total).toBe(1);
    expect(metrics.anchorGeneration.successful).toBe(1);
    expect(metrics.anchorGeneration.failed).toBe(0);
    expect(metrics.anchorGeneration.avgDuration).toBeGreaterThan(0);
  });

  it('should record failure metrics when anchor generation fails', () => {
    const instance = {
      schema_name: 'Test Schema',
      schema_id: 'test_001',
      entity_type: 'EventEntity',
      fields: {}
    };

    const schema = {
      schema_id: 'test_001',
      schema_name: 'Test Schema',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    // Try to generate anchor fingerprint (should fail due to empty fields)
    expect(() => {
      generateAnchorFingerprint(instance, schema);
    }).toThrow();

    // Verify failure metrics were recorded
    const metrics = getMetrics();
    expect(metrics.anchorGeneration.total).toBe(1);
    expect(metrics.anchorGeneration.successful).toBe(0);
    expect(metrics.anchorGeneration.failed).toBe(1);
  });

  it('should track performance metrics across multiple generations', () => {
    const schema = {
      schema_id: 'test_001',
      schema_name: 'Test Schema',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' },
        { name: '时间', normalization_strategy: 'time_month' }
      ]
    };

    // Generate multiple anchors
    for (let i = 0; i < 10; i++) {
      const instance = {
        schema_name: 'Test Schema',
        schema_id: 'test_001',
        entity_type: 'EventEntity',
        fields: {
          '区域': `区域${i}`,
          '时间': `2025-01-${i + 1}`
        }
      };

      generateAnchorFingerprint(instance, schema);
    }

    // Verify metrics
    const metrics = getMetrics();
    expect(metrics.anchorGeneration.total).toBe(10);
    expect(metrics.anchorGeneration.successful).toBe(10);
    expect(metrics.anchorGeneration.avgDuration).toBeGreaterThanOrEqual(0);
    expect(metrics.anchorGeneration.minDuration).toBeGreaterThanOrEqual(0);
    expect(metrics.anchorGeneration.maxDuration).toBeGreaterThanOrEqual(0);
    expect(metrics.anchorGeneration.minDuration).toBeLessThanOrEqual(metrics.anchorGeneration.maxDuration);
  });

  it('should provide summary with performance assessment', () => {
    const schema = {
      schema_id: 'test_001',
      schema_name: 'Test Schema',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    // Generate some anchors
    for (let i = 0; i < 5; i++) {
      const instance = {
        schema_name: 'Test Schema',
        schema_id: 'test_001',
        entity_type: 'EventEntity',
        fields: {
          '区域': `区域${i}`
        }
      };

      generateAnchorFingerprint(instance, schema);
    }

    // Get summary
    const summary = getMetricsSummary();

    expect(summary.anchorGeneration).toBeDefined();
    expect(summary.anchorGeneration.total).toBe(5);
    expect(summary.anchorGeneration.successRate).toBe(100);
    expect(summary.anchorGeneration.performance).toMatch(/GOOD|NEEDS_IMPROVEMENT/);
  });

  it('should reset metrics correctly', () => {
    const instance = {
      schema_name: 'Test Schema',
      schema_id: 'test_001',
      entity_type: 'EventEntity',
      fields: {
        '区域': '阿里C区'
      }
    };

    const schema = {
      schema_id: 'test_001',
      schema_name: 'Test Schema',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    // Generate anchor
    generateAnchorFingerprint(instance, schema);

    // Verify metrics exist
    let metrics = getMetrics();
    expect(metrics.anchorGeneration.total).toBe(1);

    // Reset metrics
    resetMetrics();

    // Verify metrics are reset
    metrics = getMetrics();
    expect(metrics.anchorGeneration.total).toBe(0);
    expect(metrics.anchorGeneration.successful).toBe(0);
    expect(metrics.anchorGeneration.failed).toBe(0);
  });
});
