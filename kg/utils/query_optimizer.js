/**
 * Database Query Optimizer Module
 * 
 * Monitors and optimizes database queries:
 * - Records slow queries (> 500ms)
 * - Provides optimization recommendations
 * - Tracks query patterns
 * - Suggests index creation
 * 
 * Validates: Requirement 21.12
 */

// In-memory storage for slow queries
const slowQueries = [];

// Configuration
const CONFIG = {
  SLOW_QUERY_THRESHOLD_MS: 500,  // Queries slower than 500ms are logged
  MAX_STORED_QUERIES: 500,       // Maximum number of slow queries to store
  ANALYSIS_WINDOW_MS: 3600000    // 1 hour window for analysis
};

/**
 * Record a database query
 * @param {Object} data - Query data
 * @returns {Object|null} Recorded slow query or null if not slow
 */
function recordQuery(data) {
  const {
    operation,      // 'select', 'insert', 'update', 'delete'
    table,          // Table name
    duration,       // Query duration in ms
    query,          // Query string (optional)
    params,         // Query parameters (optional)
    rowCount,       // Number of rows affected/returned
    metadata        // Additional metadata
  } = data;

  // Only record slow queries
  if (duration < CONFIG.SLOW_QUERY_THRESHOLD_MS) {
    return null;
  }

  const slowQuery = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    operation,
    table,
    duration,
    query: query || null,
    params: params || null,
    rowCount: rowCount || 0,
    metadata: metadata || {},
    is_slow: true
  };

  slowQueries.push(slowQuery);

  // Trim old queries
  if (slowQueries.length > CONFIG.MAX_STORED_QUERIES) {
    slowQueries.shift();
  }

  // Log warning
  console.warn(`[Query Optimizer] Slow query detected: ${operation} on ${table} took ${duration}ms`);

  return slowQuery;
}

/**
 * Get slow query statistics
 * @param {Object} options - Query options
 * @returns {Object} Slow query statistics
 */
function getSlowQueryStats(options = {}) {
  const {
    timeRange = CONFIG.ANALYSIS_WINDOW_MS,
    groupBy = 'table'
  } = options;

  const since = new Date(Date.now() - timeRange);
  const recentQueries = slowQueries.filter(q => new Date(q.timestamp) >= since);

  if (recentQueries.length === 0) {
    return {
      count: 0,
      avg_duration: 0,
      max_duration: 0,
      by_table: {},
      by_operation: {},
      recommendations: []
    };
  }

  // Calculate statistics
  const avgDuration = average(recentQueries.map(q => q.duration));
  const maxDuration = Math.max(...recentQueries.map(q => q.duration));

  // Group by table
  const byTable = {};
  recentQueries.forEach(q => {
    if (!byTable[q.table]) {
      byTable[q.table] = {
        count: 0,
        total_duration: 0,
        avg_duration: 0,
        max_duration: 0,
        operations: {}
      };
    }
    byTable[q.table].count++;
    byTable[q.table].total_duration += q.duration;
    byTable[q.table].max_duration = Math.max(byTable[q.table].max_duration, q.duration);
    
    // Track operations per table
    if (!byTable[q.table].operations[q.operation]) {
      byTable[q.table].operations[q.operation] = 0;
    }
    byTable[q.table].operations[q.operation]++;
  });

  // Calculate averages
  Object.keys(byTable).forEach(table => {
    byTable[table].avg_duration = byTable[table].total_duration / byTable[table].count;
  });

  // Group by operation
  const byOperation = {};
  recentQueries.forEach(q => {
    if (!byOperation[q.operation]) {
      byOperation[q.operation] = {
        count: 0,
        total_duration: 0,
        avg_duration: 0,
        max_duration: 0
      };
    }
    byOperation[q.operation].count++;
    byOperation[q.operation].total_duration += q.duration;
    byOperation[q.operation].max_duration = Math.max(byOperation[q.operation].max_duration, q.duration);
  });

  // Calculate averages
  Object.keys(byOperation).forEach(op => {
    byOperation[op].avg_duration = byOperation[op].total_duration / byOperation[op].count;
  });

  // Generate recommendations
  const recommendations = generateRecommendations(byTable, byOperation, recentQueries);

  return {
    count: recentQueries.length,
    avg_duration: avgDuration,
    max_duration: maxDuration,
    by_table: byTable,
    by_operation: byOperation,
    recommendations,
    time_range: timeRange,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate optimization recommendations
 * @param {Object} byTable - Queries grouped by table
 * @param {Object} byOperation - Queries grouped by operation
 * @param {Array} queries - All slow queries
 * @returns {Array} Recommendations
 */
function generateRecommendations(byTable, byOperation, queries) {
  const recommendations = [];

  // Analyze each table
  Object.entries(byTable).forEach(([table, stats]) => {
    // Recommendation 1: High frequency slow queries
    if (stats.count >= 10) {
      recommendations.push({
        priority: 'high',
        category: 'index',
        table,
        issue: `Table "${table}" has ${stats.count} slow queries (avg: ${stats.avg_duration.toFixed(0)}ms)`,
        recommendation: `Consider adding indexes on frequently queried columns in "${table}" table`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Recommendation 2: Very slow queries
    if (stats.max_duration > 2000) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        table,
        issue: `Extremely slow query detected on "${table}" (${stats.max_duration}ms)`,
        recommendation: `Review query structure and consider query optimization or data partitioning`,
        impact: 'high',
        effort: 'high'
      });
    }

    // Recommendation 3: SELECT queries
    if (stats.operations.select && stats.operations.select > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'index',
        table,
        issue: `Multiple slow SELECT queries on "${table}"`,
        recommendation: `Add indexes on WHERE clause columns and JOIN keys`,
        impact: 'medium',
        effort: 'low'
      });
    }

    // Recommendation 4: UPDATE/DELETE queries
    if ((stats.operations.update || 0) + (stats.operations.delete || 0) > 3) {
      recommendations.push({
        priority: 'medium',
        category: 'index',
        table,
        issue: `Slow UPDATE/DELETE operations on "${table}"`,
        recommendation: `Ensure WHERE clause columns are indexed`,
        impact: 'medium',
        effort: 'low'
      });
    }
  });

  // Recommendation 5: Overall slow query rate
  if (queries.length > 50) {
    recommendations.push({
      priority: 'high',
      category: 'architecture',
      table: 'all',
      issue: `High number of slow queries detected (${queries.length})`,
      recommendation: `Consider database optimization: add indexes, optimize queries, or upgrade database`,
      impact: 'high',
      effort: 'high'
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Get index suggestions for a table
 * @param {string} table - Table name
 * @returns {Array} Index suggestions
 */
function getIndexSuggestions(table) {
  const suggestions = [];

  // Common patterns that benefit from indexes
  const patterns = {
    'kg_entities': [
      { columns: ['canonical_name'], reason: 'Frequently searched by name' },
      { columns: ['entity_type'], reason: 'Frequently filtered by type' },
      { columns: ['confidence'], reason: 'Frequently filtered by confidence' },
      { columns: ['entity_type', 'confidence'], reason: 'Composite filter queries' }
    ],
    'kg_relations': [
      { columns: ['source_id'], reason: 'Frequently queried for entity relations' },
      { columns: ['target_id'], reason: 'Frequently queried for entity relations' },
      { columns: ['type'], reason: 'Frequently filtered by relation type' },
      { columns: ['source_id', 'target_id'], reason: 'Composite relation lookups' }
    ],
    'ckb': [
      { columns: ['doc_id'], reason: 'Frequently queried by document' },
      { columns: ['source_type'], reason: 'Frequently filtered by source type' }
    ],
    'schemas': [
      { columns: ['name'], reason: 'Frequently searched by name' },
      { columns: ['entity_type'], reason: 'Frequently filtered by entity type' },
      { columns: ['active'], reason: 'Frequently filtered by active status' }
    ]
  };

  if (patterns[table]) {
    patterns[table].forEach(pattern => {
      suggestions.push({
        table,
        columns: pattern.columns,
        reason: pattern.reason,
        sql: `CREATE INDEX idx_${table}_${pattern.columns.join('_')} ON ${table}(${pattern.columns.join(', ')});`
      });
    });
  }

  return suggestions;
}

/**
 * Analyze query patterns
 * @returns {Object} Query pattern analysis
 */
function analyzeQueryPatterns() {
  const recentQueries = slowQueries.filter(q => 
    new Date(q.timestamp) >= new Date(Date.now() - CONFIG.ANALYSIS_WINDOW_MS)
  );

  if (recentQueries.length === 0) {
    return {
      patterns: [],
      hotspots: [],
      trends: {}
    };
  }

  // Identify hotspots (tables with most slow queries)
  const tableCounts = {};
  recentQueries.forEach(q => {
    tableCounts[q.table] = (tableCounts[q.table] || 0) + 1;
  });

  const hotspots = Object.entries(tableCounts)
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Identify patterns
  const patterns = [];
  
  // Pattern 1: Repeated slow queries on same table
  hotspots.forEach(hotspot => {
    if (hotspot.count >= 5) {
      patterns.push({
        type: 'repeated_slow_queries',
        table: hotspot.table,
        count: hotspot.count,
        severity: hotspot.count >= 20 ? 'high' : 'medium'
      });
    }
  });

  // Pattern 2: Increasing query times
  const timeGroups = groupByTimeWindow(recentQueries, 600000); // 10-minute windows
  const trend = calculateTrend(timeGroups);

  return {
    patterns,
    hotspots,
    trends: {
      direction: trend.direction,
      change_rate: trend.changeRate,
      is_degrading: trend.direction === 'increasing'
    }
  };
}

/**
 * Clear old slow queries
 * @param {number} olderThan - Clear queries older than this (in ms)
 * @returns {number} Number of queries cleared
 */
function clearOldQueries(olderThan = 86400000) { // Default: 24 hours
  const initialCount = slowQueries.length;
  
  if (olderThan === 0) {
    // Clear all queries
    slowQueries.length = 0;
  } else {
    const cutoff = new Date(Date.now() - olderThan);
    const filtered = slowQueries.filter(q => new Date(q.timestamp) >= cutoff);
    slowQueries.length = 0;
    slowQueries.push(...filtered);
  }
  
  const cleared = initialCount - slowQueries.length;
  console.log(`[Query Optimizer] Cleared ${cleared} old slow queries`);
  
  return cleared;
}

/**
 * Reset all data (for testing)
 */
function reset() {
  slowQueries.length = 0;
  console.log('[Query Optimizer] Reset complete');
}

// Helper functions

function generateId() {
  return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function groupByTimeWindow(queries, windowMs) {
  const groups = {};
  queries.forEach(q => {
    const timestamp = new Date(q.timestamp).getTime();
    const windowKey = Math.floor(timestamp / windowMs) * windowMs;
    if (!groups[windowKey]) {
      groups[windowKey] = [];
    }
    groups[windowKey].push(q);
  });
  return groups;
}

function calculateTrend(timeGroups) {
  const windows = Object.keys(timeGroups).sort();
  if (windows.length < 2) {
    return { direction: 'stable', changeRate: 0 };
  }

  const avgDurations = windows.map(w => 
    average(timeGroups[w].map(q => q.duration))
  );

  const firstHalf = avgDurations.slice(0, Math.floor(avgDurations.length / 2));
  const secondHalf = avgDurations.slice(Math.floor(avgDurations.length / 2));

  const firstAvg = average(firstHalf);
  const secondAvg = average(secondHalf);

  const changeRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  let direction;
  if (Math.abs(changeRate) < 10) {
    direction = 'stable';
  } else if (changeRate > 0) {
    direction = 'increasing';
  } else {
    direction = 'decreasing';
  }

  return { direction, changeRate };
}

module.exports = {
  recordQuery,
  getSlowQueryStats,
  getIndexSuggestions,
  analyzeQueryPatterns,
  clearOldQueries,
  reset,
  CONFIG
};
