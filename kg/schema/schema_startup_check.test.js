/**
 * Unit Tests for Schema Startup Check
 */

const schemaStartupCheck = require('./schema_startup_check');
const schemaManager = require('./schema_manager');
const schemaLoader = require('./schema_loader');

// Mock dependencies
jest.mock('./schema_manager');
jest.mock('./schema_loader');

describe('Schema Startup Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkSchemas', () => {
    it('should return ok status when schema count is sufficient', async () => {
      schemaManager.countSchemas.mockResolvedValue(250);

      const result = await schemaStartupCheck.checkSchemas();

      expect(result.status).toBe('ok');
      expect(result.currentCount).toBe(250);
      expect(result.expectedCount).toBe(250);
      expect(result.message).toContain('All schemas are loaded');
    });

    it('should return insufficient status when schema count is low', async () => {
      schemaManager.countSchemas.mockResolvedValue(100);

      const result = await schemaStartupCheck.checkSchemas();

      expect(result.status).toBe('insufficient');
      expect(result.currentCount).toBe(100);
      expect(result.expectedCount).toBe(250);
      expect(result.message).toContain('need to import');
    });

    it('should return error status when check fails', async () => {
      schemaManager.countSchemas.mockRejectedValue(new Error('Database error'));

      const result = await schemaStartupCheck.checkSchemas();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Database error');
      expect(result.error).toBeDefined();
    });
  });

  describe('getSchemaStatus', () => {
    it('should return healthy status when count is sufficient', async () => {
      schemaManager.countSchemas.mockResolvedValue(250);

      const status = await schemaStartupCheck.getSchemaStatus();

      expect(status.status).toBe('healthy');
      expect(status.currentCount).toBe(250);
      expect(status.percentage).toBe(100);
    });

    it('should return insufficient status when count is low', async () => {
      schemaManager.countSchemas.mockResolvedValue(125);

      const status = await schemaStartupCheck.getSchemaStatus();

      expect(status.status).toBe('insufficient');
      expect(status.currentCount).toBe(125);
      expect(status.percentage).toBe(50);
    });

    it('should return error status on failure', async () => {
      schemaManager.countSchemas.mockRejectedValue(new Error('Connection failed'));

      const status = await schemaStartupCheck.getSchemaStatus();

      expect(status.status).toBe('error');
      expect(status.currentCount).toBe(0);
      expect(status.percentage).toBe(0);
    });
  });

  describe('importSchemasWithRetry', () => {
    it('should import schemas successfully on first attempt', async () => {
      const mockStats = {
        total: 250,
        created: 250,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: []
      };

      schemaLoader.loadAndImportSchemas.mockResolvedValue(mockStats);
      schemaManager.countSchemas.mockResolvedValue(250);

      const result = await schemaStartupCheck.importSchemasWithRetry();

      expect(result.success).toBe(true);
      expect(result.finalCount).toBe(250);
      expect(result.attempt).toBe(1);
      expect(schemaLoader.loadAndImportSchemas).toHaveBeenCalledTimes(1);
    });

    it('should handle import errors', async () => {
      schemaLoader.loadAndImportSchemas.mockRejectedValue(new Error('Import error'));

      await expect(schemaStartupCheck.importSchemasWithRetry()).rejects.toThrow('Import error');
    });
  });

  describe('performStartupCheck', () => {
    it('should skip import when schemas are already loaded', async () => {
      schemaManager.countSchemas.mockResolvedValue(250);

      const result = await schemaStartupCheck.performStartupCheck();

      expect(result.success).toBe(true);
      expect(result.action).toBe('none');
      expect(result.message).toContain('already loaded');
      expect(schemaLoader.loadAndImportSchemas).not.toHaveBeenCalled();
    });

    it('should import schemas when count is insufficient', async () => {
      const mockStats = {
        total: 250,
        created: 150,
        skipped: 100,
        updated: 0,
        failed: 0,
        errors: []
      };

      schemaManager.countSchemas
        .mockResolvedValueOnce(100) // Initial check
        .mockResolvedValueOnce(250); // After import

      schemaLoader.loadAndImportSchemas.mockResolvedValue(mockStats);

      const result = await schemaStartupCheck.performStartupCheck();

      expect(result.success).toBe(true);
      expect(result.action).toBe('imported');
      expect(result.schemaCount).toBe(250);
      expect(result.stats).toEqual(mockStats);
    });

    it('should handle check failure gracefully', async () => {
      schemaManager.countSchemas.mockRejectedValue(new Error('Database error'));

      const result = await schemaStartupCheck.performStartupCheck();

      expect(result.success).toBe(false);
      expect(result.action).toBe('check_failed');
      expect(result.message).toBe('Database error');
    });

    it('should handle import failure gracefully', async () => {
      schemaManager.countSchemas.mockResolvedValue(100);
      schemaLoader.loadAndImportSchemas.mockRejectedValue(new Error('Import failed'));

      const result = await schemaStartupCheck.performStartupCheck();

      expect(result.success).toBe(false);
      expect(result.action).toBe('import_failed');
      expect(result.message).toBe('Import failed');
    });
  });

  describe('forceReimport', () => {
    it('should successfully reimport schemas', async () => {
      const mockStats = {
        total: 250,
        created: 50,
        skipped: 200,
        updated: 0,
        failed: 0,
        errors: []
      };

      schemaLoader.loadAndImportSchemas.mockResolvedValue(mockStats);
      schemaManager.countSchemas.mockResolvedValue(250);

      const result = await schemaStartupCheck.forceReimport();

      expect(result.success).toBe(true);
      expect(result.schemaCount).toBe(250);
      expect(result.stats).toEqual(mockStats);
    });

    it('should handle reimport failure', async () => {
      schemaLoader.loadAndImportSchemas.mockRejectedValue(new Error('Reimport failed'));

      const result = await schemaStartupCheck.forceReimport();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Reimport failed');
    });
  });
});
