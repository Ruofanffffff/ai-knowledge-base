/**
 * Integration test for UnificationScheduler in server.js
 * Validates: Requirements 3.1, 3.6
 */

const unificationScheduler = require('./unificationScheduler');

describe('UnificationScheduler Integration', () => {
  afterEach(() => {
    // Clean up: stop scheduler after each test
    unificationScheduler.stop();
  });

  test('should start scheduler successfully', () => {
    // Verify scheduler is not running initially
    expect(unificationScheduler.intervalId).toBeNull();

    // Start the scheduler
    unificationScheduler.start();

    // Verify scheduler is now running
    expect(unificationScheduler.intervalId).not.toBeNull();
  });

  test('should stop scheduler successfully', () => {
    // Start the scheduler first
    unificationScheduler.start();
    expect(unificationScheduler.intervalId).not.toBeNull();

    // Stop the scheduler
    unificationScheduler.stop();

    // Verify scheduler is stopped
    expect(unificationScheduler.intervalId).toBeNull();
  });

  test('should not start multiple times', () => {
    // Start the scheduler
    unificationScheduler.start();
    const firstIntervalId = unificationScheduler.intervalId;

    // Try to start again
    unificationScheduler.start();
    const secondIntervalId = unificationScheduler.intervalId;

    // Verify the interval ID hasn't changed (same instance)
    expect(secondIntervalId).toBe(firstIntervalId);
  });

  test('should handle stop when not running', () => {
    // Verify scheduler is not running
    expect(unificationScheduler.intervalId).toBeNull();

    // Stop should not throw error
    expect(() => {
      unificationScheduler.stop();
    }).not.toThrow();

    // Verify still not running
    expect(unificationScheduler.intervalId).toBeNull();
  });

  test('should clear interval on stop', () => {
    // Start the scheduler
    unificationScheduler.start();
    const intervalId = unificationScheduler.intervalId;
    expect(intervalId).not.toBeNull();

    // Stop the scheduler
    unificationScheduler.stop();

    // Verify interval is cleared
    expect(unificationScheduler.intervalId).toBeNull();
  });
});
