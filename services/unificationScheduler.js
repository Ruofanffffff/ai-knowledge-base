const unificationService = require('./unificationService');
const themeDiscoveryEngine = require('./themeDiscoveryEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * UnificationScheduler
 * 定时检查器：每小时检查一次统一归纳，每小时执行一次主题发现
 * 两个 tick 共享调度器实例但独立计时，通过 _tickLock 确保串行执行
 */
class UnificationScheduler {
  constructor() {
    this.intervalId = null;
    this.themeDiscoveryIntervalId = null;
    this.isRunning = false;
    this._tickLock = false;
    this._isDiscoveryRunning = false;
    // 默认每小时检查一次（3600000 毫秒）
    this.intervalMs = 60 * 60 * 1000;
    // 主题发现每1小时执行一次
    this.themeDiscoveryIntervalMs = 60 * 60 * 1000;
  }

  /**
   * 启动定时检查器（统一归纳每小时，主题发现每小时）
   */
  start() {
    if (this.intervalId) {
      console.log('[UnificationScheduler] Already running');
      return;
    }

    console.log('[UnificationScheduler] Starting scheduler (unification every hour, theme discovery every hour)');
    
    // 立即执行一次统一归纳检查
    this.tick();
    
    // 启动时立即执行一次主题发现检查
    this.themeDiscoveryTick();
    
    // 设置统一归纳定时器
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.intervalMs);

    // 设置主题发现定时器（1小时）
    this.themeDiscoveryIntervalId = setInterval(() => {
      this.themeDiscoveryTick();
    }, this.themeDiscoveryIntervalMs);
  }

  /**
   * 停止定时检查器
   */
  stop() {
    if (this.intervalId) {
      console.log('[UnificationScheduler] Stopping scheduler');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.themeDiscoveryIntervalId) {
      clearInterval(this.themeDiscoveryIntervalId);
      this.themeDiscoveryIntervalId = null;
    }
  }

  /**
   * 检查是否需要执行统一归纳
   * 条件：距上次归纳后有新文档上传/更新
   * @returns {Promise<boolean>}
   */
  async shouldRunUnification() {
    try {
      // 获取最近一次归纳记录
      const latestLog = await unificationService.getLatestLog();
      
      // 如果从未执行过归纳，则需要执行
      if (!latestLog || !latestLog.completedAt) {
        console.log('[UnificationScheduler] No previous unification found, should run');
        return true;
      }

      const lastUnificationTime = latestLog.completedAt;

      // 查询所有 DocumentIndex，检查是否有 lastPipelineAt 晚于上次归纳时间的文档
      const documentIndexes = await prisma.documentIndex.findMany({
        select: {
          docId: true,
          metadata: true,
        },
      });

      // 检查是否有任何文档的 lastPipelineAt 晚于上次归纳时间
      for (const docIndex of documentIndexes) {
        try {
          const metadata = JSON.parse(docIndex.metadata || '{}');
          const lastPipelineAt = metadata.lastPipelineAt;
          
          if (lastPipelineAt) {
            const pipelineTime = new Date(lastPipelineAt);
            if (pipelineTime > lastUnificationTime) {
              console.log(`[UnificationScheduler] Found updated document: ${docIndex.docId}, should run`);
              return true;
            }
          }
        } catch (error) {
          console.error(`[UnificationScheduler] Error parsing metadata for docId ${docIndex.docId}:`, error);
          // 继续检查其他文档
        }
      }

      console.log('[UnificationScheduler] No new documents since last unification, skipping');
      return false;
    } catch (error) {
      console.error('[UnificationScheduler] Error in shouldRunUnification:', error);
      return false;
    }
  }

  /**
   * 获取 tick 锁，确保统一归纳和主题发现串行执行
   * @returns {boolean} 是否成功获取锁
   */
  _acquireTickLock() {
    if (this._tickLock) {
      return false;
    }
    this._tickLock = true;
    return true;
  }

  /**
   * 释放 tick 锁
   */
  _releaseTickLock() {
    this._tickLock = false;
  }

  /**
   * 执行一次检查并按需触发归纳
   */
  async tick() {
    // 防止并发执行（自身并发防护）
    if (this.isRunning) {
      console.log('[UnificationScheduler] Unification already running, skipping tick');
      return;
    }

    // 获取全局 tick 锁，确保与主题发现串行执行
    if (!this._acquireTickLock()) {
      console.log('[UnificationScheduler] Tick lock held (theme discovery running), skipping unification tick');
      return;
    }

    try {
      console.log('[UnificationScheduler] Tick: checking if unification needed');
      
      const shouldRun = await this.shouldRunUnification();
      
      if (shouldRun) {
        this.isRunning = true;
        console.log('[UnificationScheduler] Triggering unification...');
        
        const result = await unificationService.runUnification('scheduler');
        
        console.log('[UnificationScheduler] Unification completed:', result);
      } else {
        console.log('[UnificationScheduler] Skipping unification (no changes)');
      }
    } catch (error) {
      console.error('[UnificationScheduler] Error during tick:', error);
    } finally {
      this.isRunning = false;
      this._releaseTickLock();
    }
  }

  /**
   * 执行一次主题发现 tick
   * 与统一归纳 tick 串行执行，通过 _tickLock 防止并发
   * 如果已有发现任务在执行，拒绝新请求并返回当前执行状态
   * @returns {Promise<object>} 发现结果或拒绝状态
   */
  async themeDiscoveryTick() {
    // 并发防护：如果已有发现任务在执行，拒绝新请求
    if (this._isDiscoveryRunning) {
      console.log('[UnificationScheduler] Theme discovery already running, rejecting new request');
      return {
        status: 'rejected',
        reason: 'Theme discovery is already running',
        isDiscoveryRunning: true
      };
    }

    // 获取全局 tick 锁，确保与统一归纳串行执行
    if (!this._acquireTickLock()) {
      console.log('[UnificationScheduler] Tick lock held (unification running), skipping theme discovery tick');
      return {
        status: 'skipped',
        reason: 'Unification tick is currently running'
      };
    }

    this._isDiscoveryRunning = true;

    try {
      console.log('[UnificationScheduler] Theme discovery tick: starting discovery...');
      
      const result = await themeDiscoveryEngine.discover('scheduler');
      
      console.log('[UnificationScheduler] Theme discovery completed:', result);
      return result;
    } catch (error) {
      console.error('[UnificationScheduler] Error during theme discovery tick:', error);
      return {
        status: 'error',
        reason: error.message
      };
    } finally {
      this._isDiscoveryRunning = false;
      this._releaseTickLock();
    }
  }
}

module.exports = new UnificationScheduler();
module.exports.UnificationScheduler = UnificationScheduler;
