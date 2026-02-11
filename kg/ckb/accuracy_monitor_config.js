/**
 * Accuracy Monitor Configuration
 * 
 * Configuration settings for accuracy monitoring and auto-degradation.
 */

module.exports = {
  // Accuracy thresholds
  maxAccuracyDrop: parseFloat(process.env.ACCURACY_MAX_DROP) || 0.02, // 2% max acceptable drop
  warningThreshold: parseFloat(process.env.ACCURACY_WARNING_THRESHOLD) || 0.015, // 1.5% warning threshold
  
  // Auto-degradation settings
  autoDegradationEnabled: process.env.ACCURACY_AUTO_DEGRADATION !== 'false',
  degradationThreshold: parseFloat(process.env.ACCURACY_DEGRADATION_THRESHOLD) || 0.02, // 2% triggers degradation
  
  // Test set requirements
  minTestSetSize: parseInt(process.env.ACCURACY_MIN_TEST_SET_SIZE) || 10, // Minimum test cases needed
  
  // Logging settings
  loggingEnabled: process.env.ACCURACY_LOGGING_ENABLED !== 'false',
  
  // Module-specific thresholds (optional overrides)
  moduleThresholds: {
    field_extraction: {
      maxAccuracyDrop: parseFloat(process.env.ACCURACY_MAX_DROP_FIELD_EXTRACTION) || 0.02,
      degradationThreshold: parseFloat(process.env.ACCURACY_DEGRADATION_FIELD_EXTRACTION) || 0.02
    },
    entity_recognition: {
      maxAccuracyDrop: parseFloat(process.env.ACCURACY_MAX_DROP_ENTITY_RECOGNITION) || 0.02,
      degradationThreshold: parseFloat(process.env.ACCURACY_DEGRADATION_ENTITY_RECOGNITION) || 0.02
    },
    relation_extraction: {
      maxAccuracyDrop: parseFloat(process.env.ACCURACY_MAX_DROP_RELATION_EXTRACTION) || 0.02,
      degradationThreshold: parseFloat(process.env.ACCURACY_DEGRADATION_RELATION_EXTRACTION) || 0.02
    }
  },
  
  // Alert settings
  alerting: {
    enabled: process.env.ACCURACY_ALERTING_ENABLED !== 'false',
    notificationChannels: {
      console: true,
      email: process.env.ACCURACY_ALERT_EMAIL === 'true',
      webhook: process.env.ACCURACY_ALERT_WEBHOOK === 'true'
    },
    webhookUrl: process.env.ACCURACY_ALERT_WEBHOOK_URL || null,
    emailRecipients: process.env.ACCURACY_ALERT_EMAIL_RECIPIENTS?.split(',') || []
  },
  
  // Statistics retention
  statistics: {
    retentionDays: parseInt(process.env.ACCURACY_STATS_RETENTION_DAYS) || 90,
    aggregationInterval: process.env.ACCURACY_STATS_AGGREGATION || 'daily' // daily, weekly, monthly
  }
};
