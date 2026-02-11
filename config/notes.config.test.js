/**
 * Tests for Notes Configuration
 * 
 * This file contains unit tests for the notes configuration module.
 */

const { notesConfig, validateConfig } = require('./notes.config');

describe('Notes Configuration', () => {
  describe('Configuration Structure', () => {
    it('should have database configuration', () => {
      expect(notesConfig.database).toBeDefined();
      expect(notesConfig.database.url).toBeDefined();
    });

    it('should have storage configuration', () => {
      expect(notesConfig.storage).toBeDefined();
      expect(notesConfig.storage.endpoint).toBeDefined();
      expect(notesConfig.storage.accessKeyId).toBeDefined();
      expect(notesConfig.storage.secretAccessKey).toBeDefined();
      expect(notesConfig.storage.bucketName).toBeDefined();
      expect(notesConfig.storage.region).toBeDefined();
    });

    it('should have attachment configuration', () => {
      expect(notesConfig.attachments).toBeDefined();
      expect(notesConfig.attachments.maxSize).toBeGreaterThan(0);
      expect(Array.isArray(notesConfig.attachments.allowedImageTypes)).toBe(true);
      expect(Array.isArray(notesConfig.attachments.allowedDocumentTypes)).toBe(true);
      expect(Array.isArray(notesConfig.attachments.allowedTableTypes)).toBe(true);
    });

    it('should have LLM configuration', () => {
      expect(notesConfig.multiModalLLM).toBeDefined();
      expect(notesConfig.multiModalLLM.provider).toBeDefined();
      expect(notesConfig.multiModalLLM.model).toBeDefined();
      
      expect(notesConfig.textLLM).toBeDefined();
      expect(notesConfig.textLLM.provider).toBeDefined();
      expect(notesConfig.textLLM.model).toBeDefined();
    });

    it('should have performance requirements', () => {
      expect(notesConfig.performance).toBeDefined();
      expect(notesConfig.performance.textSaveTimeout).toBe(500);
      expect(notesConfig.performance.imageUploadTimeout).toBe(3000);
      expect(notesConfig.performance.imageAnalysisTimeout).toBe(10000);
      expect(notesConfig.performance.aiEnhancementTimeout).toBe(5000);
      expect(notesConfig.performance.searchTimeout).toBe(500);
    });

    it('should have retry configuration', () => {
      expect(notesConfig.retry).toBeDefined();
      expect(notesConfig.retry.maxRetries).toBe(3);
      expect(notesConfig.retry.backoffMultiplier).toBeGreaterThan(0);
      expect(notesConfig.retry.initialDelay).toBeGreaterThan(0);
    });

    it('should have tag configuration', () => {
      expect(notesConfig.tags).toBeDefined();
      expect(notesConfig.tags.pattern).toBeInstanceOf(RegExp);
      expect(notesConfig.tags.maxLength).toBeGreaterThan(0);
    });

    it('should have search configuration', () => {
      expect(notesConfig.search).toBeDefined();
      expect(notesConfig.search.minQueryLength).toBeGreaterThan(0);
      expect(notesConfig.search.maxResults).toBeGreaterThan(0);
    });

    it('should have image analysis configuration', () => {
      expect(notesConfig.imageAnalysis).toBeDefined();
      expect(Array.isArray(notesConfig.imageAnalysis.supportedTypes)).toBe(true);
      expect(notesConfig.imageAnalysis.supportedTypes.length).toBeGreaterThan(0);
    });

    it('should have AI enhancement configuration', () => {
      expect(notesConfig.aiEnhancement).toBeDefined();
      expect(notesConfig.aiEnhancement.generate).toBeDefined();
      expect(notesConfig.aiEnhancement.proofread).toBeDefined();
      expect(notesConfig.aiEnhancement.table).toBeDefined();
      expect(notesConfig.aiEnhancement.mindmap).toBeDefined();
    });
  });

  describe('Configuration Values', () => {
    it('should have valid attachment size limit', () => {
      expect(notesConfig.attachments.maxSize).toBeGreaterThan(0);
      expect(notesConfig.attachments.maxSize).toBeLessThanOrEqual(100 * 1024 * 1024); // Max 100MB
    });

    it('should have valid timeout values', () => {
      expect(notesConfig.performance.textSaveTimeout).toBeGreaterThan(0);
      expect(notesConfig.performance.imageUploadTimeout).toBeGreaterThan(0);
      expect(notesConfig.performance.imageAnalysisTimeout).toBeGreaterThan(0);
      expect(notesConfig.performance.aiEnhancementTimeout).toBeGreaterThan(0);
      expect(notesConfig.performance.searchTimeout).toBeGreaterThan(0);
    });

    it('should have valid retry configuration', () => {
      expect(notesConfig.retry.maxRetries).toBeGreaterThanOrEqual(1);
      expect(notesConfig.retry.maxRetries).toBeLessThanOrEqual(10);
      expect(notesConfig.retry.backoffMultiplier).toBeGreaterThan(1);
    });

    it('should have valid mindmap configuration', () => {
      expect(notesConfig.aiEnhancement.mindmap.minBranches).toBeGreaterThan(0);
      expect(notesConfig.aiEnhancement.mindmap.maxBranches).toBeGreaterThan(
        notesConfig.aiEnhancement.mindmap.minBranches
      );
      expect(notesConfig.aiEnhancement.mindmap.maxLabelLength).toBeGreaterThan(0);
    });

    it('should have valid table configuration', () => {
      expect(notesConfig.aiEnhancement.table.maxColumns).toBeGreaterThan(0);
      expect(notesConfig.aiEnhancement.table.maxRows).toBeGreaterThan(0);
    });
  });

  describe('Tag Pattern', () => {
    it('should match hashtags correctly', () => {
      const pattern = notesConfig.tags.pattern;
      const text = 'This is a test #tag1 and #tag2';
      const matches = text.match(pattern);
      
      expect(matches).toBeDefined();
      expect(matches.length).toBe(2);
    });

    it('should extract tag names correctly', () => {
      const pattern = notesConfig.tags.pattern;
      const text = 'Test #work #important #urgent';
      const tags = [];
      let match;
      
      // Reset regex state
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(text)) !== null) {
        tags.push(match[1]);
      }
      
      expect(tags).toEqual(['work', 'important', 'urgent']);
    });

    it('should not match hashtags with spaces', () => {
      const pattern = notesConfig.tags.pattern;
      const text = 'This is # not a tag';
      
      // Reset regex state
      pattern.lastIndex = 0;
      
      const matches = text.match(pattern);
      expect(matches).toBeNull();
    });
  });

  describe('Validation Function', () => {
    it('should be a function', () => {
      expect(typeof validateConfig).toBe('function');
    });

    it('should return a boolean', () => {
      const result = validateConfig();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Allowed File Types', () => {
    it('should have common image types', () => {
      const imageTypes = notesConfig.attachments.allowedImageTypes;
      expect(imageTypes).toContain('image/jpeg');
      expect(imageTypes).toContain('image/png');
    });

    it('should have common document types', () => {
      const docTypes = notesConfig.attachments.allowedDocumentTypes;
      expect(docTypes.some(type => type.includes('pdf'))).toBe(true);
    });

    it('should have common table types', () => {
      const tableTypes = notesConfig.attachments.allowedTableTypes;
      expect(tableTypes.some(type => type.includes('excel') || type.includes('csv'))).toBe(true);
    });
  });

  describe('Performance Requirements Compliance', () => {
    // Requirement 1.6: Text save should complete within 500ms
    it('should have text save timeout of 500ms', () => {
      expect(notesConfig.performance.textSaveTimeout).toBe(500);
    });

    // Requirement 2.7: Image upload should complete within 3s
    it('should have image upload timeout of 3000ms', () => {
      expect(notesConfig.performance.imageUploadTimeout).toBe(3000);
    });

    // Requirement 2.8: Image analysis should complete within 10s
    it('should have image analysis timeout of 10000ms', () => {
      expect(notesConfig.performance.imageAnalysisTimeout).toBe(10000);
    });

    // Requirements 5.5, 6.6, 7.5, 8.6: AI enhancement should complete within 5s
    it('should have AI enhancement timeout of 5000ms', () => {
      expect(notesConfig.performance.aiEnhancementTimeout).toBe(5000);
    });

    // Requirement 9.6: Search should complete within 500ms
    it('should have search timeout of 500ms', () => {
      expect(notesConfig.performance.searchTimeout).toBe(500);
    });
  });

  describe('Requirement 12.4 Compliance', () => {
    // Requirement 12.4: System should retry operations up to 3 times
    it('should have max retries of 3', () => {
      expect(notesConfig.retry.maxRetries).toBe(3);
    });
  });

  describe('Requirement 8.2 Compliance', () => {
    // Requirement 8.2: Mindmap should have 3-6 first-level branches
    it('should have mindmap branches between 3 and 6', () => {
      expect(notesConfig.aiEnhancement.mindmap.minBranches).toBe(3);
      expect(notesConfig.aiEnhancement.mindmap.maxBranches).toBe(6);
    });
  });
});
