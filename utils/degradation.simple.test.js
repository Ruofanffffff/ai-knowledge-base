/**
 * Simplified Tests for Degradation Strategy
 * 
 * Validates: Requirement 12.5
 */

const {
  ServiceHealthMonitor,
  LLMDegradationHandler,
  createLLMDegradationHandler,
  createStorageDegradationHandler,
  ServiceStatus,
  DegradationMode,
} = require('./degradation');

describe('Degradation Strategy - Core Functionality', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ServiceHealthMonitor', () => {
    it('should track service health and degrade after failures', () => {
      const monitor = new ServiceHealthMonitor('TestService', {
        failureThreshold: 3,
        recoveryThreshold: 2
      });

      expect(monitor.isHealthy()).toBe(true);

      // Record failures
      monitor.recordFailure();
      monitor.recordFailure();
      monitor.recordFailure();

      expect(monitor.isDegraded()).toBe(true);

      // Recover
      monitor.recordSuccess();
      monitor.recordSuccess();

      expect(monitor.isHealthy()).toBe(true);
    });
  });

  describe('LLMDegradationHandler', () => {
    it('should execute operations and cache results', async () => {
      const handler = createLLMDegradationHandler();
      const operation = jest.fn().mockResolvedValue({ content: 'Success' });

      const result = await handler.execute(operation, { cacheKey: 'test' });

      expect(result.content).toBe('Success');
      expect(handler.cache.has('test')).toBe(true);
    });

    it('should use cached results on failure', async () => {
      const handler = createLLMDegradationHandler();

      // First success
      const successOp = jest.fn().mockResolvedValue({ content: 'Cached' });
      await handler.execute(successOp, { cacheKey: 'test' });

      // Then failure
      const failOp = jest.fn().mockRejectedValue(new Error('Failed'));
      const result = await handler.execute(failOp, { cacheKey: 'test' });

      expect(result.content).toBe('Cached');
      expect(result.fromCache).toBe(true);
    });

    it('should provide basic processing when degraded', async () => {
      const handler = createLLMDegradationHandler({ failureThreshold: 2 });

      // Degrade service
      handler.healthMonitor.recordFailure();
      handler.healthMonitor.recordFailure();

      const operation = jest.fn().mockRejectedValue(new Error('Failed'));
      const result = await handler.execute(operation, {
        allowBasicProcessing: true,
        input: 'test',
        operationType: 'textGeneration'
      });

      expect(result.degraded).toBe(true);
      expect(result.expandedText).toBe('test');
    });

    it('should queue operations when unavailable', async () => {
      const handler = createLLMDegradationHandler();
      handler.healthMonitor.status = ServiceStatus.UNAVAILABLE;

      const operation = jest.fn().mockRejectedValue(new Error('Failed'));
      const result = await handler.execute(operation, {
        allowQueue: true,
        input: 'test',
        operationType: 'imageAnalysis'
      });

      expect(result.queued).toBe(true);
      expect(handler.getStatus().queueSize).toBe(1);
    });
  });

  describe('Factory functions', () => {
    it('should create handlers with custom options', () => {
      const llmHandler = createLLMDegradationHandler({ failureThreshold: 5 });
      const storageHandler = createStorageDegradationHandler({ failureThreshold: 5 });

      expect(llmHandler.healthMonitor.config.failureThreshold).toBe(5);
      expect(storageHandler.healthMonitor.config.failureThreshold).toBe(5);
    });
  });
});
