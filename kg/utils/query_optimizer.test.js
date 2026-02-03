/**
 * Tests for Query Optimizer Module
 * 
 * Validates: Requirement 21.12
 */

const queryOptimizer = require('./query_optimizer');

describe('Query Optimizer', () => {
  beforeEach(() => {
    queryOptimizer.reset();
  });

  describe('recordQuery', () => {
    it('should record slow queries (> 500ms)', () => {
      const result = queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_entities',
        duration: 600,
        rowCount: 100
      });

      expect(result).toBeTruthy();
      expect(result.operation).toBe('select');
      expect(result.table).toBe('kg_entities');
      expect(result.duration).toBe(600);
      expect(result.is_slow).toBe(true);
    });

    it('should not record fast queries (< 500ms)', () => {
      const result = queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_entities',
        duration: 100,
        rowCount: 10
      });

      expect(result).toBeNull();
    });

    it('should record query metadata', () => {
      const result = queryOptimizer.recordQuery({
        operation: 'update',
        table: 'kg_relations',
        duration: 800,
        query: 'UPDATE kg_relations SET weight = ? WHERE id = ?',
        params: [0.8, 123],
        metadata: { user: 'test' }
      });

      expect(result.query).toBe('UPDATE kg_relations SET weight = ? WHERE id = ?');
      expect(result.params).toEqual([0.8, 123]);
      expect(result.metadata).toEqual({ user: 'test' });
    });

    it('should trim old queries when limit exceeded', () => {
      // Record more than MAX_STORED_QUERIES
      for (let i = 0; i < 550; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'test_table',
          duration: 600
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();
      expect(stats.count).toBeLessThanOrEqual(500);
    });
  });

  describe('getSlowQueryStats', () => {
    beforeEach(() => {
      // Record some slow queries
      queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_entities',
        duration: 800,
        rowCount: 100
      });

      queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_entities',
        duration: 1200,
        rowCount: 200
      });

      queryOptimizer.recordQuery({
        operation: 'update',
        table: 'kg_relations',
        duration: 600,
        rowCount: 10
      });
    });

    it('should calculate basic statistics', () => {
      const stats = queryOptimizer.getSlowQueryStats();

      expect(stats.count).toBe(3);
      expect(stats.avg_duration).toBeCloseTo(866.67, 1);
      expect(stats.max_duration).toBe(1200);
    });

    it('should group queries by table', () => {
      const stats = queryOptimizer.getSlowQueryStats();

      expect(stats.by_table['kg_entities']).toBeDefined();
      expect(stats.by_table['kg_entities'].count).toBe(2);
      expect(stats.by_table['kg_entities'].avg_duration).toBe(1000);

      expect(stats.by_table['kg_relations']).toBeDefined();
      expect(stats.by_table['kg_relations'].count).toBe(1);
    });

    it('should group queries by operation', () => {
      const stats = queryOptimizer.getSlowQueryStats();

      expect(stats.by_operation['select']).toBeDefined();
      expect(stats.by_operation['select'].count).toBe(2);

      expect(stats.by_operation['update']).toBeDefined();
      expect(stats.by_operation['update'].count).toBe(1);
    });

    it('should track operations per table', () => {
      const stats = queryOptimizer.getSlowQueryStats();

      expect(stats.by_table['kg_entities'].operations['select']).toBe(2);
      expect(stats.by_table['kg_relations'].operations['update']).toBe(1);
    });

    it('should return empty stats when no slow queries', () => {
      queryOptimizer.reset();
      const stats = queryOptimizer.getSlowQueryStats();

      expect(stats.count).toBe(0);
      expect(stats.avg_duration).toBe(0);
      expect(stats.recommendations).toEqual([]);
    });

    it('should filter by time range', () => {
      queryOptimizer.reset();

      // Record old query (simulate by not including it in time range)
      const stats = queryOptimizer.getSlowQueryStats({ timeRange: 1000 }); // 1 second

      expect(stats.count).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend indexes for high-frequency slow queries', () => {
      queryOptimizer.reset();

      // Record 15 slow queries on same table
      for (let i = 0; i < 15; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 700
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();
      const indexRec = stats.recommendations.find(r => 
        r.category === 'index' && r.table === 'kg_entities'
      );

      expect(indexRec).toBeDefined();
      expect(indexRec.priority).toBe('high');
      expect(indexRec.recommendation).toContain('indexes');
    });

    it('should flag extremely slow queries', () => {
      queryOptimizer.reset();

      queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_entities',
        duration: 3000 // 3 seconds
      });

      const stats = queryOptimizer.getSlowQueryStats();
      const perfRec = stats.recommendations.find(r => 
        r.category === 'performance'
      );

      expect(perfRec).toBeDefined();
      expect(perfRec.priority).toBe('high');
      expect(perfRec.issue).toContain('Extremely slow');
    });

    it('should recommend indexes for slow SELECT queries', () => {
      queryOptimizer.reset();

      for (let i = 0; i < 6; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_relations',
          duration: 600
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();
      const selectRec = stats.recommendations.find(r => 
        r.issue.includes('slow SELECT')
      );

      expect(selectRec).toBeDefined();
      expect(selectRec.recommendation).toContain('WHERE clause');
    });

    it('should recommend indexes for slow UPDATE/DELETE queries', () => {
      queryOptimizer.reset();

      for (let i = 0; i < 4; i++) {
        queryOptimizer.recordQuery({
          operation: 'update',
          table: 'kg_entities',
          duration: 700
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();
      const updateRec = stats.recommendations.find(r => 
        r.issue.includes('UPDATE/DELETE')
      );

      expect(updateRec).toBeDefined();
      expect(updateRec.priority).toBe('medium');
    });

    it('should recommend architecture changes for many slow queries', () => {
      queryOptimizer.reset();

      for (let i = 0; i < 60; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: `table_${i % 5}`,
          duration: 600
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();
      const archRec = stats.recommendations.find(r => 
        r.category === 'architecture'
      );

      expect(archRec).toBeDefined();
      expect(archRec.priority).toBe('high');
      expect(archRec.recommendation).toContain('database optimization');
    });

    it('should sort recommendations by priority', () => {
      queryOptimizer.reset();

      // Create mix of issues
      for (let i = 0; i < 15; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 700
        });
      }

      queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_relations',
        duration: 3000
      });

      const stats = queryOptimizer.getSlowQueryStats();
      
      // High priority should come first
      expect(stats.recommendations[0].priority).toBe('high');
    });
  });

  describe('getIndexSuggestions', () => {
    it('should return index suggestions for kg_entities', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('kg_entities');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].table).toBe('kg_entities');
      expect(suggestions[0].columns).toBeDefined();
      expect(suggestions[0].sql).toContain('CREATE INDEX');
    });

    it('should return index suggestions for kg_relations', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('kg_relations');

      expect(suggestions.length).toBeGreaterThan(0);
      
      const sourceIdIndex = suggestions.find(s => 
        s.columns.includes('source_id')
      );
      expect(sourceIdIndex).toBeDefined();
      expect(sourceIdIndex.reason).toContain('entity relations');
    });

    it('should return index suggestions for ckb', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('ckb');

      expect(suggestions.length).toBeGreaterThan(0);
      
      const docIdIndex = suggestions.find(s => 
        s.columns.includes('doc_id')
      );
      expect(docIdIndex).toBeDefined();
    });

    it('should return index suggestions for schemas', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('schemas');

      expect(suggestions.length).toBeGreaterThan(0);
      
      const nameIndex = suggestions.find(s => 
        s.columns.includes('name')
      );
      expect(nameIndex).toBeDefined();
    });

    it('should return empty array for unknown table', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('unknown_table');

      expect(suggestions).toEqual([]);
    });

    it('should include composite index suggestions', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('kg_entities');

      const compositeIndex = suggestions.find(s => 
        s.columns.length > 1
      );
      expect(compositeIndex).toBeDefined();
      expect(compositeIndex.sql).toContain(',');
    });
  });

  describe('analyzeQueryPatterns', () => {
    it('should identify hotspots', () => {
      queryOptimizer.reset();

      // Create hotspot on kg_entities
      for (let i = 0; i < 10; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 600
        });
      }

      for (let i = 0; i < 3; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_relations',
          duration: 600
        });
      }

      const analysis = queryOptimizer.analyzeQueryPatterns();

      expect(analysis.hotspots.length).toBeGreaterThan(0);
      expect(analysis.hotspots[0].table).toBe('kg_entities');
      expect(analysis.hotspots[0].count).toBe(10);
    });

    it('should identify repeated slow query patterns', () => {
      queryOptimizer.reset();

      for (let i = 0; i < 8; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 700
        });
      }

      const analysis = queryOptimizer.analyzeQueryPatterns();

      const pattern = analysis.patterns.find(p => 
        p.type === 'repeated_slow_queries'
      );
      expect(pattern).toBeDefined();
      expect(pattern.table).toBe('kg_entities');
      expect(pattern.severity).toBe('medium');
    });

    it('should mark high-frequency patterns as high severity', () => {
      queryOptimizer.reset();

      for (let i = 0; i < 25; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 600
        });
      }

      const analysis = queryOptimizer.analyzeQueryPatterns();

      const pattern = analysis.patterns.find(p => 
        p.type === 'repeated_slow_queries'
      );
      expect(pattern.severity).toBe('high');
    });

    it('should return empty analysis when no slow queries', () => {
      queryOptimizer.reset();

      const analysis = queryOptimizer.analyzeQueryPatterns();

      expect(analysis.patterns).toEqual([]);
      expect(analysis.hotspots).toEqual([]);
    });

    it('should limit hotspots to top 5', () => {
      queryOptimizer.reset();

      // Create 10 different tables with slow queries
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          queryOptimizer.recordQuery({
            operation: 'select',
            table: `table_${i}`,
            duration: 600
          });
        }
      }

      const analysis = queryOptimizer.analyzeQueryPatterns();

      expect(analysis.hotspots.length).toBeLessThanOrEqual(5);
    });
  });

  describe('clearOldQueries', () => {
    it('should clear queries older than threshold', () => {
      queryOptimizer.reset();

      // Record some queries
      for (let i = 0; i < 10; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 600
        });
      }

      // Clear with very short threshold (all should be cleared)
      const cleared = queryOptimizer.clearOldQueries(0);

      expect(cleared).toBe(10);

      const stats = queryOptimizer.getSlowQueryStats();
      expect(stats.count).toBe(0);
    });

    it('should keep recent queries', () => {
      queryOptimizer.reset();

      for (let i = 0; i < 5; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 600
        });
      }

      // Clear with very long threshold (none should be cleared)
      const cleared = queryOptimizer.clearOldQueries(86400000); // 24 hours

      expect(cleared).toBe(0);

      const stats = queryOptimizer.getSlowQueryStats();
      expect(stats.count).toBe(5);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete monitoring workflow', () => {
      queryOptimizer.reset();

      // Simulate real usage with enough queries to trigger recommendations
      for (let i = 0; i < 12; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 800,
          query: 'SELECT * FROM kg_entities WHERE entity_type = ?',
          params: ['Person']
        });
      }

      queryOptimizer.recordQuery({
        operation: 'select',
        table: 'kg_relations',
        duration: 1200,
        query: 'SELECT * FROM kg_relations WHERE source_id = ?',
        params: [123]
      });

      // Get statistics
      const stats = queryOptimizer.getSlowQueryStats();
      expect(stats.count).toBe(13);

      // Get recommendations (should have some due to high frequency)
      expect(stats.recommendations.length).toBeGreaterThan(0);

      // Get index suggestions
      const entitySuggestions = queryOptimizer.getIndexSuggestions('kg_entities');
      expect(entitySuggestions.length).toBeGreaterThan(0);

      // Analyze patterns
      const analysis = queryOptimizer.analyzeQueryPatterns();
      expect(analysis.hotspots.length).toBeGreaterThan(0);
    });

    it('should provide actionable recommendations', () => {
      queryOptimizer.reset();

      // Simulate problematic scenario
      for (let i = 0; i < 20; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 900
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();
      const recommendations = stats.recommendations;

      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should have high priority recommendation
      const highPriority = recommendations.filter(r => r.priority === 'high');
      expect(highPriority.length).toBeGreaterThan(0);

      // Should have actionable recommendation text
      expect(recommendations[0].recommendation).toBeTruthy();
      expect(recommendations[0].impact).toBeDefined();
      expect(recommendations[0].effort).toBeDefined();
    });
  });
});
