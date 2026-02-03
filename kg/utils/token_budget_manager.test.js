/**
 * Unit Tests for Token Budget Manager
 */

const tokenBudgetManager = require('./token_budget_manager');
const tokenTracker = require('./token_tracker');

// Mock token tracker
jest.mock('./token_tracker', () => ({
  recordTokenUsage: jest.fn().mockResolvedValue(true)
}));

describe('Token Budget Manager', () => {
  beforeEach(() => {
    tokenBudgetManager.reset();
    tokenTracker.recordTokenUsage.mockClear();
  });

  describe('recordUsage', () => {
    it('should record token usage and update daily total', async () => {
      const data = {
        module: 'field_extraction',
        operation: 'extract',
        tokens: 500,
        ckb_id: 'ckb_001',
        doc_id: 'doc_001'
      };

      const result = await tokenBudgetManager.recordUsage(data);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99500); // 100000 - 500
      expect(result.usageRate).toBe(0.005); // 500 / 100000
      expect(result.emergencyMode).toBe(false);
      expect(tokenTracker.recordTokenUsage).toHaveBeenCalled();
    });

    it('should trigger warning at 80% usage', async () => {
      const callback = jest.fn();
      tokenBudgetManager.onAlert(callback);

      // Use 80% of budget
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 80000
      });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe('budget_warning');
    });

    it('should trigger alert and enable emergency mode at 100% usage', async () => {
      const callback = jest.fn();
      tokenBudgetManager.onAlert(callback);

      // Use 100% of budget
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 100000
      });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe('budget_exceeded');

      const status = tokenBudgetManager.getBudgetStatus();
      expect(status.emergencyMode).toBe(true);
      expect(status.llmParticipationRate).toBe(0.2); // Emergency rate
    });

    it('should track per-document usage', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 1000,
        doc_id: 'doc_001'
      });

      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 500,
        doc_id: 'doc_001'
      });

      const status = tokenBudgetManager.getBudgetStatus();
      expect(status.documentCount).toBe(1);
      expect(status.topDocuments[0].docId).toBe('doc_001');
      expect(status.topDocuments[0].tokens).toBe(1500);
    });
  });

  describe('checkDocumentBudget', () => {
    it('should allow document within budget', () => {
      const result = tokenBudgetManager.checkDocumentBudget('doc_001', 3000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2000); // 5000 - 3000
    });

    it('should reject document exceeding budget', async () => {
      const callback = jest.fn();
      tokenBudgetManager.onAlert(callback);

      // First use some tokens
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 3000,
        doc_id: 'doc_001'
      });

      // Try to use more than limit
      const result = tokenBudgetManager.checkDocumentBudget('doc_001', 3000);

      expect(result.allowed).toBe(false);
      expect(result.exceeded).toBe(1000); // 6000 - 5000
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe('document_budget_exceeded');
    });
  });

  describe('enableEmergencyMode', () => {
    it('should enable emergency mode and reduce LLM rate', () => {
      tokenBudgetManager.enableEmergencyMode();

      const status = tokenBudgetManager.getBudgetStatus();
      expect(status.emergencyMode).toBe(true);
      expect(status.llmParticipationRate).toBe(0.2);
    });

    it('should not enable emergency mode twice', () => {
      tokenBudgetManager.enableEmergencyMode();
      const alerts1 = tokenBudgetManager.getRecentAlerts();

      tokenBudgetManager.enableEmergencyMode();
      const alerts2 = tokenBudgetManager.getRecentAlerts();

      expect(alerts1.length).toBe(alerts2.length);
    });
  });

  describe('disableEmergencyMode', () => {
    it('should disable emergency mode and restore LLM rate', () => {
      tokenBudgetManager.enableEmergencyMode();
      tokenBudgetManager.disableEmergencyMode();

      const status = tokenBudgetManager.getBudgetStatus();
      expect(status.emergencyMode).toBe(false);
      expect(status.llmParticipationRate).toBe(0.5);
    });
  });

  describe('getBudgetStatus', () => {
    it('should return current budget status', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 10000
      });

      const status = tokenBudgetManager.getBudgetStatus();

      expect(status.daily.usage).toBe(10000);
      expect(status.daily.limit).toBe(100000);
      expect(status.daily.remaining).toBe(90000);
      expect(status.daily.usageRate).toBe(0.1);
      expect(status.daily.status).toBe('normal');
      expect(status.emergencyMode).toBe(false);
    });

    it('should return correct status levels', async () => {
      // Normal
      await tokenBudgetManager.recordUsage({ module: 'test', operation: 'test', tokens: 50000 });
      expect(tokenBudgetManager.getBudgetStatus().daily.status).toBe('normal');

      tokenBudgetManager.reset();

      // Caution
      await tokenBudgetManager.recordUsage({ module: 'test', operation: 'test', tokens: 65000 });
      expect(tokenBudgetManager.getBudgetStatus().daily.status).toBe('caution');

      tokenBudgetManager.reset();

      // Warning
      await tokenBudgetManager.recordUsage({ module: 'test', operation: 'test', tokens: 85000 });
      expect(tokenBudgetManager.getBudgetStatus().daily.status).toBe('warning');

      tokenBudgetManager.reset();

      // Exceeded
      await tokenBudgetManager.recordUsage({ module: 'test', operation: 'test', tokens: 105000 });
      expect(tokenBudgetManager.getBudgetStatus().daily.status).toBe('exceeded');
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations for high usage', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 85000
      });

      const recommendations = tokenBudgetManager.getRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].category).toBe('budget');
    });

    it('should return emergency recommendations when in emergency mode', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 100000
      });

      const recommendations = tokenBudgetManager.getRecommendations();

      const emergencyRec = recommendations.find(r => r.category === 'emergency');
      expect(emergencyRec).toBeDefined();
      expect(emergencyRec.priority).toBe('critical');
    });

    it('should return document recommendations for high-usage documents', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 4500,
        doc_id: 'doc_001'
      });

      const recommendations = tokenBudgetManager.getRecommendations();

      const docRec = recommendations.find(r => r.category === 'document');
      expect(docRec).toBeDefined();
      expect(docRec.priority).toBe('medium');
    });
  });

  describe('getRecentAlerts', () => {
    it('should return recent alerts', async () => {
      const callback = jest.fn();
      tokenBudgetManager.onAlert(callback);

      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 85000
      });

      const alerts = tokenBudgetManager.getRecentAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('budget_warning');
    });

    it('should limit number of returned alerts', async () => {
      // Trigger multiple alerts
      for (let i = 0; i < 15; i++) {
        tokenBudgetManager.reset();
        await tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85000
        });
      }

      const alerts = tokenBudgetManager.getRecentAlerts(5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('updateConfig', () => {
    it('should update budget configuration', () => {
      tokenBudgetManager.updateConfig({
        dailyLimit: 200000,
        perDocumentLimit: 10000
      });

      expect(tokenBudgetManager.BUDGET_CONFIG.DAILY_LIMIT).toBe(200000);
      expect(tokenBudgetManager.BUDGET_CONFIG.PER_DOCUMENT_LIMIT).toBe(10000);
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 50000
      });

      tokenBudgetManager.reset();

      const status = tokenBudgetManager.getBudgetStatus();
      expect(status.daily.usage).toBe(0);
      expect(status.emergencyMode).toBe(false);
      expect(status.documentCount).toBe(0);
    });
  });
});
