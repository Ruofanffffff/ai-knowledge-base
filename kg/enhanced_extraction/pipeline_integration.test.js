/**
 * Tests for Pipeline Integration
 */

const { 
  EnhancedExtractionAdapter, 
  createEnhancedExtractor, 
  isEnhancedExtractionAvailable 
} = require('./pipeline_integration');

describe('Pipeline Integration', () => {
  describe('isEnhancedExtractionAvailable', () => {
    it('should return true when modules are available', () => {
      const available = isEnhancedExtractionAvailable();
      expect(available).toBe(true);
    });
  });
  
  describe('createEnhancedExtractor', () => {
    it('should create an adapter instance', () => {
      const adapter = createEnhancedExtractor({
        llm: {
          enabled: false,
          apiKey: 'test-key'
        }
      });
      expect(adapter).toBeInstanceOf(EnhancedExtractionAdapter);
    });
    
    it('should accept configuration options', () => {
      const adapter = createEnhancedExtractor({
        enabled: true,
        llm: {
          enabled: false,
          apiKey: 'test-key'
        }
      });
      expect(adapter).toBeInstanceOf(EnhancedExtractionAdapter);
      expect(adapter.enabled).toBe(true);
    });
  });
  
  describe('EnhancedExtractionAdapter', () => {
    let adapter;
    
    beforeEach(() => {
      adapter = new EnhancedExtractionAdapter({
        llm: {
          enabled: false,
          apiKey: 'test-key'
        },
        algorithm: {
          enabled: true
        }
      });
    });
    
    describe('constructor', () => {
      it('should create adapter with default enabled state', () => {
        const adapter = new EnhancedExtractionAdapter({
          llm: { enabled: false, apiKey: 'test-key' }
        });
        expect(adapter.enabled).toBe(true);
      });
      
      it('should respect enabled option', () => {
        const adapter = new EnhancedExtractionAdapter({ 
          enabled: false,
          llm: { enabled: false, apiKey: 'test-key' }
        });
        expect(adapter.enabled).toBe(false);
      });
      
      it('should create coordinator instance', () => {
        expect(adapter.coordinator).toBeDefined();
      });
    });
    
    describe('extractFields', () => {
      it('should throw error when disabled', async () => {
        const disabledAdapter = new EnhancedExtractionAdapter({ 
          enabled: false,
          llm: { enabled: false, apiKey: 'test-key' }
        });
        const ckb = {
          content: { text: 'Test document' }
        };
        
        await expect(disabledAdapter.extractFields(ckb)).rejects.toThrow('Enhanced extraction is disabled');
      });
      
      it('should throw error when document text is empty', async () => {
        const ckb = {
          content: { text: '' }
        };
        
        await expect(adapter.extractFields(ckb)).rejects.toThrow('Document text is empty');
      });
      
      it('should extract fields from CKB', async () => {
        const ckb = {
          content: {
            text: '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s'
          }
        };
        
        const fields = await adapter.extractFields(ckb);
        
        expect(Array.isArray(fields)).toBe(true);
        expect(fields.length).toBeGreaterThan(0);
      });
      
      it('should handle CKB with direct content string', async () => {
        const ckb = {
          content: '焦距: 35mm, 光圈: F1.8'
        };
        
        const fields = await adapter.extractFields(ckb);
        
        expect(Array.isArray(fields)).toBe(true);
      });
      
      it('should pass extraction options to coordinator', async () => {
        const ckb = {
          content: { text: '焦距: 35mm' }
        };
        
        const options = {
          useLLM: false,
          useAlgorithm: true,
          timeout: 3000,
          language: 'zh'
        };
        
        const fields = await adapter.extractFields(ckb, options);
        
        expect(Array.isArray(fields)).toBe(true);
      });
      
      it('should convert entities to fields', async () => {
        const ckb = {
          content: { text: '焦距: 35mm, 光圈: F1.8' }
        };
        
        const fields = await adapter.extractFields(ckb);
        
        // Check field structure
        fields.forEach(field => {
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('value');
          expect(field).toHaveProperty('confidence');
          expect(field).toHaveProperty('source');
          expect(field).toHaveProperty('type');
        });
      });
      
      it('should include entity metadata in fields', async () => {
        const ckb = {
          content: { text: '焦距: 35mm' }
        };
        
        const fields = await adapter.extractFields(ckb);
        
        const entityFields = fields.filter(f => f.type === 'entity');
        if (entityFields.length > 0) {
          expect(entityFields[0].metadata).toHaveProperty('entityId');
          expect(entityFields[0].metadata).toHaveProperty('entityType');
        }
      });
    });
    
    describe('_convertToFields', () => {
      it('should convert extraction result to fields', () => {
        const result = {
          entities: [
            {
              id: 'entity-1',
              type: 'lens',
              name: 'SEL35F18F',
              confidence: 0.95,
              source: 'algorithm',
              properties: {
                focalLength: '35mm',
                maxAperture: 'F1.8'
              }
            }
          ],
          relations: [],
          metadata: {
            status: 'success'
          }
        };
        
        const fields = adapter._convertToFields(result);
        
        expect(Array.isArray(fields)).toBe(true);
        expect(fields.length).toBeGreaterThan(0);
        
        // Should have entity field
        const entityField = fields.find(f => f.type === 'entity');
        expect(entityField).toBeDefined();
        expect(entityField.name).toBe('lens');
        expect(entityField.value).toBe('SEL35F18F');
        
        // Should have property fields
        const propertyFields = fields.filter(f => f.type === 'property');
        expect(propertyFields.length).toBe(2);
      });
      
      it('should handle entities without properties', () => {
        const result = {
          entities: [
            {
              id: 'entity-1',
              type: 'concept',
              name: '人物肖像',
              confidence: 0.90,
              source: 'llm'
            }
          ],
          relations: [],
          metadata: {
            status: 'success'
          }
        };
        
        const fields = adapter._convertToFields(result);
        
        expect(fields.length).toBe(1);
        expect(fields[0].type).toBe('entity');
      });
      
      it('should skip null and undefined property values', () => {
        const result = {
          entities: [
            {
              id: 'entity-1',
              type: 'lens',
              name: 'Test',
              confidence: 0.90,
              source: 'algorithm',
              properties: {
                field1: 'value1',
                field2: null,
                field3: undefined,
                field4: 'value4'
              }
            }
          ],
          relations: [],
          metadata: {
            status: 'success'
          }
        };
        
        const fields = adapter._convertToFields(result);
        
        const propertyFields = fields.filter(f => f.type === 'property');
        expect(propertyFields.length).toBe(2); // Only field1 and field4
      });
    });
    
    describe('getStatistics', () => {
      it('should return statistics from coordinator', () => {
        const stats = adapter.getStatistics();
        
        expect(stats).toHaveProperty('totalExtractions');
        expect(stats).toHaveProperty('successfulExtractions');
        expect(stats).toHaveProperty('failedExtractions');
      });
    });
    
    describe('resetStatistics', () => {
      it('should reset coordinator statistics', () => {
        adapter.resetStatistics();
        
        const stats = adapter.getStatistics();
        expect(stats.totalExtractions).toBe(0);
      });
    });
  });
  
  describe('Integration with Pipeline', () => {
    it('should work as a custom extractor in pipeline options', async () => {
      const adapter = createEnhancedExtractor({
        llm: { enabled: false, apiKey: 'test-key' },
        algorithm: { enabled: true }
      });
      
      const ckb = {
        content: { text: '焦距: 35mm, 光圈: F1.8' }
      };
      
      // Simulate pipeline usage
      const customExtractor = async (ckb, options) => {
        return await adapter.extractFields(ckb, options);
      };
      
      const fields = await customExtractor(ckb, { useLLM: false });
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
  });
});
