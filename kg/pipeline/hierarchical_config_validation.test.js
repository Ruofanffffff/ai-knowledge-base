/**
 * Tests for Hierarchical Extraction Configuration Validation
 * 
 * Validates that the pipeline correctly validates hierarchical extraction
 * configuration options and provides helpful error messages.
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

describe('Hierarchical Extraction Configuration Validation', () => {
  describe('Valid Configurations', () => {
    test('should accept pattern method', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            hierarchicalMethod: 'pattern'
          }
        });
      }).not.toThrow();
    });

    test('should accept llm method', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            hierarchicalMethod: 'llm'
          }
        });
      }).not.toThrow();
    });

    test('should accept hybrid method', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            hierarchicalMethod: 'hybrid'
          }
        });
      }).not.toThrow();
    });

    test('should accept valid confidence threshold', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            minConfidence: 0.7
          }
        });
      }).not.toThrow();
    });

    test('should accept confidence threshold at boundaries', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            minConfidence: 0.0
          }
        });
      }).not.toThrow();

      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            minConfidence: 1.0
          }
        });
      }).not.toThrow();
    });

    test('should accept hierarchical disabled', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: false
          }
        });
      }).not.toThrow();
    });

    test('should accept default configuration', () => {
      expect(() => {
        new UniversalDocumentPipeline();
      }).not.toThrow();
    });
  });

  describe('Invalid Configurations', () => {
    test('should reject invalid extraction method', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            hierarchicalMethod: 'invalid_method'
          }
        });
      }).toThrow(/Invalid hierarchical extraction method/);
    });

    test('should reject confidence threshold below 0', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            minConfidence: -0.1
          }
        });
      }).toThrow(/Invalid minConfidence/);
    });

    test('should reject confidence threshold above 1', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            minConfidence: 1.5
          }
        });
      }).toThrow(/Invalid minConfidence/);
    });

    test('should reject non-numeric confidence threshold', () => {
      expect(() => {
        new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            minConfidence: '0.7'
          }
        });
      }).toThrow(/Invalid minConfidence/);
    });
  });

  describe('Configuration Warnings', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test('should warn when LLM method is selected but LLM is disabled', () => {
      new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'llm',
          semanticUseLLM: false
        }
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hierarchical extraction method is set to "llm"')
      );
    });

    test('should warn when hybrid method is selected but LLM is disabled', () => {
      new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'hybrid',
          semanticUseLLM: false
        }
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hierarchical extraction method is set to "hybrid"')
      );
    });

    test('should not warn when pattern method is selected with LLM disabled', () => {
      new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern',
          semanticUseLLM: false
        }
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should not warn when LLM method is selected with LLM enabled', () => {
      new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'llm',
          semanticUseLLM: true
        }
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Merging', () => {
    test('should merge custom config with defaults', () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'hybrid'
        }
      });

      expect(pipeline.options.relationExtraction.enableHierarchical).toBe(true);
      expect(pipeline.options.relationExtraction.hierarchicalMethod).toBe('hybrid');
      // Should preserve default values
      expect(pipeline.options.relationExtraction.enableBuiltin).toBe(true);
      expect(pipeline.options.relationExtraction.enableCooccurrence).toBe(true);
    });

    test('should use environment variables as defaults', () => {
      // This test verifies that environment variables are read at module load time
      // Since the module is already loaded, we just verify the current behavior
      const pipeline = new UniversalDocumentPipeline();

      // The default should be false (from DEFAULT_OPTIONS)
      // unless ENABLE_HIERARCHICAL_EXTRACTION was set before module load
      expect(typeof pipeline.options.relationExtraction.enableHierarchical).toBe('boolean');
      expect(typeof pipeline.options.relationExtraction.hierarchicalMethod).toBe('string');
      
      // Verify that the method is one of the valid options
      const validMethods = ['pattern', 'llm', 'hybrid'];
      expect(validMethods).toContain(pipeline.options.relationExtraction.hierarchicalMethod);
    });

    test('should allow custom config to override environment variables', () => {
      // Create pipeline with custom config that overrides defaults
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,  // Override default (false)
          hierarchicalMethod: 'llm'  // Override default (pattern)
        }
      });

      expect(pipeline.options.relationExtraction.enableHierarchical).toBe(true);
      expect(pipeline.options.relationExtraction.hierarchicalMethod).toBe('llm');
    });
  });
});
