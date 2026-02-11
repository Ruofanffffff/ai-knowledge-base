/**
 * Alert Manager Tests
 * 
 * Tests for alert triggering, severity determination, and notification management
 */

const alertManager = require('./alert_manager');
const { ALERT_TYPES, SEVERITY } = require('./alert_manager');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    alert: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('AlertManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('trigger', () => {
    it('should trigger low coverage alert with error severity', async () => {
      prisma.alert.create.mockResolvedValue({});

      const alertId = await alertManager.trigger(ALERT_TYPES.LOW_COVERAGE, {
        doc_id: 'doc_123',
        coverage_rate: 0.85
      });

      expect(alertId).toBeDefined();
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: ALERT_TYPES.LOW_COVERAGE,
          severity: SEVERITY.ERROR,
          status: 'active'
        })
      });
    });

    it('should trigger low coverage alert with warning severity', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.trigger(ALERT_TYPES.LOW_COVERAGE, {
        doc_id: 'doc_123',
        coverage_rate: 0.92
      });

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: SEVERITY.WARNING
        })
      });
    });

    it('should trigger processing timeout alert', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.trigger(ALERT_TYPES.PROCESSING_TIMEOUT, {
        monitor_id: 'mon_123',
        stage: 'ckb_parsing',
        duration_ms: 350000,
        threshold_ms: 300000
      });

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: ALERT_TYPES.PROCESSING_TIMEOUT,
          severity: SEVERITY.WARNING
        })
      });
    });

    it('should trigger high failure rate alert with critical severity', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.trigger(ALERT_TYPES.HIGH_FAILURE_RATE, {
        failure_rate: 0.15
      });

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: ALERT_TYPES.HIGH_FAILURE_RATE,
          severity: SEVERITY.CRITICAL
        })
      });
    });

    it('should trigger missing content alert', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.trigger(ALERT_TYPES.MISSING_CONTENT, {
        doc_id: 'doc_123',
        missing_count: 15
      });

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: ALERT_TYPES.MISSING_CONTENT,
          severity: SEVERITY.ERROR
        })
      });
    });
  });

  describe('determineSeverity', () => {
    it('should return ERROR for low coverage < 90%', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.LOW_COVERAGE, {
        coverage_rate: 0.85
      });
      expect(severity).toBe(SEVERITY.ERROR);
    });

    it('should return WARNING for low coverage >= 90%', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.LOW_COVERAGE, {
        coverage_rate: 0.92
      });
      expect(severity).toBe(SEVERITY.WARNING);
    });

    it('should return ERROR for low quality score < 70', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.LOW_QUALITY, {
        quality_score: 65
      });
      expect(severity).toBe(SEVERITY.ERROR);
    });

    it('should return WARNING for low quality score >= 70', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.LOW_QUALITY, {
        quality_score: 75
      });
      expect(severity).toBe(SEVERITY.WARNING);
    });

    it('should return CRITICAL for high failure rate', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.HIGH_FAILURE_RATE, {});
      expect(severity).toBe(SEVERITY.CRITICAL);
    });

    it('should return ERROR for missing content > 10', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.MISSING_CONTENT, {
        missing_count: 15
      });
      expect(severity).toBe(SEVERITY.ERROR);
    });

    it('should return WARNING for missing content <= 10', () => {
      const severity = alertManager.determineSeverity(ALERT_TYPES.MISSING_CONTENT, {
        missing_count: 5
      });
      expect(severity).toBe(SEVERITY.WARNING);
    });

    it('should return INFO for unknown alert type', () => {
      const severity = alertManager.determineSeverity('unknown_type', {});
      expect(severity).toBe(SEVERITY.INFO);
    });
  });

  describe('generateMessage', () => {
    it('should generate message for low coverage alert', () => {
      const message = alertManager.generateMessage(ALERT_TYPES.LOW_COVERAGE, {
        doc_id: 'doc_123',
        coverage_rate: 0.85
      });
      expect(message).toContain('doc_123');
      expect(message).toContain('85.0%');
    });

    it('should generate message for low quality alert', () => {
      const message = alertManager.generateMessage(ALERT_TYPES.LOW_QUALITY, {
        doc_id: 'doc_123',
        quality_score: 75.5
      });
      expect(message).toContain('doc_123');
      expect(message).toContain('75.5');
    });

    it('should generate message for processing timeout alert', () => {
      const message = alertManager.generateMessage(ALERT_TYPES.PROCESSING_TIMEOUT, {
        monitor_id: 'mon_123',
        stage: 'ckb_parsing',
        duration_ms: 350000,
        threshold_ms: 300000
      });
      expect(message).toContain('mon_123');
      expect(message).toContain('ckb_parsing');
      expect(message).toContain('350000');
    });

    it('should generate message for high failure rate alert', () => {
      const message = alertManager.generateMessage(ALERT_TYPES.HIGH_FAILURE_RATE, {
        failure_rate: 0.15
      });
      expect(message).toContain('15.0%');
    });

    it('should generate message for missing content alert', () => {
      const message = alertManager.generateMessage(ALERT_TYPES.MISSING_CONTENT, {
        doc_id: 'doc_123',
        missing_count: 15
      });
      expect(message).toContain('doc_123');
      expect(message).toContain('15');
    });
  });

  describe('checkCoverageThreshold', () => {
    it('should trigger alert when coverage < 90%', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.checkCoverageThreshold(0.85, 'doc_123');

      expect(prisma.alert.create).toHaveBeenCalled();
    });

    it('should not trigger alert when coverage >= 90%', async () => {
      await alertManager.checkCoverageThreshold(0.95, 'doc_123');

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('checkQualityThreshold', () => {
    it('should trigger alert when quality score < 80', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.checkQualityThreshold(75, 'doc_123');

      expect(prisma.alert.create).toHaveBeenCalled();
    });

    it('should not trigger alert when quality score >= 80', async () => {
      await alertManager.checkQualityThreshold(85, 'doc_123');

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('checkFailureRate', () => {
    it('should trigger alert when failure rate > 10%', async () => {
      prisma.alert.create.mockResolvedValue({});

      await alertManager.checkFailureRate(0.15);

      expect(prisma.alert.create).toHaveBeenCalled();
    });

    it('should not trigger alert when failure rate <= 10%', async () => {
      await alertManager.checkFailureRate(0.08);

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('getAlertHistory', () => {
    it('should retrieve alert history with filters', async () => {
      const mockAlerts = [
        {
          alertId: 'alert_1',
          alertType: ALERT_TYPES.LOW_COVERAGE,
          severity: SEVERITY.ERROR,
          message: 'Test alert',
          metadata: JSON.stringify({ doc_id: 'doc_123' }),
          triggeredAt: new Date(),
          resolvedAt: null,
          status: 'active'
        }
      ];

      prisma.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await alertManager.getAlertHistory({
        alert_type: ALERT_TYPES.LOW_COVERAGE,
        severity: SEVERITY.ERROR
      });

      expect(result).toHaveLength(1);
      expect(result[0].alert_id).toBe('alert_1');
      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          alertType: ALERT_TYPES.LOW_COVERAGE,
          severity: SEVERITY.ERROR
        }),
        orderBy: { triggeredAt: 'desc' },
        take: 100
      });
    });

    it('should filter by date range', async () => {
      prisma.alert.findMany.mockResolvedValue([]);

      await alertManager.getAlertHistory({
        from_date: '2024-01-01',
        to_date: '2024-12-31'
      });

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          triggeredAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date)
          })
        }),
        orderBy: { triggeredAt: 'desc' },
        take: 100
      });
    });

    it('should respect limit parameter', async () => {
      prisma.alert.findMany.mockResolvedValue([]);

      await alertManager.getAlertHistory({ limit: 50 });

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { triggeredAt: 'desc' },
        take: 50
      });
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      prisma.alert.update.mockResolvedValue({});

      await alertManager.resolveAlert('alert_123');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { alertId: 'alert_123' },
        data: {
          status: 'resolved',
          resolvedAt: expect.any(Date)
        }
      });
    });
  });

  describe('ignoreAlert', () => {
    it('should ignore an alert', async () => {
      prisma.alert.update.mockResolvedValue({});

      await alertManager.ignoreAlert('alert_123');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { alertId: 'alert_123' },
        data: {
          status: 'ignored'
        }
      });
    });
  });

  describe('getAlertStatistics', () => {
    it('should calculate alert statistics', async () => {
      const mockAlerts = [
        {
          alertType: ALERT_TYPES.LOW_COVERAGE,
          severity: SEVERITY.ERROR,
          status: 'active'
        },
        {
          alertType: ALERT_TYPES.LOW_COVERAGE,
          severity: SEVERITY.WARNING,
          status: 'resolved'
        },
        {
          alertType: ALERT_TYPES.HIGH_FAILURE_RATE,
          severity: SEVERITY.CRITICAL,
          status: 'active'
        }
      ];

      prisma.alert.findMany.mockResolvedValue(mockAlerts);

      const stats = await alertManager.getAlertStatistics();

      expect(stats.total).toBe(3);
      expect(stats.by_type[ALERT_TYPES.LOW_COVERAGE]).toBe(2);
      expect(stats.by_type[ALERT_TYPES.HIGH_FAILURE_RATE]).toBe(1);
      expect(stats.by_severity[SEVERITY.ERROR]).toBe(1);
      expect(stats.by_severity[SEVERITY.WARNING]).toBe(1);
      expect(stats.by_severity[SEVERITY.CRITICAL]).toBe(1);
      expect(stats.active_count).toBe(2);
      expect(stats.resolved_count).toBe(1);
    });

    it('should filter statistics by date range', async () => {
      prisma.alert.findMany.mockResolvedValue([]);

      await alertManager.getAlertStatistics({
        from_date: '2024-01-01',
        to_date: '2024-12-31'
      });

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          triggeredAt: expect.any(Object)
        })
      });
    });
  });
});
