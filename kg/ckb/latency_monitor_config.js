/**
 * Latency Monitor Configuration
 * 
 * Configuration settings for latency monitoring and performance tracking.
 */

module.exports = {
  // Latency thresholds (in milliseconds)
  warningThreshold: parseInt(process.env.LATENCY_WARNING_THRESHOLD) || 5000, // 5 seconds
  criticalThreshold: parseInt(process.env.LATENCY_CRITICAL_THRESHOLD) || 10000, // 10 seconds
  
  // Logging settings
  loggingEnabled: process.env.LATENCY_LOGGING_ENABLED !== 'false',
  detailedLogging: process.env.LATENCY_DETAILED_LOGGING === 'true',
  
  // Performance targets (in milliseconds)
  targetLatency: {
    document_processing: parseInt(process.env.LATENCY_TARGET_DOCUMENT) || 5000,
    field_extraction: parseInt(process.env.LATENCY_TARGET_FIELD) || 2000,
    entity_building: parseInt(process.env.LATENCY_TARGET_ENTITY) || 1000,
    relation_extraction: parseInt(process.env.LATENCY_TARGET_RELATION) || 2000
  },
  
  // Alert settings
  alerting: {
    enabled: process.env.LATENCY_ALERTING_ENABLED !== 'false',
    notificationChannels: {
      console: true,
      email: process.env.LATENCY_ALERT_EMAIL === 'true',
      webhook: process.env.LATENCY_ALERT_WEBHOOK === 'true'
    },
    webhookUrl: process.env.LATENCY_ALERT_WEBHOOK_URL || null,
    emailRecipients: process.env.LATENCY_ALERT_EMAIL_RECIPIENTS?.split(',') || []
  },
  
  // Statistics retention
  statistics: {
    retentionDays: parseInt(process.env.LATENCY_STATS_RETENTION_DAYS) || 90,
    aggregationInterval: process.env.LATENCY_STATS_AGGREGATION || 'hourly' // hourly, daily, weekly
  }
};
