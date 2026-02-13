const unificationService = require('./unificationService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * UnificationScheduler
 * 定时检查器：每小时检查一次，若有新文档变更则触发统一归纳
 */
class UnificationScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    // 默认每小时检查一次（3600000 毫秒）
    this.intervalMs = 60 * 60 * 1000;
  }

  /**
   * 启动定时检查器（每小时一次）
   */
  start() {
    if (this.intervalId) {
      console.log('[UnificationScheduler] Already running');
      return;
    }

    console.log('[UnificationScheduler] Starting scheduler (checking every hour)');
    
    // 立即执行一次检查
    this.tick();
    
    // 设置定时器
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.intervalMs);
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
   * 执行一次检查并按需触发归纳
   */
  async tick() {
    // 防止并发执行
    if (this.isRunning) {
      console.log('[UnificationScheduler] Unification already running, skipping tick');
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
    }
  }
}

module.exports = new UnificationScheduler();
module.exports.UnificationScheduler = UnificationScheduler;
