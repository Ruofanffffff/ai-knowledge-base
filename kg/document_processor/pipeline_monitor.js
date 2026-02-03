/**
 * Pipeline Monitor
 * 
 * Monitors document processing pipeline
 * Records processing stages, identifies bottlenecks, and tracks performance
 */

const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Processing stages
const STAGES = {
  STRUCTURE_ANALYSIS: 'structure_analysis',
  CONTENT_FILTERING: 'content_filtering',
  CKB_PARSING: 'ckb_parsing',
  FIELD_EXTRACTION: 'field_extraction',
  SCHEMA_MATCHING: 'schema_matching',
  ENTITY_BUILDING: 'entity_building',
  RELATION_BUILDING: 'relation_building',
  COMPLETENESS_VALIDATION: 'completeness_validation',
  REPORT_GENERATION: 'report_generation'
};

// Timeout thresholds (in milliseconds)
const TIMEOUT_THRESHOLDS = {
  [STAGES.STRUCTURE_ANALYSIS]: 60000,      // 1 minute
  [STAGES.CONTENT_FILTERING]: 30000,       // 30 seconds
  [STAGES.CKB_PARSING]: 180000,            // 3 minutes
  [STAGES.FIELD_EXTRACTION]: 300000,       // 5 minutes
  [STAGES.SCHEMA_MATCHING]: 120000,        // 2 minutes
  [STAGES.ENTITY_BUILDING]: 120000,        // 2 minutes
  [STAGES.RELATION_BUILDING]: 180000,      // 3 minutes
  [STAGES.COMPLETENESS_VALIDATION]: 30000, // 30 seconds
  [STAGES.REPORT_GENERATION]: 30000        // 30 seconds
};

class PipelineMonitor {
  /**
   * Start monitoring a document processing
   * @param {string} docId - Document ID
   * @returns {Promise<string>} Monitor ID
   */
  async startMonitoring(docId) {
    const monitorId = uuidv4();
    
    await prisma.processingMonitor.create({
      data: {
        monitorId: monitorId,
        docId: docId,
        startTime: new Date(),
        stages: JSON.stringify([])
      }
    });
    
    return monitorId;
  }
  
  /**
   * Record a processing stage
   * @param {string} monitorId - Monitor ID
   * @param {string} stageName - Stage name
   * @param {string} status - Status: 'started' | 'completed' | 'failed'
   * @param {Object} metadata - Additional metadata
   */
  async recordStage(monitorId, stageName, status, metadata = {}) {
    const monitor = await prisma.processingMonitor.findUnique({
      where: { monitorId: monitorId }
    });
    
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not found`);
    }
    
    const stages = JSON.parse(monitor.stages || '[]');
    let stageRecord = stages.find(s => s.stage_name === stageName);
    
    if (!stageRecord) {
      stageRecord = {
        stage_name: stageName,
        start_time: new Date().toISOString(),
        end_time: null,
        duration_ms: null,
        status: 'started',
        error_message: null,
        metadata: {}
      };
      stages.push(stageRecord);
    }
    
    if (status === 'completed' || status === 'failed') {
      stageRecord.end_time = new Date().toISOString();
      stageRecord.duration_ms = new Date(stageRecord.end_time) - new Date(stageRecord.start_time);
      stageRecord.status = status;
      
      if (status === 'failed' && metadata.error) {
        stageRecord.error_message = metadata.error;
      }
      
      // Check for timeout
      const threshold = TIMEOUT_THRESHOLDS[stageName] || 300000;
      if (stageRecord.duration_ms > threshold) {
        // Import alertManager dynamically to avoid circular dependency
        const alertManager = require('./alert_manager');
        await alertManager.trigger('processing_timeout', {
          monitor_id: monitorId,
          stage: stageName,
          duration_ms: stageRecord.duration_ms,
          threshold_ms: threshold
        });
      }
    }
    
    stageRecord.metadata = { ...stageRecord.metadata, ...metadata };
    
    // Update monitor
    const updateData = {
      stages: JSON.stringify(stages)
    };
    
    // If all stages completed, set end time
    if (stages.every(s => s.status === 'completed' || s.status === 'failed')) {
      updateData.endTime = new Date();
    }
    
    await prisma.processingMonitor.update({
      where: { monitorId: monitorId },
      data: updateData
    });
  }
  
  /**
   * Get processing progress
   * @param {string} monitorId - Monitor ID
   * @returns {Promise<Object>} ProcessingProgress
   */
  async getProgress(monitorId) {
    const monitor = await prisma.processingMonitor.findUnique({
      where: { monitorId: monitorId }
    });
    
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not found`);
    }
    
    const stages = JSON.parse(monitor.stages || '[]');
    const completedStages = stages.filter(s => s.status === 'completed').map(s => s.stage_name);
    const currentStage = stages.find(s => s.status === 'started');
    const totalStages = Object.keys(STAGES).length;
    
    const progressPercentage = (completedStages.length / totalStages) * 100;
    
    // Estimate remaining time based on average stage duration
    let estimatedRemainingTime = null;
    if (completedStages.length > 0 && completedStages.length < totalStages) {
      const avgDuration = stages
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + s.duration_ms, 0) / completedStages.length;
      
      const remainingStages = totalStages - completedStages.length;
      estimatedRemainingTime = avgDuration * remainingStages;
    }
    
    return {
      monitor_id: monitorId,
      doc_id: monitor.docId,
      current_stage: currentStage ? currentStage.stage_name : null,
      completed_stages: completedStages,
      total_stages: totalStages,
      progress_percentage: progressPercentage,
      estimated_remaining_time_ms: estimatedRemainingTime
    };
  }
  
  /**
   * Identify processing bottleneck
   * @param {string} monitorId - Monitor ID
   * @returns {Promise<Object>} BottleneckAnalysis
   */
  async identifyBottleneck(monitorId) {
    const monitor = await prisma.processingMonitor.findUnique({
      where: { monitorId: monitorId }
    });
    
    if (!monitor) {
      return null;
    }
    
    const stages = JSON.parse(monitor.stages || '[]');
    const completedStages = stages.filter(s => s.status === 'completed');
    
    if (completedStages.length === 0) {
      return null;
    }
    
    const slowestStage = completedStages.reduce((prev, current) => 
      (current.duration_ms > prev.duration_ms) ? current : prev
    );
    
    const totalDuration = completedStages.reduce((sum, s) => sum + s.duration_ms, 0);
    const percentage = (slowestStage.duration_ms / totalDuration) * 100;
    
    const recommendations = this.generateBottleneckRecommendations(slowestStage);
    
    return {
      slowest_stage: slowestStage.stage_name,
      duration_ms: slowestStage.duration_ms,
      percentage_of_total: percentage,
      recommendations
    };
  }
  
  /**
   * Generate bottleneck recommendations
   * @param {Object} stage - Stage record
   * @returns {Array} Recommendations
   */
  generateBottleneckRecommendations(stage) {
    const recommendations = [];
    
    switch (stage.stage_name) {
      case STAGES.STRUCTURE_ANALYSIS:
        recommendations.push('优化文档解析器性能');
        recommendations.push('考虑使用更快的解析库');
        break;
      
      case STAGES.CKB_PARSING:
        recommendations.push('对大文档启用分段处理');
        recommendations.push('优化 CKB 生成逻辑');
        break;
      
      case STAGES.FIELD_EXTRACTION:
        recommendations.push('优化字段抽取规则');
        recommendations.push('减少 LLM 调用频率');
        recommendations.push('增加字段抽取缓存');
        break;
      
      case STAGES.SCHEMA_MATCHING:
        recommendations.push('优化 Schema 匹配算法');
        recommendations.push('添加 Schema 索引');
        recommendations.push('并行计算完整度评分');
        break;
      
      case STAGES.ENTITY_BUILDING:
        recommendations.push('优化实体构建逻辑');
        recommendations.push('批量处理实体');
        break;
      
      case STAGES.RELATION_BUILDING:
        recommendations.push('优化关系抽取算法');
        recommendations.push('减少语义关系 LLM 调用');
        break;
      
      default:
        recommendations.push('检查该阶段的实现逻辑');
    }
    
    return recommendations;
  }
  
  /**
   * Export monitoring data
   * @param {string} monitorId - Monitor ID
   * @param {string} format - Format: 'json' | 'csv'
   * @returns {Promise<string>} Exported data
   */
  async exportMonitoringData(monitorId, format = 'json') {
    const monitor = await prisma.processingMonitor.findUnique({
      where: { monitorId: monitorId }
    });
    
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not found`);
    }
    
    const stages = JSON.parse(monitor.stages || '[]');
    
    if (format === 'json') {
      return JSON.stringify({
        monitor_id: monitor.monitorId,
        doc_id: monitor.docId,
        start_time: monitor.startTime,
        end_time: monitor.endTime,
        stages: stages
      }, null, 2);
    } else if (format === 'csv') {
      let csv = 'Stage,Status,Start Time,End Time,Duration (ms),Error\n';
      for (const stage of stages) {
        csv += `${stage.stage_name},${stage.status},${stage.start_time},${stage.end_time || ''},${stage.duration_ms || ''},${stage.error_message || ''}\n`;
      }
      return csv;
    }
    
    throw new Error(`Unsupported format: ${format}`);
  }
  
  /**
   * End monitoring for a document
   * @param {string} monitorId - Monitor ID
   */
  async endMonitoring(monitorId) {
    await prisma.processingMonitor.update({
      where: { monitorId: monitorId },
      data: {
        endTime: new Date()
      }
    });
    
    console.log(`Monitoring ended for ${monitorId}`);
  }
  
  /**
   * Check pending tasks and recover if needed
   */
  async checkPendingTasks() {
    const pendingMonitors = await prisma.processingMonitor.findMany({
      where: {
        endTime: null,
        startTime: {
          lt: new Date(Date.now() - 3600000) // 1 hour ago
        }
      }
    });
    
    console.log(`Found ${pendingMonitors.length} pending monitors older than 1 hour`);
    
    for (const monitor of pendingMonitors) {
      const stages = JSON.parse(monitor.stages || '[]');
      const lastStage = stages[stages.length - 1];
      
      if (lastStage && lastStage.status === 'started') {
        console.log(`Monitor ${monitor.monitorId} stuck at stage ${lastStage.stage_name}`);
        // Could trigger recovery or alert here
      }
    }
  }
}

// Singleton instance
const pipelineMonitor = new PipelineMonitor();

module.exports = pipelineMonitor;
module.exports.STAGES = STAGES;
