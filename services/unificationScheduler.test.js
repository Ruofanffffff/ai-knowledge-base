const { UnificationScheduler } = require('./unificationScheduler');
const unificationService = require('./unificationService');
const themeDiscoveryEngine = require('./themeDiscoveryEngine');
const { PrismaClient } = require('@prisma/client');

// Mock dependencies
jest.mock('./unificationService');
jest.mock('./themeDiscoveryEngine', () => ({
  discover: jest.fn(),
}));
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

  describe('scheduling intervals', () => {
    test('should have themeDiscoveryIntervalMs set to 1 hour', () => {
      expect(scheduler.themeDiscoveryIntervalMs).toBe(60 * 60 * 1000);
    });

    test('should have intervalMs (unification) set to 1 hour', () => {
      expect(scheduler.intervalMs).toBe(60 * 60 * 1000);
    });
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
      expect(scheduler.themeDiscoveryIntervalId).not.toBeNull();
      scheduler.stop();
      expect(scheduler.intervalId).toBeNull();
      expect(scheduler.themeDiscoveryIntervalId).toBeNull();
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
      expect(scheduler._tickLock).toBe(false);
    });

    test('should skip tick when _tickLock is held', async () => {
      scheduler._tickLock = true;
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);

      await scheduler.tick();

      expect(scheduler.shouldRunUnification).not.toHaveBeenCalled();
      expect(unificationService.runUnification).not.toHaveBeenCalled();
      // Clean up
      scheduler._tickLock = false;
    });

    test('should release _tickLock after completion', async () => {
      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);
      unificationService.runUnification.mockResolvedValue({ entityCount: 1 });

      expect(scheduler._tickLock).toBe(false);
      await scheduler.tick();
      expect(scheduler._tickLock).toBe(false);
    });
  });

  describe('themeDiscoveryTick()', () => {
    test('should call themeDiscoveryEngine.discover with scheduler trigger', async () => {
      themeDiscoveryEngine.discover.mockResolvedValue({
        status: 'completed',
        themesFound: 2,
      });

      const result = await scheduler.themeDiscoveryTick();

      expect(themeDiscoveryEngine.discover).toHaveBeenCalledWith('scheduler');
      expect(result).toEqual({ status: 'completed', themesFound: 2 });
    });

    test('should reject when discovery is already running', async () => {
      scheduler._isDiscoveryRunning = true;

      const result = await scheduler.themeDiscoveryTick();

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Theme discovery is already running');
      expect(result.isDiscoveryRunning).toBe(true);
      expect(themeDiscoveryEngine.discover).not.toHaveBeenCalled();

      // Clean up
      scheduler._isDiscoveryRunning = false;
    });

    test('should skip when tick lock is held by unification', async () => {
      scheduler._tickLock = true;

      const result = await scheduler.themeDiscoveryTick();

      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Unification tick is currently running');
      expect(themeDiscoveryEngine.discover).not.toHaveBeenCalled();

      // Clean up
      scheduler._tickLock = false;
    });

    test('should reset _isDiscoveryRunning and _tickLock after completion', async () => {
      themeDiscoveryEngine.discover.mockResolvedValue({ status: 'completed' });

      await scheduler.themeDiscoveryTick();

      expect(scheduler._isDiscoveryRunning).toBe(false);
      expect(scheduler._tickLock).toBe(false);
    });

    test('should reset _isDiscoveryRunning and _tickLock after error', async () => {
      themeDiscoveryEngine.discover.mockRejectedValue(new Error('Discovery failed'));

      const result = await scheduler.themeDiscoveryTick();

      expect(result.status).toBe('error');
      expect(result.reason).toBe('Discovery failed');
      expect(scheduler._isDiscoveryRunning).toBe(false);
      expect(scheduler._tickLock).toBe(false);
    });

    test('should serialize with unification tick (no concurrent execution)', async () => {
      jest.useRealTimers();

      jest.spyOn(scheduler, 'shouldRunUnification').mockResolvedValue(true);

      let unificationRunning = false;
      let discoveryRunning = false;
      let concurrentDetected = false;

      unificationService.runUnification.mockImplementation(async () => {
        unificationRunning = true;
        if (discoveryRunning) concurrentDetected = true;
        await new Promise(resolve => setTimeout(resolve, 50));
        unificationRunning = false;
        return { entityCount: 1 };
      });

      themeDiscoveryEngine.discover.mockImplementation(async () => {
        discoveryRunning = true;
        if (unificationRunning) concurrentDetected = true;
        await new Promise(resolve => setTimeout(resolve, 50));
        discoveryRunning = false;
        return { status: 'completed' };
      });

      // Start both ticks simultaneously
      const tickPromise = scheduler.tick();
      const discoveryPromise = scheduler.themeDiscoveryTick();

      await Promise.all([tickPromise, discoveryPromise]);

      expect(concurrentDetected).toBe(false);

      jest.useFakeTimers();
    });

    test('should call themeDiscoveryTick immediately on start', async () => {
      const tickSpy = jest.spyOn(scheduler, 'tick').mockResolvedValue();
      const discoveryTickSpy = jest.spyOn(scheduler, 'themeDiscoveryTick').mockResolvedValue();

      scheduler.start();

      // themeDiscoveryTick should be called immediately on start (Req 5.5)
      expect(discoveryTickSpy).toHaveBeenCalledTimes(1);

      tickSpy.mockRestore();
      discoveryTickSpy.mockRestore();
    });

    test('should call themeDiscoveryTick every 1 hour when started', async () => {
      const tickSpy = jest.spyOn(scheduler, 'tick').mockResolvedValue();
      const discoveryTickSpy = jest.spyOn(scheduler, 'themeDiscoveryTick').mockResolvedValue();

      scheduler.start();

      // Initial immediate call
      expect(discoveryTickSpy).toHaveBeenCalledTimes(1);

      // Fast-forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(discoveryTickSpy).toHaveBeenCalledTimes(2); // Immediate + 1 hour

      // Fast-forward another hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(discoveryTickSpy).toHaveBeenCalledTimes(3); // Immediate + 2 hours

      tickSpy.mockRestore();
      discoveryTickSpy.mockRestore();
    });
  });
});
