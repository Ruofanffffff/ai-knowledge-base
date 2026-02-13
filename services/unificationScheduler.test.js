const { UnificationScheduler } = require('./unificationScheduler');
const unificationService = require('./unificationService');
const { PrismaClient } = require('@prisma/client');

// Mock dependencies
jest.mock('./unificationService');
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    documentIndex: {
      findMany: jest.fn(),
    },
    unificationLog: {
      findFirst: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

const prisma = new PrismaClient();

describe('UnificationScheduler', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new UnificationScheduler();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
  });

  describe('start() and stop()', () => {
    test('should start the scheduler and set interval', () => {
      scheduler.start();
      expect(scheduler.intervalId).not.toBeNull();
    });

    test('should not start if already running', () => {
      scheduler.start();
      const firstIntervalId = scheduler.intervalId;
      scheduler.start();
      expect(scheduler.intervalId).toBe(firstIntervalId);
    });

    test('should stop the scheduler and clear interval', () => {
      scheduler.start();
      expect(scheduler.intervalId).not.toBeNull();
      scheduler.stop();
      expect(scheduler.intervalId).toBeNull();
    });

    test('should call tick immediately on start', async () => {
      const tickSpy = jest.spyOn(scheduler, 'tick').mockResolvedValue();
      scheduler.start();
      expect(tickSpy).toHaveBeenCalledTimes(1);
      tickSpy.mockRestore();
    });

    test('should call tick every hour', async () => {
      const tickSpy = jest.spyOn(scheduler, 'tick').mockResolvedValue();
      scheduler.start();
      
      // Fast-forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(tickSpy).toHaveBeenCalledTimes(2); // Initial + 1 hour
      
      // Fast-forward another hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(tickSpy).toHaveBeenCalledTimes(3); // Initial + 2 hours
      
      tickSpy.mockRestore();
    });
  });

  describe('shouldRunUnification()', () => {
    test('should return true if no previous unification log exists', async () => {
      unificationService.getLatestLog.mockResolvedValue(null);
      
      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(true);
    });

    test('should return true if latest log has no completedAt', async () => {
      unificationService.getLatestLog.mockResolvedValue({
        id: 'log-1',
        status: 'running',
        completedAt: null,
      });
      
      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(true);
    });

    test('should return true if a document has lastPipelineAt after last unification', async () => {
      const lastUnificationTime = new Date('2024-01-01T10:00:00Z');
      unificationService.getLatestLog.mockResolvedValue({
        id: 'log-1',
        status: 'completed',
        completedAt: lastUnificationTime,
      });

      prisma.documentIndex.findMany.mockResolvedValue([
        {
          docId: 'doc-1',
          metadata: JSON.stringify({
            lastPipelineAt: '2024-01-01T11:00:00Z', // After unification
          }),
        },
      ]);

      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(true);
    });

    test('should return false if no documents have been updated since last unification', async () => {
      const lastUnificationTime = new Date('2024-01-01T12:00:00Z');
      unificationService.getLatestLog.mockResolvedValue({
        id: 'log-1',
        status: 'completed',
        completedAt: lastUnificationTime,
      });

      prisma.documentIndex.findMany.mockResolvedValue([
        {
          docId: 'doc-1',
          metadata: JSON.stringify({
            lastPipelineAt: '2024-01-01T10:00:00Z', // Before unification
          }),
        },
        {
          docId: 'doc-2',
          metadata: JSON.stringify({
            lastPipelineAt: '2024-01-01T11:00:00Z', // Before unification
          }),
        },
      ]);

      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(false);
    });

    test('should return false if documents have no lastPipelineAt', async () => {
      const lastUnificationTime = new Date('2024-01-01T12:00:00Z');
      unificationService.getLatestLog.mockResolvedValue({
        id: 'log-1',
        status: 'completed',
        completedAt: lastUnificationTime,
      });

      prisma.documentIndex.findMany.mockResolvedValue([
        {
          docId: 'doc-1',
          metadata: JSON.stringify({}),
        },
      ]);

      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(false);
    });

    test('should handle invalid metadata JSON gracefully', async () => {
      const lastUnificationTime = new Date('2024-01-01T12:00:00Z');
      unificationService.getLatestLog.mockResolvedValue({
        id: 'log-1',
        status: 'completed',
        completedAt: lastUnificationTime,
      });

      prisma.documentIndex.findMany.mockResolvedValue([
        {
          docId: 'doc-1',
          metadata: 'invalid json',
        },
        {
          docId: 'doc-2',
          metadata: JSON.stringify({
            lastPipelineAt: '2024-01-01T13:00:00Z', // After unification
          }),
        },
      ]);

      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(true); // Should still find doc-2
    });

    test('should return false on error', async () => {
      unificationService.getLatestLog.mockRejectedValue(new Error('Database error'));
      
      const result = await scheduler.shouldRunUnification();
      expect(result).toBe(false);
    });
  });

  describe('tick()', () => {
    test('should call runUnification if shouldRunUnification returns true', async () => {
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);
      unificationService.runUnification.mockResolvedValue({
        entityCount: 10,
        relationCount: 15,
      });

      await scheduler.tick();

      expect(unificationService.runUnification).toHaveBeenCalledWith('scheduler');
    });

    test('should not call runUnification if shouldRunUnification returns false', async () => {
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(false);

      await scheduler.tick();

      expect(unificationService.runUnification).not.toHaveBeenCalled();
    });

    test('should not run concurrently', async () => {
      // Use real timers for this test
      jest.useRealTimers();
      
      const shouldRunSpy = jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);
      
      let callCount = 0;
      unificationService.runUnification.mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => {
          setTimeout(() => resolve({ entityCount: 5, relationCount: 3 }), 50);
        });
      });

      // Start first tick
      const tick1Promise = scheduler.tick();
      
      // Wait a tiny bit to ensure first tick has set isRunning
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Try to start second tick while first is running
      const tick2Promise = scheduler.tick();
      
      await Promise.all([tick1Promise, tick2Promise]);

      // Should only call runUnification once (second tick should be skipped due to isRunning flag)
      expect(callCount).toBe(1);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    test('should handle errors gracefully', async () => {
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);
      unificationService.runUnification.mockRejectedValue(new Error('Unification failed'));

      await expect(scheduler.tick()).resolves.not.toThrow();
      expect(scheduler.isRunning).toBe(false);
    });

    test('should reset isRunning flag after completion', async () => {
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);
      unificationService.runUnification.mockResolvedValue({
        entityCount: 10,
        relationCount: 15,
      });

      expect(scheduler.isRunning).toBe(false);
      await scheduler.tick();
      expect(scheduler.isRunning).toBe(false);
    });

    test('should reset isRunning flag after error', async () => {
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);
      unificationService.runUnification.mockRejectedValue(new Error('Test error'));

      expect(scheduler.isRunning).toBe(false);
      await scheduler.tick();
      expect(scheduler.isRunning).toBe(false);
    });
  });
});
