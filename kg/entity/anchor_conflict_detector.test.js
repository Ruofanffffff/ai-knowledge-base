/**
 * Unit Tests for Anchor Conflict Detector
 */

const {
  detectAnchorConflict,
  checkTimeConsistency,
  checkValueConflicts,
  checkStateContradictions,
  calculateConflictSeverity,
  generateRecommendation,
  detectAnchorConflictsBatch,
  getConflictStatistics,
  extractMonth
} = require('./anchor_conflict_detector');

describe('AnchorConflictDetector', () => {
  // Helper function to create test instances
  function createTestInstance(schemaName, fields, confidence = 0.8) {
    return {
      instance: {
        schema_name: schemaName,
        schema_id: `schema_${schemaName}`,
        entity_type: 'TestEntity',
        fields,
        ckb_ids: ['ckb_1'],
        confidence
      },
      schema: {
        schema_name: schemaName,
        entity_type: 'TestEntity'
      },
      anchor: 'TestEntity|test_anchor'
    };
  }

  describe('detectAnchorConflict', () => {
    it('should detect no conflict when instances are consistent', () => {
      const group = [
        createTestInstance('Schema A', { 区域: '阿里C区', 时间: '2025-01-15', 数值: '100' }),
        createTestInstance('Schema B', { 区域: '阿里C区', 时间: '2025-01-20', 数值: '105' })
      ];

      const result = detectAnchorConflict('test_anchor', group);

      expect(result.anchor).toBe('test_anchor');
      expect(result.has_conflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.severity).toBe('none');
      expect(result.recommendation).toBe('auto_merge');
    });

    it('should detect time inconsistency conflict', () => {
      const group = [
        createTestInstance('Schema A', { 时间: '2025-01-15' }),
        createTestInstance('Schema B', { 时间: '2025-02-15' })
      ];

      const result = detectAnchorConflict('test_anchor', group);

      expect(result.has_conflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('time_inconsistency');
      expect(result.severity).toBe('high');
    });

    it('should detect value conflict', () => {
      const group = [
        createTestInstance('Schema A', { 数值: '100' }),
        createTestInstance('Schema B', { 数值: '200' }) // 100% difference
      ];

      const result = detectAnchorConflict('test_anchor', group);

      expect(result.has_conflict).toBe(true);
      expect(result.conflicts.some(c => c.type === 'value_conflict')).toBe(true);
    });

    it('should detect state contradiction', () => {
      const group = [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 状态: '异常' })
      ];

      const result = detectAnchorConflict('test_anchor', group);

      expect(result.has_conflict).toBe(true);
      expect(result.conflicts.some(c => c.type === 'state_contradiction')).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should throw error if anchor is missing', () => {
      const group = [createTestInstance('Schema A', {})];

      expect(() => detectAnchorConflict(null, group)).toThrow();
    });

    it('should throw error if group is empty', () => {
      expect(() => detectAnchorConflict('test_anchor', [])).toThrow();
    });

    it('should include instance count and schema names', () => {
      const group = [
        createTestInstance('Schema A', {}),
        createTestInstance('Schema B', {}),
        createTestInstance('Schema C', {})
      ];

      const result = detectAnchorConflict('test_anchor', group);

      expect(result.instance_count).toBe(3);
      expect(result.schema_names).toEqual(['Schema A', 'Schema B', 'Schema C']);
    });
  });

  describe('checkTimeConsistency', () => {
    it('should return null when time fields are consistent', () => {
      const group = [
        createTestInstance('Schema A', { 时间: '2025-01-15' }),
        createTestInstance('Schema B', { 时间: '2025-01-20' })
      ];

      const result = checkTimeConsistency(group);

      expect(result).toBeNull();
    });

    it('should detect inconsistent months', () => {
      const group = [
        createTestInstance('Schema A', { 时间: '2025-01-15' }),
        createTestInstance('Schema B', { 时间: '2025-02-15' })
      ];

      const result = checkTimeConsistency(group);

      expect(result).not.toBeNull();
      expect(result.type).toBe('time_inconsistency');
      expect(result.severity).toBe('high');
      expect(result.details).toHaveLength(2);
    });

    it('should handle different time field names', () => {
      const group = [
        createTestInstance('Schema A', { Time: '2025-01-15' }),
        createTestInstance('Schema B', { Timestamp: '2025-02-15' })
      ];

      const result = checkTimeConsistency(group);

      expect(result).not.toBeNull();
      expect(result.type).toBe('time_inconsistency');
    });

    it('should return null when less than 2 time values', () => {
      const group = [
        createTestInstance('Schema A', { 时间: '2025-01-15' }),
        createTestInstance('Schema B', { 区域: '阿里C区' }) // no time field
      ];

      const result = checkTimeConsistency(group);

      expect(result).toBeNull();
    });

    it('should handle Chinese date format', () => {
      const group = [
        createTestInstance('Schema A', { 时间: '2025年1月15日' }),
        createTestInstance('Schema B', { 时间: '2025年2月15日' })
      ];

      const result = checkTimeConsistency(group);

      expect(result).not.toBeNull();
      expect(result.type).toBe('time_inconsistency');
    });
  });

  describe('checkValueConflicts', () => {
    it('should detect significant value differences', () => {
      const group = [
        createTestInstance('Schema A', { 数值: '100' }),
        createTestInstance('Schema B', { 数值: '200' }) // 100% difference
      ];

      const result = checkValueConflicts(group);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('value_conflict');
      expect(result[0].severity).toBe('high'); // > 50%
    });

    it('should not detect small value differences', () => {
      const group = [
        createTestInstance('Schema A', { 数值: '100' }),
        createTestInstance('Schema B', { 数值: '105' }) // 5% difference
      ];

      const result = checkValueConflicts(group);

      expect(result).toHaveLength(0);
    });

    it('should detect medium severity conflicts', () => {
      const group = [
        createTestInstance('Schema A', { Value: '100' }),
        createTestInstance('Schema B', { Value: '130' }) // 30% difference
      ];

      const result = checkValueConflicts(group);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('medium'); // 10-50%
    });

    it('should handle different numeric field names', () => {
      const group = [
        createTestInstance('Schema A', { Amount: '100' }),
        createTestInstance('Schema B', { Amount: '200' })
      ];

      const result = checkValueConflicts(group);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when less than 2 values', () => {
      const group = [
        createTestInstance('Schema A', { 数值: '100' }),
        createTestInstance('Schema B', { 区域: '阿里C区' }) // no numeric field
      ];

      const result = checkValueConflicts(group);

      expect(result).toHaveLength(0);
    });

    it('should include detailed conflict information', () => {
      const group = [
        createTestInstance('Schema A', { 数值: '100' }, 0.9),
        createTestInstance('Schema B', { 数值: '200' }, 0.8)
      ];

      const result = checkValueConflicts(group);

      expect(result[0].details).toBeDefined();
      expect(result[0].details.values).toHaveLength(2);
      expect(result[0].details.min).toBe(100);
      expect(result[0].details.max).toBe(200);
      expect(result[0].details.difference).toBe(100);
    });
  });

  describe('checkStateContradictions', () => {
    it('should detect contradictory states', () => {
      const group = [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 状态: '异常' })
      ];

      const result = checkStateContradictions(group);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('state_contradiction');
      expect(result[0].severity).toBe('high');
    });

    it('should detect English contradictory states', () => {
      const group = [
        createTestInstance('Schema A', { Status: 'active' }),
        createTestInstance('Schema B', { Status: 'inactive' })
      ];

      const result = checkStateContradictions(group);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('state_contradiction');
    });

    it('should not detect non-contradictory states', () => {
      const group = [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 状态: '正常' })
      ];

      const result = checkStateContradictions(group);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple contradictory pairs', () => {
      const group = [
        createTestInstance('Schema A', { Status: 'enabled' }),
        createTestInstance('Schema B', { Status: 'disabled' })
      ];

      const result = checkStateContradictions(group);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when less than 2 states', () => {
      const group = [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 区域: '阿里C区' }) // no state field
      ];

      const result = checkStateContradictions(group);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateConflictSeverity', () => {
    it('should return "none" for empty conflicts', () => {
      const severity = calculateConflictSeverity([]);
      expect(severity).toBe('none');
    });

    it('should return "high" when any conflict is high severity', () => {
      const conflicts = [
        { type: 'test', severity: 'low' },
        { type: 'test', severity: 'high' },
        { type: 'test', severity: 'medium' }
      ];

      const severity = calculateConflictSeverity(conflicts);
      expect(severity).toBe('high');
    });

    it('should return "medium" when no high but has medium', () => {
      const conflicts = [
        { type: 'test', severity: 'low' },
        { type: 'test', severity: 'medium' }
      ];

      const severity = calculateConflictSeverity(conflicts);
      expect(severity).toBe('medium');
    });

    it('should return "low" when all conflicts are low severity', () => {
      const conflicts = [
        { type: 'test', severity: 'low' },
        { type: 'test', severity: 'low' }
      ];

      const severity = calculateConflictSeverity(conflicts);
      expect(severity).toBe('low');
    });
  });

  describe('generateRecommendation', () => {
    it('should recommend auto_merge for no conflicts', () => {
      const recommendation = generateRecommendation([], 'none');
      expect(recommendation).toBe('auto_merge');
    });

    it('should recommend split for state contradictions', () => {
      const conflicts = [
        { type: 'state_contradiction', severity: 'high' }
      ];

      const recommendation = generateRecommendation(conflicts, 'high');
      expect(recommendation).toBe('split');
    });

    it('should recommend split for time inconsistency', () => {
      const conflicts = [
        { type: 'time_inconsistency', severity: 'high' }
      ];

      const recommendation = generateRecommendation(conflicts, 'high');
      expect(recommendation).toBe('split');
    });

    it('should recommend review for high severity without state/time conflicts', () => {
      const conflicts = [
        { type: 'value_conflict', severity: 'high' }
      ];

      const recommendation = generateRecommendation(conflicts, 'high');
      expect(recommendation).toBe('review');
    });

    it('should recommend review for medium severity', () => {
      const conflicts = [
        { type: 'value_conflict', severity: 'medium' }
      ];

      const recommendation = generateRecommendation(conflicts, 'medium');
      expect(recommendation).toBe('review');
    });

    it('should recommend auto_merge for low severity', () => {
      const conflicts = [
        { type: 'value_conflict', severity: 'low' }
      ];

      const recommendation = generateRecommendation(conflicts, 'low');
      expect(recommendation).toBe('auto_merge');
    });
  });

  describe('detectAnchorConflictsBatch', () => {
    it('should detect conflicts for multiple anchor groups', () => {
      const anchorGroups = new Map();

      anchorGroups.set('anchor_1', [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 状态: '异常' })
      ]);

      anchorGroups.set('anchor_2', [
        createTestInstance('Schema C', { 数值: '100' }),
        createTestInstance('Schema D', { 数值: '100' })
      ]);

      const results = detectAnchorConflictsBatch(anchorGroups);

      expect(results).toHaveLength(1); // Only anchor_1 has conflicts
      expect(results[0].anchor).toBe('anchor_1');
    });

    it('should handle empty anchor groups', () => {
      const anchorGroups = new Map();
      const results = detectAnchorConflictsBatch(anchorGroups);

      expect(results).toHaveLength(0);
    });

    it('should throw error if anchorGroups is not a Map', () => {
      expect(() => detectAnchorConflictsBatch([])).toThrow();
    });
  });

  describe('getConflictStatistics', () => {
    it('should calculate statistics correctly', () => {
      const conflictResults = [
        {
          severity: 'high',
          recommendation: 'split',
          conflicts: [
            { type: 'state_contradiction' },
            { type: 'time_inconsistency' }
          ]
        },
        {
          severity: 'medium',
          recommendation: 'review',
          conflicts: [
            { type: 'value_conflict' }
          ]
        },
        {
          severity: 'high',
          recommendation: 'review',
          conflicts: [
            { type: 'value_conflict' }
          ]
        }
      ];

      const stats = getConflictStatistics(conflictResults);

      expect(stats.total_conflicts).toBe(3);
      expect(stats.by_severity.high).toBe(2);
      expect(stats.by_severity.medium).toBe(1);
      expect(stats.by_recommendation.split).toBe(1);
      expect(stats.by_recommendation.review).toBe(2);
      expect(stats.by_type.state_contradiction).toBe(1);
      expect(stats.by_type.time_inconsistency).toBe(1);
      expect(stats.by_type.value_conflict).toBe(2);
    });

    it('should handle empty conflict results', () => {
      const stats = getConflictStatistics([]);

      expect(stats.total_conflicts).toBe(0);
      expect(stats.by_severity.high).toBe(0);
    });
  });

  describe('extractMonth', () => {
    it('should extract month from YYYY-MM-DD format', () => {
      expect(extractMonth('2025-01-15')).toBe('2025-01');
      expect(extractMonth('2025-12-31')).toBe('2025-12');
    });

    it('should extract month from YYYY-MM format', () => {
      expect(extractMonth('2025-01')).toBe('2025-01');
    });

    it('should extract month from Chinese format', () => {
      expect(extractMonth('2025年1月')).toBe('2025-01');
      expect(extractMonth('2025年12月')).toBe('2025-12');
    });

    it('should pad single digit months', () => {
      expect(extractMonth('2025-1-15')).toBe('2025-01');
      expect(extractMonth('2025年1月')).toBe('2025-01');
    });

    it('should return null for invalid formats', () => {
      expect(extractMonth('invalid')).toBeNull();
      expect(extractMonth('')).toBeNull();
      expect(extractMonth(null)).toBeNull();
    });
  });
});
