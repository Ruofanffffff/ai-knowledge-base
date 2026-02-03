/**
 * Content Filter
 * 
 * Applies filtering rules to structural units
 * Identifies and excludes meaningless content (headers, footers, blanks, etc.)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default filter rules
const DEFAULT_FILTER_RULES = [
  {
    rule_id: 'filter_header_footer',
    name: '页眉页脚过滤',
    type: 'regex',
    pattern: '^(页眉|页脚|第\\s*\\d+\\s*页)',
    action: 'skip',
    reason: '页眉页脚内容',
    enabled: true
  },
  {
    rule_id: 'filter_short_content',
    name: '短内容标记',
    type: 'length',
    pattern: '10',
    action: 'mark_low_quality',
    reason: '内容过短（< 10 字符）',
    enabled: true
  },
  {
    rule_id: 'filter_punctuation_only',
    name: '纯标点符号过滤',
    type: 'regex',
    pattern: '^[\\s\\p{P}\\p{S}]+$',
    action: 'skip',
    reason: '仅包含标点符号',
    enabled: true
  },
  {
    rule_id: 'filter_number_only',
    name: '纯数字标记',
    type: 'regex',
    pattern: '^\\d+$',
    action: 'mark_low_quality',
    reason: '仅包含数字',
    enabled: true
  },
  {
    rule_id: 'filter_duplicate',
    name: '重复内容过滤',
    type: 'pattern',
    pattern: 'duplicate_detection',
    action: 'skip',
    reason: '重复内容（如页眉页脚）',
    enabled: true
  }
];

class ContentFilter {
  constructor() {
    this.rules = [...DEFAULT_FILTER_RULES];
    this.seenContent = new Set();
  }
  
  /**
   * Apply filters to structural units
   * @param {Array} units - Array of StructuralUnit
   * @returns {Object} FilterResult
   */
  applyFilters(units) {
    const filtered = [];
    const skipped = [];
    const stats = {
      total_units: units.length,
      filtered_units: 0,
      skipped_by_rule: {}
    };
    
    // Reset seen content for each document
    this.seenContent.clear();
    
    for (const unit of units) {
      // Skip empty content
      if (unit.is_empty) {
        unit.should_filter = true;
        unit.filter_reason = '空内容';
        unit.matched_rule = 'empty_content';
        skipped.push(unit);
        continue;
      }
      
      // Apply filtering rules
      let shouldSkip = false;
      for (const rule of this.rules) {
        if (!rule.enabled) continue;
        
        if (this.matchRule(unit, rule)) {
          unit.should_filter = true;
          unit.filter_reason = rule.reason;
          unit.matched_rule = rule.rule_id;
          
          if (rule.action === 'skip') {
            shouldSkip = true;
            skipped.push(unit);
            stats.skipped_by_rule[rule.rule_id] = (stats.skipped_by_rule[rule.rule_id] || 0) + 1;
          }
          break;
        }
      }
      
      if (!shouldSkip) {
        filtered.push(unit);
        stats.filtered_units++;
      }
    }
    
    return {
      filtered_units: filtered,
      skipped_units: skipped,
      stats
    };
  }
  
  /**
   * Match a unit against a rule
   * @param {Object} unit - StructuralUnit
   * @param {Object} rule - FilterRule
   * @returns {boolean} Whether the rule matches
   */
  matchRule(unit, rule) {
    const content = unit.content;
    
    switch (rule.type) {
      case 'regex':
        try {
          const regex = new RegExp(rule.pattern, 'u');
          return regex.test(content);
        } catch (e) {
          console.error(`Invalid regex pattern: ${rule.pattern}`, e);
          return false;
        }
      
      case 'keyword':
        return content.includes(rule.pattern);
      
      case 'length':
        const threshold = parseInt(rule.pattern);
        return content.length < threshold;
      
      case 'pattern':
        if (rule.pattern === 'duplicate_detection') {
          if (this.seenContent.has(content)) {
            return true;
          }
          this.seenContent.add(content);
          return false;
        }
        return false;
      
      default:
        return false;
    }
  }
  
  /**
   * Add custom filter rule
   * @param {Object} rule - FilterRule
   */
  async addCustomRule(rule) {
    // Save to database
    await prisma.filterRule.create({
      data: {
        ruleId: rule.rule_id,
        name: rule.name,
        type: rule.type,
        pattern: rule.pattern.toString(),
        action: rule.action,
        reason: rule.reason,
        enabled: rule.enabled !== undefined ? rule.enabled : true
      }
    });
    
    // Add to in-memory rules
    this.rules.push(rule);
  }
  
  /**
   * Remove custom filter rule
   * @param {string} ruleId - Rule ID
   */
  async removeCustomRule(ruleId) {
    // Remove from database
    await prisma.filterRule.delete({
      where: { ruleId: ruleId }
    });
    
    // Remove from in-memory rules
    this.rules = this.rules.filter(r => r.rule_id !== ruleId);
  }
  
  /**
   * Enable/disable a rule
   * @param {string} ruleId - Rule ID
   * @param {boolean} enabled - Whether to enable
   */
  async setRuleEnabled(ruleId, enabled) {
    // Update database
    await prisma.filterRule.update({
      where: { ruleId: ruleId },
      data: { enabled: enabled }
    });
    
    // Update in-memory rules
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }
  
  /**
   * Get filter statistics
   * @returns {Object} FilterStats
   */
  getFilterStats() {
    return {
      total_rules: this.rules.length,
      enabled_rules: this.rules.filter(r => r.enabled).length,
      rules: this.rules.map(r => ({
        rule_id: r.rule_id,
        name: r.name,
        enabled: r.enabled
      }))
    };
  }
  
  /**
   * Load default rules into database
   */
  async loadDefaultRules() {
    for (const rule of DEFAULT_FILTER_RULES) {
      const existing = await prisma.filterRule.findUnique({
        where: { ruleId: rule.rule_id }
      });
      
      if (!existing) {
        await prisma.filterRule.create({
          data: {
            ruleId: rule.rule_id,
            name: rule.name,
            type: rule.type,
            pattern: rule.pattern.toString(),
            action: rule.action,
            reason: rule.reason,
            enabled: rule.enabled
          }
        });
      }
    }
  }
  
  /**
   * Load custom rules from database
   */
  async loadCustomRules() {
    const dbRules = await prisma.filterRule.findMany();
    
    // Merge with default rules
    const customRules = dbRules.filter(
      dbRule => !DEFAULT_FILTER_RULES.some(dr => dr.rule_id === dbRule.ruleId)
    );
    
    for (const dbRule of customRules) {
      this.rules.push({
        rule_id: dbRule.ruleId,
        name: dbRule.name,
        type: dbRule.type,
        pattern: dbRule.pattern,
        action: dbRule.action,
        reason: dbRule.reason,
        enabled: dbRule.enabled
      });
    }
  }
}

// Singleton instance
const contentFilter = new ContentFilter();

module.exports = contentFilter;
