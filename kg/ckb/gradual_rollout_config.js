/**
 * Gradual Rollout Configuration
 * 
 * This file contains configuration for the three-phase gradual rollout strategy.
 */

module.exports = {
  // Enable/disable gradual rollout
  enabled: process.env.ENABLE_GRADUAL_ROLLOUT === 'true',
  
  // Initial phase (0=disabled, 1=10%, 2=50%, 3=100%)
  initialPhase: parseInt(process.env.ROLLOUT_INITIAL_PHASE) || 0,
  
  // Phase percentages
  phases: {
    phase1: {
      percentage: parseInt(process.env.ROLLOUT_PHASE1_PERCENTAGE) || 10,
      durationDays: parseInt(process.env.ROLLOUT_PHASE_DURATION_DAYS) || 7,
      description: 'Phase 1: 10% traffic for initial validation',
    },
    phase2: {
      percentage: parseInt(process.env.ROLLOUT_PHASE2_PERCENTAGE) || 50,
      durationDays: parseInt(process.env.ROLLOUT_PHASE_DURATION_DAYS) || 7,
      description: 'Phase 2: 50% traffic for broader testing',
    },
    phase3: {
      percentage: parseInt(process.env.ROLLOUT_PHASE3_PERCENTAGE) || 100,
      durationDays: 0, // No duration limit for full rollout
      description: 'Phase 3: 100% full rollout',
    },
  },
  
  // Quality thresholds for emergency rollback
  qualityThresholds: {
    // Maximum acceptable accuracy drop (5%)
    maxAccuracyDrop: parseFloat(process.env.ROLLOUT_MAX_ACCURACY_DROP) || 0.05,
    
    // Maximum acceptable error rate (5%)
    maxErrorRate: parseFloat(process.env.ROLLOUT_MAX_ERROR_RATE) || 0.05,
    
    // Maximum acceptable latency increase (2x)
    maxLatencyIncrease: parseFloat(process.env.ROLLOUT_MAX_LATENCY_INCREASE) || 2.0,
    
    // Minimum required token savings (50%)
    minTokenSavings: parseFloat(process.env.ROLLOUT_MIN_TOKEN_SAVINGS) || 0.50,
  },
  
  // Monitoring configuration
  monitoring: {
    // Check interval for emergency rollback (milliseconds)
    checkInterval: parseInt(process.env.ROLLOUT_CHECK_INTERVAL) || 60000, // 1 minute
    
    // Enable automatic emergency rollback
    autoRollback: process.env.ROLLOUT_AUTO_ROLLBACK !== 'false',
    
    // Alert webhook URL for rollout events
    alertWebhook: process.env.ROLLOUT_ALERT_WEBHOOK || null,
  },
  
  // Rollout strategy
  strategy: {
    // Use consistent hashing for traffic splitting
    consistentHashing: true,
    
    // Hash algorithm (md5, sha256)
    hashAlgorithm: process.env.ROLLOUT_HASH_ALGORITHM || 'md5',
    
    // Minimum requests before allowing phase progression
    minRequestsForProgress: parseInt(process.env.ROLLOUT_MIN_REQUESTS) || 100,
  },
  
  // Reporting
  reporting: {
    // Generate daily reports
    dailyReports: process.env.ROLLOUT_DAILY_REPORTS === 'true',
    
    // Report recipients (comma-separated emails)
    reportRecipients: process.env.ROLLOUT_REPORT_RECIPIENTS
      ? process.env.ROLLOUT_REPORT_RECIPIENTS.split(',')
      : [],
    
    // Report format (json, html, markdown)
    reportFormat: process.env.ROLLOUT_REPORT_FORMAT || 'json',
  },
};
