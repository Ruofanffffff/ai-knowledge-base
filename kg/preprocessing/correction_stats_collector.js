/**
 * Correction Statistics Collector
 * 
 * 收集和记录矫正统计信息
 * 
 * 核心功能：
 * 1. 记录矫正操作到数据库
 * 2. 收集各阶段的统计信息
 * 3. 计算准确率提升指标
 * 4. 提供统计查询接口
 * 
 * Requirements: 2.3, 3.5, 4.4, 5.4, 6.5, 9.2
 */

const { PrismaClient } = require('@prisma/client');
const preprocessingMonitor = require('./preprocessing_monitor');

class CorrectionStatsCollector {
  constructor(options = {}) {
    this.prisma = options.prisma || new PrismaClient();
    this.enablePersistence = options.enablePersistence !== false; // 默认启用持久化
    
    // 内存缓存，用于批量写入和快速查询
    this.cache = new Map(); // docId -> stage -> corrections[]
    this.statsCache = new Map(); // docId -> stage -> stats
    
    console.log(`[Stats Collector] Initialized with persistence=${this.enablePersistence}`);
  }
  
  /**
   * 记录矫正操作
   * 
   * @param {string} docId - 文档ID
   * @param {string} stage - 处理阶段 (cbk_correction, field_correction, schema_correction, merge_correction, relation_correction)
   * @param {Object} correction - 矫正信息
   * @param {string} correction.type - 矫正类型 (supplement, filter, verify, adjust)
   * @param {*} correction.originalValue - 原始值
   * @param {*} correction.correctedValue - 矫正后的值
   * @param {number} correction.confidenceBefore - 矫正前置信度
   * @param {number} correction.confidenceAfter - 矫正后置信度
   * @param {Object} correction.metadata - 额外元数据
   * @returns {Promise<Object>} 记录结果
   */
  async recordCorrection(docId, stage, correction) {
    if (!docId || !stage || !correction) {
      console.warn('[Stats Collector] Missing required parameters for recordCorrection');
      return { success: false, error: 'Missing parameters' };
    }
    
    try {
      // 添加到内存缓存
      this._addToCache(docId, stage, correction);
      
      // 如果启用持久化，写入数据库
      if (this.enablePersistence) {
        const record = await this.prisma.correctionRecord.create({
          data: {
            docId,
            stage,
            correctionType: correction.type || 'adjust',
            originalValue: this._serializeValue(correction.originalValue),
            correctedValue: this._serializeValue(correction.correctedValue),
            confidenceBefore: correction.confidenceBefore,
            confidenceAfter: correction.confidenceAfter,
            metadata: this._serializeValue(correction.metadata)
          }
        });
        
        console.log(`[Stats Collector] Recorded correction: doc=${docId}, stage=${stage}, type=${correction.type}`);
        
        return { success: true, recordId: record.id };
      }
      
      return { success: true, cached: true };
    } catch (error) {
      console.error('[Stats Collector] Failed to record correction:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 批量记录矫正操作
   * 
   * @param {string} docId - 文档ID
   * @param {string} stage - 处理阶段
   * @param {Array} corrections - 矫正信息数组
   * @returns {Promise<Object>} 记录结果
   */
  async recordCorrections(docId, stage, corrections) {
    if (!corrections || corrections.length === 0) {
      return { success: true, count: 0 };
    }
    
    const startTime = Date.now();
    
    try {
      console.log(`[Stats Collector] Recording ${corrections.length} corrections for doc=${docId}, stage=${stage}`);
      
      // 添加到内存缓存
      corrections.forEach(correction => {
        this._addToCache(docId, stage, correction);
      });
      
      // 如果启用持久化，批量写入数据库
      if (this.enablePersistence) {
        const records = corrections.map(correction => ({
          docId,
          stage,
          correctionType: correction.type || 'adjust',
          originalValue: this._serializeValue(correction.originalValue),
          correctedValue: this._serializeValue(correction.correctedValue),
          confidenceBefore: correction.confidenceBefore,
          confidenceAfter: correction.confidenceAfter,
          metadata: this._serializeValue(correction.metadata)
        }));
        
        await this.prisma.correctionRecord.createMany({
          data: records
        });
        
        console.log(`[Stats Collector] Recorded ${corrections.length} corrections to database`);
      }
      
      const duration = Date.now() - startTime;
      
      // Record to preprocessing monitor
      preprocessingMonitor.recordCorrection({
        doc_id: docId,
        stage,
        duration,
        corrections_made: corrections.length,
        items_processed: corrections.length,
        success: true
      });
      
      return { success: true, count: corrections.length };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[Stats Collector] Failed to record corrections:', error.message);
      
      // Record failure
      preprocessingMonitor.recordCorrection({
        doc_id: docId,
        stage,
        duration,
        corrections_made: 0,
        items_processed: corrections.length,
        success: false,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 更新统计信息
   * 
   * @param {string} docId - 文档ID
   * @param {string} stage - 处理阶段
   * @param {Object} stats - 统计信息
   * @param {number} stats.totalCorrections - 总矫正次数
   * @param {number} stats.accuracyBefore - 矫正前准确率
   * @param {number} stats.accuracyAfter - 矫正后准确率
   * @param {number} stats.recallBefore - 矫正前召回率
   * @param {number} stats.recallAfter - 矫正后召回率
   * @param {number} stats.precisionBefore - 矫正前精确率
   * @param {number} stats.precisionAfter - 矫正后精确率
   * @param {Object} stats.metadata - 额外指标
   * @returns {Promise<Object>} 更新结果
   */
  async updateStats(docId, stage, stats) {
    if (!docId || !stage || !stats) {
      console.warn('[Stats Collector] Missing required parameters for updateStats');
      return { success: false, error: 'Missing parameters' };
    }
    
    try {
      // 更新内存缓存
      this._updateStatsCache(docId, stage, stats);
      
      // 如果启用持久化，写入数据库
      if (this.enablePersistence) {
        // 使用upsert确保幂等性
        const record = await this.prisma.correctionStats.upsert({
          where: {
            docId_stage: {
              docId,
              stage
            }
          },
          update: {
            totalCorrections: stats.totalCorrections,
            accuracyBefore: stats.accuracyBefore,
            accuracyAfter: stats.accuracyAfter,
            recallBefore: stats.recallBefore,
            recallAfter: stats.recallAfter,
            precisionBefore: stats.precisionBefore,
            precisionAfter: stats.precisionAfter,
            metadata: this._serializeValue(stats.metadata)
          },
          create: {
            docId,
            stage,
            totalCorrections: stats.totalCorrections || 0,
            accuracyBefore: stats.accuracyBefore,
            accuracyAfter: stats.accuracyAfter,
            recallBefore: stats.recallBefore,
            recallAfter: stats.recallAfter,
            precisionBefore: stats.precisionBefore,
            precisionAfter: stats.precisionAfter,
            metadata: this._serializeValue(stats.metadata)
          }
        });
        
        console.log(`[Stats Collector] Updated stats: doc=${docId}, stage=${stage}`);
        
        return { success: true, statsId: record.id };
      }
      
      return { success: true, cached: true };
    } catch (error) {
      console.error('[Stats Collector] Failed to update stats:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 获取文档的矫正统计
   * 
   * @param {string} docId - 文档ID
   * @param {string} stage - 处理阶段（可选，不指定则返回所有阶段）
   * @returns {Promise<Object>} 统计信息
   */
  async getStats(docId, stage = null) {
    if (!docId) {
      console.warn('[Stats Collector] Missing docId for getStats');
      return null;
    }
    
    try {
      // 优先从缓存读取
      if (stage) {
        const cached = this._getStatsFromCache(docId, stage);
        if (cached) {
          return cached;
        }
      }
      
      // 从数据库读取
      if (this.enablePersistence) {
        const where = { docId };
        if (stage) {
          where.stage = stage;
        }
        
        const records = await this.prisma.correctionStats.findMany({
          where,
          orderBy: { stage: 'asc' }
        });
        
        if (stage) {
          return records[0] ? this._deserializeStats(records[0]) : null;
        }
        
        // 返回所有阶段的统计
        const allStats = {};
        records.forEach(record => {
          allStats[record.stage] = this._deserializeStats(record);
        });
        
        return allStats;
      }
      
      // 从缓存返回
      if (stage) {
        return this._getStatsFromCache(docId, stage);
      }
      
      const allStats = {};
      const docCache = this.statsCache.get(docId);
      if (docCache) {
        docCache.forEach((stats, stageKey) => {
          allStats[stageKey] = stats;
        });
      }
      
      return allStats;
    } catch (error) {
      console.error('[Stats Collector] Failed to get stats:', error.message);
      return null;
    }
  }
  
  /**
   * 获取矫正记录
   * 
   * @param {string} docId - 文档ID
   * @param {string} stage - 处理阶段（可选）
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 矫正记录列表
   */
  async getCorrections(docId, stage = null, options = {}) {
    if (!docId) {
      console.warn('[Stats Collector] Missing docId for getCorrections');
      return [];
    }
    
    try {
      // 优先从缓存读取
      const cached = this._getCorrectionsFromCache(docId, stage);
      if (cached.length > 0) {
        return cached;
      }
      
      // 从数据库读取
      if (this.enablePersistence) {
        const where = { docId };
        if (stage) {
          where.stage = stage;
        }
        
        const records = await this.prisma.correctionRecord.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options.limit || 100
        });
        
        return records.map(record => this._deserializeCorrection(record));
      }
      
      return cached;
    } catch (error) {
      console.error('[Stats Collector] Failed to get corrections:', error.message);
      return [];
    }
  }
  
  /**
   * 计算准确率提升
   * 
   * @param {string} stage - 处理阶段
   * @param {Object} options - 计算选项
   * @returns {Promise<Object>} 准确率指标
   */
  async calculateAccuracyImprovement(stage, options = {}) {
    if (!stage) {
      console.warn('[Stats Collector] Missing stage for calculateAccuracyImprovement');
      return null;
    }
    
    try {
      if (!this.enablePersistence) {
        console.warn('[Stats Collector] Persistence disabled, cannot calculate accuracy improvement');
        return null;
      }
      
      // 从数据库聚合统计
      const stats = await this.prisma.correctionStats.findMany({
        where: { stage },
        select: {
          accuracyBefore: true,
          accuracyAfter: true,
          recallBefore: true,
          recallAfter: true,
          precisionBefore: true,
          precisionAfter: true,
          totalCorrections: true
        }
      });
      
      if (stats.length === 0) {
        return {
          stage,
          count: 0,
          avgAccuracyBefore: 0,
          avgAccuracyAfter: 0,
          accuracyImprovement: 0,
          avgRecallBefore: 0,
          avgRecallAfter: 0,
          recallImprovement: 0,
          avgPrecisionBefore: 0,
          avgPrecisionAfter: 0,
          precisionImprovement: 0,
          totalCorrections: 0
        };
      }
      
      // 计算平均值
      const count = stats.length;
      const sum = stats.reduce((acc, s) => {
        acc.accuracyBefore += s.accuracyBefore || 0;
        acc.accuracyAfter += s.accuracyAfter || 0;
        acc.recallBefore += s.recallBefore || 0;
        acc.recallAfter += s.recallAfter || 0;
        acc.precisionBefore += s.precisionBefore || 0;
        acc.precisionAfter += s.precisionAfter || 0;
        acc.totalCorrections += s.totalCorrections || 0;
        return acc;
      }, {
        accuracyBefore: 0,
        accuracyAfter: 0,
        recallBefore: 0,
        recallAfter: 0,
        precisionBefore: 0,
        precisionAfter: 0,
        totalCorrections: 0
      });
      
      const avgAccuracyBefore = sum.accuracyBefore / count;
      const avgAccuracyAfter = sum.accuracyAfter / count;
      const avgRecallBefore = sum.recallBefore / count;
      const avgRecallAfter = sum.recallAfter / count;
      const avgPrecisionBefore = sum.precisionBefore / count;
      const avgPrecisionAfter = sum.precisionAfter / count;
      
      return {
        stage,
        count,
        avgAccuracyBefore: parseFloat(avgAccuracyBefore.toFixed(4)),
        avgAccuracyAfter: parseFloat(avgAccuracyAfter.toFixed(4)),
        accuracyImprovement: parseFloat((avgAccuracyAfter - avgAccuracyBefore).toFixed(4)),
        avgRecallBefore: parseFloat(avgRecallBefore.toFixed(4)),
        avgRecallAfter: parseFloat(avgRecallAfter.toFixed(4)),
        recallImprovement: parseFloat((avgRecallAfter - avgRecallBefore).toFixed(4)),
        avgPrecisionBefore: parseFloat(avgPrecisionBefore.toFixed(4)),
        avgPrecisionAfter: parseFloat(avgPrecisionAfter.toFixed(4)),
        precisionImprovement: parseFloat((avgPrecisionAfter - avgPrecisionBefore).toFixed(4)),
        totalCorrections: sum.totalCorrections
      };
    } catch (error) {
      console.error('[Stats Collector] Failed to calculate accuracy improvement:', error.message);
      return null;
    }
  }
  
  /**
   * 获取所有阶段的准确率提升汇总
   * 
   * @returns {Promise<Object>} 所有阶段的准确率指标
   */
  async getAllStageImprovements() {
    const stages = [
      'cbk_correction',
      'field_correction',
      'schema_correction',
      'merge_correction',
      'relation_correction'
    ];
    
    const improvements = {};
    
    for (const stage of stages) {
      improvements[stage] = await this.calculateAccuracyImprovement(stage);
    }
    
    return improvements;
  }
  
  /**
   * 清除缓存
   * 
   * @param {string} docId - 文档ID（可选，不指定则清除所有）
   */
  clearCache(docId = null) {
    if (docId) {
      this.cache.delete(docId);
      this.statsCache.delete(docId);
      console.log(`[Stats Collector] Cleared cache for doc=${docId}`);
    } else {
      this.cache.clear();
      this.statsCache.clear();
      console.log('[Stats Collector] Cleared all cache');
    }
  }
  
  /**
   * 添加到内存缓存
   * @private
   */
  _addToCache(docId, stage, correction) {
    if (!this.cache.has(docId)) {
      this.cache.set(docId, new Map());
    }
    
    const docCache = this.cache.get(docId);
    if (!docCache.has(stage)) {
      docCache.set(stage, []);
    }
    
    docCache.get(stage).push({
      ...correction,
      timestamp: new Date()
    });
  }
  
  /**
   * 更新统计缓存
   * @private
   */
  _updateStatsCache(docId, stage, stats) {
    if (!this.statsCache.has(docId)) {
      this.statsCache.set(docId, new Map());
    }
    
    this.statsCache.get(docId).set(stage, {
      ...stats,
      updatedAt: new Date()
    });
  }
  
  /**
   * 从缓存获取统计
   * @private
   */
  _getStatsFromCache(docId, stage) {
    const docCache = this.statsCache.get(docId);
    if (!docCache) {
      return null;
    }
    
    return docCache.get(stage) || null;
  }
  
  /**
   * 从缓存获取矫正记录
   * @private
   */
  _getCorrectionsFromCache(docId, stage = null) {
    const docCache = this.cache.get(docId);
    if (!docCache) {
      return [];
    }
    
    if (stage) {
      return docCache.get(stage) || [];
    }
    
    // 返回所有阶段的矫正记录
    const allCorrections = [];
    docCache.forEach((corrections, stageKey) => {
      allCorrections.push(...corrections.map(c => ({ ...c, stage: stageKey })));
    });
    
    return allCorrections;
  }
  
  /**
   * 序列化值为JSON字符串
   * @private
   */
  _serializeValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error('[Stats Collector] Failed to serialize value:', error.message);
      return String(value);
    }
  }
  
  /**
   * 反序列化统计记录
   * @private
   */
  _deserializeStats(record) {
    return {
      id: record.id,
      docId: record.docId,
      stage: record.stage,
      totalCorrections: record.totalCorrections,
      accuracyBefore: record.accuracyBefore,
      accuracyAfter: record.accuracyAfter,
      recallBefore: record.recallBefore,
      recallAfter: record.recallAfter,
      precisionBefore: record.precisionBefore,
      precisionAfter: record.precisionAfter,
      metadata: this._deserializeValue(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
  
  /**
   * 反序列化矫正记录
   * @private
   */
  _deserializeCorrection(record) {
    return {
      id: record.id,
      docId: record.docId,
      stage: record.stage,
      type: record.correctionType,
      originalValue: this._deserializeValue(record.originalValue),
      correctedValue: this._deserializeValue(record.correctedValue),
      confidenceBefore: record.confidenceBefore,
      confidenceAfter: record.confidenceAfter,
      metadata: this._deserializeValue(record.metadata),
      createdAt: record.createdAt
    };
  }
  
  /**
   * 反序列化JSON字符串
   * @private
   */
  _deserializeValue(value) {
    if (!value) {
      return null;
    }
    
    if (typeof value !== 'string') {
      return value;
    }
    
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }
  
  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      console.log('[Stats Collector] Database connection closed');
    }
  }
}

module.exports = CorrectionStatsCollector;
