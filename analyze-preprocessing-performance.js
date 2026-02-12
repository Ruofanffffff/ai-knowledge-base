/**
 * Performance Analysis Script for LLM Preprocessing
 * 
 * Analyzes LLM call frequency, latency patterns, and identifies optimization opportunities
 * 
 * Task 18: 性能优化和调优
 */

const { LatencyControlManager } = require('./kg/preprocessing/latency_control_manager');
const preprocessingMonitor = require('./kg/preprocessing/preprocessing_monitor');
const { config } = require('./kg/preprocessing/config');

/**
 * Analyze LLM call patterns from metrics
 */
function analyzeLLMCallPatterns() {
  console.log('\n========== LLM Call Pattern Analysis ==========\n');
  
  // Get latency control metrics
  const latencyManager = new LatencyControlManager();
  const metrics = latencyManager.getMetrics();
  
  console.log('Overall LLM Call Statistics:');
  console.log(`  Total Calls: ${metrics.totalCalls}`);
  console.log(`  Success Rate: ${metrics.successRate}`);
  console.log(`  Timeout Rate: ${((metrics.timeoutCalls / metrics.totalCalls) * 100).toFixed(2)}%`);
  console.log(`  Average Latency: ${metrics.avgLatency}`);
  console.log(`  Cache Hit Rate: ${metrics.cacheHitRate}`);
  console.log(`  Current Queue Size: ${metrics.queueSize}`);
  console.log(`  Pending Operations: ${metrics.queuePending}`);
  
  console.log('\nLatency by Operation:');
  Object.entries(metrics.operationLatencies).forEach(([operation, stats]) => {
    console.log(`  ${operation}:`);
    console.log(`    Count: ${stats.count}`);
    console.log(`    Avg: ${stats.avg}ms`);
    console.log(`    Min: ${stats.min}ms`);
    console.log(`    Max: ${stats.max}ms`);
  });
  
  // Get preprocessing monitor stats
  const prepStats = preprocessingMonitor.getPreprocessingStats({ timeRange: 3600000 });
  
  console.log('\nPreprocessing Statistics (Last Hour):');
  console.log(`  Index Generation:`);
  console.log(`    Count: ${prepStats.index_generation.count}`);
  console.log(`    Success Rate: ${(prepStats.index_generation.success_rate * 100).toFixed(2)}%`);
  console.log(`    Avg Duration: ${prepStats.index_generation.avg_duration}ms`);
  console.log(`    Avg Facts: ${prepStats.index_generation.avg_fact_count}`);
  console.log(`    Within Budget: ${(prepStats.index_generation.within_budget_rate * 100).toFixed(2)}%`);
  
  console.log(`\n  Corrections by Stage:`);
  Object.entries(prepStats.corrections.by_stage).forEach(([stage, stats]) => {
    console.log(`    ${stage}:`);
    console.log(`      Count: ${stats.count}`);
    console.log(`      Success Rate: ${(stats.success_rate * 100).toFixed(2)}%`);
    console.log(`      Avg Duration: ${stats.avg_duration}ms`);
    console.log(`      Total Corrections: ${stats.total_corrections}`);
  });
  
  console.log(`\n  Validations by Stage:`);
  Object.entries(prepStats.validations.by_stage).forEach(([stage, stats]) => {
    console.log(`    ${stage}:`);
    console.log(`      Count: ${stats.count}`);
    console.log(`      Success Rate: ${(stats.success_rate * 100).toFixed(2)}%`);
    console.log(`      Avg Duration: ${stats.avg_duration}ms`);
    console.log(`      Avg Coverage: ${(stats.avg_coverage_rate * 100).toFixed(2)}%`);
  });
  
  console.log(`\n  LLM Calls:`);
  console.log(`    Total: ${prepStats.llm_calls.count}`);
  console.log(`    Success Rate: ${(prepStats.llm_calls.success_rate * 100).toFixed(2)}%`);
  console.log(`    Timeout Count: ${prepStats.llm_calls.timeout_count}`);
  console.log(`    Avg Duration: ${prepStats.llm_calls.avg_duration}ms`);
  console.log(`    Total Tokens: ${prepStats.llm_calls.total_tokens}`);
  
  return { metrics, prepStats };
}

/**
 * Identify performance bottlenecks
 */
function identifyBottlenecks(metrics, prepStats) {
  console.log('\n========== Performance Bottlenecks ==========\n');
  
  const bottlenecks = [];
  
  // Check timeout rate
  if (metrics.timeoutCalls > 0) {
    const timeoutRate = (metrics.timeoutCalls / metrics.totalCalls) * 100;
    if (timeoutRate > 5) {
      bottlenecks.push({
        type: 'HIGH_TIMEOUT_RATE',
        severity: 'HIGH',
        description: `Timeout rate is ${timeoutRate.toFixed(2)}% (threshold: 5%)`,
        recommendation: 'Increase timeout values or optimize LLM prompts'
      });
    }
  }
  
  // Check cache hit rate
  const cacheHitRate = parseFloat(metrics.cacheHitRate);
  if (cacheHitRate < 30) {
    bottlenecks.push({
      type: 'LOW_CACHE_HIT_RATE',
      severity: 'MEDIUM',
      description: `Cache hit rate is ${cacheHitRate.toFixed(2)}% (target: >30%)`,
      recommendation: 'Increase cache size or TTL, or improve cache key generation'
    });
  }
  
  // Check operation latencies
  Object.entries(metrics.operationLatencies).forEach(([operation, stats]) => {
    const threshold = getLatencyThreshold(operation);
    if (stats.avg > threshold) {
      bottlenecks.push({
        type: 'HIGH_LATENCY',
        severity: 'HIGH',
        operation,
        description: `${operation} avg latency is ${stats.avg}ms (threshold: ${threshold}ms)`,
        recommendation: `Optimize ${operation} prompt or increase concurrency`
      });
    }
  });
  
  // Check index generation budget
  if (prepStats.index_generation.within_budget_rate < 0.9) {
    bottlenecks.push({
      type: 'INDEX_GENERATION_SLOW',
      severity: 'HIGH',
      description: `Only ${(prepStats.index_generation.within_budget_rate * 100).toFixed(2)}% of index generations are within budget`,
      recommendation: 'Optimize index generation prompt or increase timeout'
    });
  }
  
  // Check queue congestion
  if (metrics.queuePending > metrics.concurrency * 2) {
    bottlenecks.push({
      type: 'QUEUE_CONGESTION',
      severity: 'MEDIUM',
      description: `Queue has ${metrics.queuePending} pending operations (concurrency: ${metrics.concurrency})`,
      recommendation: 'Increase max concurrency or implement batching'
    });
  }
  
  if (bottlenecks.length === 0) {
    console.log('✓ No significant bottlenecks detected');
  } else {
    bottlenecks.forEach((bottleneck, index) => {
      console.log(`${index + 1}. [${bottleneck.severity}] ${bottleneck.type}`);
      console.log(`   ${bottleneck.description}`);
      console.log(`   Recommendation: ${bottleneck.recommendation}`);
      console.log('');
    });
  }
  
  return bottlenecks;
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(metrics, prepStats, bottlenecks) {
  console.log('\n========== Optimization Recommendations ==========\n');
  
  const recommendations = [];
  
  // 1. Concurrency optimization
  const avgQueueSize = metrics.queueSize || 0;
  const currentConcurrency = config.concurrency.maxConcurrent;
  
  if (avgQueueSize > currentConcurrency * 1.5) {
    const suggestedConcurrency = Math.min(currentConcurrency + 3, 10);
    recommendations.push({
      category: 'CONCURRENCY',
      priority: 'HIGH',
      current: `Max concurrency: ${currentConcurrency}`,
      suggested: `Increase to ${suggestedConcurrency}`,
      impact: 'Reduce queue wait time and improve throughput',
      config: `LLM_PREPROCESSING_MAX_CONCURRENCY=${suggestedConcurrency}`
    });
  }
  
  // 2. Timeout optimization
  Object.entries(metrics.operationLatencies).forEach(([operation, stats]) => {
    const currentTimeout = config.timeouts[operation] || 15000;
    if (stats.max > currentTimeout * 0.9) {
      const suggestedTimeout = Math.ceil(stats.max * 1.2);
      recommendations.push({
        category: 'TIMEOUT',
        priority: 'MEDIUM',
        operation,
        current: `${operation} timeout: ${currentTimeout}ms`,
        suggested: `Increase to ${suggestedTimeout}ms`,
        impact: 'Reduce timeout failures',
        config: `LLM_PREPROCESSING_${operation.toUpperCase()}_TIMEOUT=${suggestedTimeout}`
      });
    }
  });
  
  // 3. Cache optimization
  const cacheHitRate = parseFloat(metrics.cacheHitRate);
  if (cacheHitRate < 30 && cacheHitRate > 0) {
    const currentCacheSize = config.cache.maxSize;
    const suggestedCacheSize = Math.min(currentCacheSize * 2, 5000);
    recommendations.push({
      category: 'CACHE',
      priority: 'MEDIUM',
      current: `Cache size: ${currentCacheSize}, TTL: ${config.cache.ttl}ms`,
      suggested: `Increase cache size to ${suggestedCacheSize}`,
      impact: 'Improve cache hit rate and reduce redundant LLM calls',
      config: `LLM_PREPROCESSING_CACHE_MAX_SIZE=${suggestedCacheSize}`
    });
  }
  
  // 4. Smart triggering threshold optimization
  if (prepStats.corrections.total_count > 0) {
    const correctionRate = prepStats.corrections.total_count / prepStats.index_generation.count;
    if (correctionRate > 0.8) {
      recommendations.push({
        category: 'SMART_TRIGGERING',
        priority: 'LOW',
        current: `High correction rate: ${(correctionRate * 100).toFixed(2)}%`,
        suggested: 'Consider relaxing smart triggering thresholds',
        impact: 'Reduce unnecessary LLM calls while maintaining quality',
        config: 'Adjust FIELD_COVERAGE_THRESHOLD, RELATION_COVERAGE_THRESHOLD, etc.'
      });
    }
  }
  
  // 5. Batch processing optimization
  if (prepStats.corrections.total_count > 10) {
    recommendations.push({
      category: 'BATCHING',
      priority: 'MEDIUM',
      current: 'Sequential processing of corrections',
      suggested: 'Implement batch processing for multiple CKBs',
      impact: 'Reduce total processing time through parallelization',
      implementation: 'Group multiple CKBs and process in parallel batches'
    });
  }
  
  if (recommendations.length === 0) {
    console.log('✓ Current configuration is optimal');
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.category}`);
      console.log(`   Current: ${rec.current}`);
      console.log(`   Suggested: ${rec.suggested}`);
      console.log(`   Impact: ${rec.impact}`);
      if (rec.config) {
        console.log(`   Config: ${rec.config}`);
      }
      if (rec.implementation) {
        console.log(`   Implementation: ${rec.implementation}`);
      }
      console.log('');
    });
  }
  
  return recommendations;
}

/**
 * Calculate estimated LLM call frequency
 */
function estimateLLMCallFrequency(prepStats) {
  console.log('\n========== Estimated LLM Call Frequency ==========\n');
  
  const docsProcessed = prepStats.index_generation.count;
  const totalLLMCalls = prepStats.llm_calls.count;
  
  if (docsProcessed === 0) {
    console.log('No documents processed yet');
    return null;
  }
  
  const callsPerDoc = totalLLMCalls / docsProcessed;
  
  console.log(`Documents Processed: ${docsProcessed}`);
  console.log(`Total LLM Calls: ${totalLLMCalls}`);
  console.log(`Average Calls per Document: ${callsPerDoc.toFixed(2)}`);
  
  // Break down by stage
  console.log('\nCalls by Stage:');
  const callsByStage = {};
  
  // Index generation: always 1 per doc
  callsByStage['index_generation'] = docsProcessed;
  console.log(`  Index Generation: ${docsProcessed} (100%)`);
  
  // Corrections and validations
  Object.entries(prepStats.corrections.by_stage).forEach(([stage, stats]) => {
    callsByStage[stage] = stats.count;
    const percentage = (stats.count / docsProcessed * 100).toFixed(1);
    console.log(`  ${stage}: ${stats.count} (${percentage}%)`);
  });
  
  Object.entries(prepStats.validations.by_stage).forEach(([stage, stats]) => {
    callsByStage[stage] = stats.count;
    const percentage = (stats.count / docsProcessed * 100).toFixed(1);
    console.log(`  ${stage}: ${stats.count} (${percentage}%)`);
  });
  
  // Estimate cost (assuming average tokens per call)
  const avgTokensPerCall = prepStats.llm_calls.total_tokens / totalLLMCalls;
  console.log(`\nAverage Tokens per Call: ${avgTokensPerCall.toFixed(0)}`);
  console.log(`Total Tokens Used: ${prepStats.llm_calls.total_tokens}`);
  
  return {
    docsProcessed,
    totalLLMCalls,
    callsPerDoc,
    callsByStage,
    avgTokensPerCall
  };
}

/**
 * Get latency threshold for operation
 */
function getLatencyThreshold(operation) {
  const thresholds = {
    document_index: 30000,
    cbk_correction: 10000,
    field_correction: 15000,
    schema_correction: 10000,
    merge_correction: 10000,
    relation_correction: 20000,
    graph_description: 30000
  };
  return thresholds[operation] || 15000;
}

/**
 * Main analysis function
 */
function analyzePerformance() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  LLM Preprocessing Performance Analysis                ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  // 1. Analyze call patterns
  const { metrics, prepStats } = analyzeLLMCallPatterns();
  
  // 2. Identify bottlenecks
  const bottlenecks = identifyBottlenecks(metrics, prepStats);
  
  // 3. Generate recommendations
  const recommendations = generateOptimizationRecommendations(metrics, prepStats, bottlenecks);
  
  // 4. Estimate call frequency
  const frequency = estimateLLMCallFrequency(prepStats);
  
  // 5. Summary
  console.log('\n========== Summary ==========\n');
  console.log(`Total Bottlenecks: ${bottlenecks.length}`);
  console.log(`High Priority: ${bottlenecks.filter(b => b.severity === 'HIGH').length}`);
  console.log(`Medium Priority: ${bottlenecks.filter(b => b.severity === 'MEDIUM').length}`);
  console.log('');
  console.log(`Total Recommendations: ${recommendations.length}`);
  console.log(`High Priority: ${recommendations.filter(r => r.priority === 'HIGH').length}`);
  console.log(`Medium Priority: ${recommendations.filter(r => r.priority === 'MEDIUM').length}`);
  console.log(`Low Priority: ${recommendations.filter(r => r.priority === 'LOW').length}`);
  
  if (frequency) {
    console.log('');
    console.log(`Average LLM Calls per Document: ${frequency.callsPerDoc.toFixed(2)}`);
    console.log(`Average Tokens per Document: ${(frequency.avgTokensPerCall * frequency.callsPerDoc).toFixed(0)}`);
  }
  
  console.log('\n════════════════════════════════════════════════════════\n');
  
  return {
    metrics,
    prepStats,
    bottlenecks,
    recommendations,
    frequency
  };
}

// Run analysis if executed directly
if (require.main === module) {
  analyzePerformance();
}

module.exports = {
  analyzeLLMCallPatterns,
  identifyBottlenecks,
  generateOptimizationRecommendations,
  estimateLLMCallFrequency,
  analyzePerformance
};
