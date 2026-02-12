/**
 * KG监控模块
 * 
 * 负责记录和统计知识图谱构建的各项指标
 * 提供监控数据查询和告警触发功能
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class KGMonitor {
  constructor() {
    // 内存中的指标缓存
    this.metrics = {
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      totalBuildTime: 0,
      averageBuildTime: 0,
      lastBuildTime: null,
      currentBuilding: 0
    };
    
    // 告警阈值配置
    this.alertThresholds = {
      failureRate: parseFloat(process.env.KG_ALERT_FAILURE_RATE || '0.1'), // 10%
      avgBuildTime: parseInt(process.env.KG_ALERT_AVG_BUILD_TIME || '300000'), // 5分钟
      queueLength: parseInt(process.env.KG_ALERT_QUEUE_LENGTH || '50')
    };
    
    console.log('[KG Monitor] 监控模块已初始化');
    console.log('[KG Monitor] 告警阈值:', this.alertThresholds);
  }
  
  /**
   * 记录构建开始
   * @param {string} docId - 文档ID
   * @returns {Object} 构建记录
   */
  recordBuildStart(docId) {
    const record = {
      docId,
      startTime: Date.now(),
      status: 'building'
    };
    
    this.metrics.currentBuilding++;
    this.metrics.totalBuilds++;
    
    console.log(`[KG Monitor] 构建开始: ${docId}`);
    
    return record;
  }
  
  /**
   * 记录构建完成
   * @param {string} docId - 文档ID
   * @param {Object} record - 构建记录
   * @param {Object} result - 构建结果
   */
  recordBuildComplete(docId, record, result = {}) {
    const endTime = Date.now();
    const duration = endTime - record.startTime;
    
    this.metrics.currentBuilding--;
    this.metrics.successfulBuilds++;
    this.metrics.totalBuildTime += duration;
    this.metrics.averageBuildTime = this.metrics.totalBuildTime / this.metrics.successfulBuilds;
    this.metrics.lastBuildTime = duration;
    
    console.log(`[KG Monitor] 构建完成: ${docId}, 耗时: ${duration}ms`);
    
    // 检查是否需要告警
    this._checkAlerts();
    
    // 持久化到数据库（异步）
    this._persistMetric({
      doc_id: docId,
      operation: 'build',
      status: 'success',
      duration,
      entity_count: result.entityCount || 0,
      relation_count: result.relationCount || 0,
      timestamp: new Date()
    }).catch(err => {
      console.error('[KG Monitor] 持久化指标失败:', err.message);
    });
  }
  
  /**
   * 记录构建失败
   * @param {string} docId - 文档ID
   * @param {Object} record - 构建记录
   * @param {Error} error - 错误对象
   */
  recordBuildFailure(docId, record, error) {
    const endTime = Date.now();
    const duration = endTime - record.startTime;
    
    this.metrics.currentBuilding--;
    this.metrics.failedBuilds++;
    
    console.log(`[KG Monitor] 构建失败: ${docId}, 耗时: ${duration}ms, 错误: ${error.message}`);
    
    // 检查是否需要告警
    this._checkAlerts();
    
    // 持久化到数据库（异步）
    this._persistMetric({
      doc_id: docId,
      operation: 'build',
      status: 'failed',
      duration,
      error_message: error.message,
      error_category: error.category || 'unknown',
      timestamp: new Date()
    }).catch(err => {
      console.error('[KG Monitor] 持久化指标失败:', err.message);
    });
  }
  
  /**
   * 获取当前指标
   * @returns {Object} 指标数据
   */
  getMetrics() {
    const failureRate = this.metrics.totalBuilds > 0
      ? this.metrics.failedBuilds / this.metrics.totalBuilds
      : 0;
    
    const successRate = this.metrics.totalBuilds > 0
      ? this.metrics.successfulBuilds / this.metrics.totalBuilds
      : 0;
    
    return {
      ...this.metrics,
      failureRate: (failureRate * 100).toFixed(2) + '%',
      successRate: (successRate * 100).toFixed(2) + '%',
      averageBuildTime: Math.round(this.metrics.averageBuildTime)
    };
  }
  
  /**
   * 获取历史统计
   * @param {Object} options - 查询选项
   * @param {Date} options.startDate - 开始日期
   * @param {Date} options.endDate - 结束日期
   * @param {number} options.limit - 限制数量
   * @returns {Promise<Object>} 历史统计数据
   */
  async getHistoricalStats(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 默认7天
      endDate = new Date(),
      limit = 100
    } = options;
    
    try {
      // 从数据库查询历史记录
      const records = await prisma.kGMetric.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      }).catch(() => {
        // 如果表不存在，返回空数组
        return [];
      });
      
      // 计算统计数据
      const stats = {
        totalRecords: records.length,
        successCount: records.filter(r => r.status === 'success').length,
        failureCount: records.filter(r => r.status === 'failed').length,
        averageDuration: 0,
        totalEntities: 0,
        totalRelations: 0
      };
      
      if (records.length > 0) {
        const totalDuration = records.reduce((sum, r) => sum + (r.duration || 0), 0);
        stats.averageDuration = Math.round(totalDuration / records.length);
        stats.totalEntities = records.reduce((sum, r) => sum + (r.entity_count || 0), 0);
        stats.totalRelations = records.reduce((sum, r) => sum + (r.relation_count || 0), 0);
      }
      
      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        stats,
        records: records.slice(0, 10) // 只返回最近10条详细记录
      };
      
    } catch (error) {
      console.error('[KG Monitor] 查询历史统计失败:', error);
      return {
        error: error.message,
        stats: {}
      };
    }
  }
  
  /**
   * 获取实时统计
   * @returns {Object} 实时统计数据
   */
  getRealTimeStats() {
    return {
      currentBuilding: this.metrics.currentBuilding,
      lastBuildTime: this.metrics.lastBuildTime,
      recentMetrics: this.getMetrics(),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 重置指标
   * 用于测试或定期重置
   */
  resetMetrics() {
    console.log('[KG Monitor] 重置指标');
    
    this.metrics = {
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      totalBuildTime: 0,
      averageBuildTime: 0,
      lastBuildTime: null,
      currentBuilding: 0
    };
  }
  
  /**
   * 检查告警条件
   * @private
   */
  _checkAlerts() {
    const metrics = this.getMetrics();
    const alerts = [];
    
    // 检查失败率
    const failureRate = this.metrics.failedBuilds / this.metrics.totalBuilds;
    if (failureRate > this.alertThresholds.failureRate) {
      alerts.push({
        type: 'high_failure_rate',
        severity: 'high',
        message: `构建失败率过高: ${metrics.failureRate}`,
        threshold: `${(this.alertThresholds.failureRate * 100).toFixed(0)}%`,
        current: metrics.failureRate
      });
    }
    
    // 检查平均构建时间
    if (this.metrics.averageBuildTime > this.alertThresholds.avgBuildTime) {
      alerts.push({
        type: 'slow_build_time',
        severity: 'medium',
        message: `平均构建时间过长: ${Math.round(this.metrics.averageBuildTime)}ms`,
        threshold: `${this.alertThresholds.avgBuildTime}ms`,
        current: `${Math.round(this.metrics.averageBuildTime)}ms`
      });
    }
    
    // 如果有告警，触发告警处理
    if (alerts.length > 0) {
      this._triggerAlerts(alerts);
    }
  }
  
  /**
   * 触发告警
   * @private
   * @param {Array} alerts - 告警列表
   */
  _triggerAlerts(alerts) {
    console.warn('[KG Monitor] ⚠️  告警触发:');
    alerts.forEach(alert => {
      console.warn(`  - [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`);
      console.warn(`    阈值: ${alert.threshold}, 当前: ${alert.current}`);
    });
    
    // 这里可以扩展为发送邮件、Slack通知等
    // 例如: sendAlertNotification(alerts);
  }
  
  /**
   * 持久化指标到数据库
   * @private
   * @param {Object} metric - 指标数据
   * @returns {Promise<void>}
   */
  async _persistMetric(metric) {
    try {
      await prisma.kGMetric.create({
        data: metric
      });
    } catch (error) {
      // 如果表不存在，只记录到控制台
      if (error.code === 'P2021' || error.message.includes('does not exist')) {
        console.log('[KG Monitor] 指标表不存在，跳过持久化');
      } else {
        throw error;
      }
    }
  }
}

// 导出单例
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new KGMonitor();
  }
  return instance;
}

module.exports = {
  KGMonitor,
  getInstance
};
