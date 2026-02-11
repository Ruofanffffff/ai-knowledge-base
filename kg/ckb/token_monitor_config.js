/**
 * Token Monitor Configuration
 * 
 * Configuration for token consumption monitoring and budget management.
 */

module.exports = {
  // Budget limits (tokens per day)
  budgetLimit: parseInt(process.env.TOKEN_BUDGET_LIMIT) || 1000000, // 1M tokens/day default

  // Alert threshold (0-1, percentage of budget)
  alertThreshold: parseFloat(process.env.TOKEN_ALERT_THRESHOLD) || 0.8, // 80% default

  // Enable/disable features
  enableLogging: process.env.TOKEN_LOGGING_ENABLED !== 'false', // Enabled by default
  enableAlerting: process.env.TOKEN_ALERTING_ENABLED !== 'false', // Enabled by default

  // Model pricing (USD per 1K tokens)
  pricing: {
    'gpt-4': {
      input: 0.03,
      output: 0.06
    },
    'gpt-4-turbo': {
      input: 0.01,
      output: 0.03
    },
    'gpt-3.5-turbo': {
      input: 0.0015,
      output: 0.002
    },
    'qwen': {
      input: 0.001,
      output: 0.001
    },
    'unknown': {
      input: 0.002,
      output: 0.002
    }
  },

  // Module-specific budgets (optional)
  moduleBudgets: {
    field_extraction: parseInt(process.env.TOKEN_BUDGET_FIELD_EXTRACTION) || 300000,
    entity_naming: parseInt(process.env.TOKEN_BUDGET_ENTITY_NAMING) || 200000,
    relation_extraction: parseInt(process.env.TOKEN_BUDGET_RELATION_EXTRACTION) || 300000,
    schema_matching: parseInt(process.env.TOKEN_BUDGET_SCHEMA_MATCHING) || 100000,
    other: parseInt(process.env.TOKEN_BUDGET_OTHER) || 100000
  },

  // Alert notification settings
  alerting: {
    // Email notifications (if configured)
    emailEnabled: process.env.ALERT_EMAIL_ENABLED === 'true',
    emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],

    // Webhook notifications (if configured)
    webhookEnabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
    webhookUrl: process.env.ALERT_WEBHOOK_URL || null,

    // Console logging
    consoleEnabled: true
  },

  // Statistics retention
  statsRetention: {
    // Keep detailed records for N days
    detailedDays: parseInt(process.env.TOKEN_STATS_DETAILED_DAYS) || 30,
    
    // Keep aggregated records for N days
    aggregatedDays: parseInt(process.env.TOKEN_STATS_AGGREGATED_DAYS) || 365
  }
};
