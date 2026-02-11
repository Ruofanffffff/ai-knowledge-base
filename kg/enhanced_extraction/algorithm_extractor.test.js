/**
 * Unit tests for AlgorithmExtractor
 */

const AlgorithmExtractor = require('./algorithm_extractor');
const { EXTRACTION_SOURCES, ENTITY_TYPES } = require('./constants');

describe('AlgorithmExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new AlgorithmExtractor();
  });

  describe('extract', () => {
    test('should extract numerical parameters from text', async () => {
      const text = `
        焦距: 35mm
        光圈: F1.8
        快门速度: 1/125s
        ISO: 400
      `;

      const result = await extractor.extract(text);

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('relations');
      expect(result).toHaveProperty('metadata');
      
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.relations).toEqual([]); // Algorithm doesn't extract relations
      
      // Check that all entities have algorithm source
      result.entities.forEach(entity => {
        expect(entity.source).toBe(EXTRACTION_SOURCES.ALGORITHM);
        expect(entity.confidence).toBe(1.0);
      });
    });

    test('should standardize output format', async () => {
      const text = '焦距: 50mm\n光圈: F1.8\nISO: 400';
      const result = await extractor.extract(text);

      // May extract 0 or more entities depending on the text
      expect(Array.isArray(result.entities)).toBe(true);
      
      if (result.entities.length > 0) {
        const entity = result.entities[0];
        expect(entity).toHaveProperty('id');
        expect(entity).toHaveProperty('type');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('properties');
        expect(entity).toHaveProperty('confidence');
        expect(entity).toHaveProperty('source');
        expect(entity).toHaveProperty('metadata');
      }
    });

    test('should add source marker as algorithm', async () => {
      const text = '光圈: F2.8';
      const result = await extractor.extract(text);

      result.entities.forEach(entity => {
        expect(entity.source).toBe(EXTRACTION_SOURCES.ALGORITHM);
      });
    });

    test('should handle empty text', async () => {
      const result = await extractor.extract('');

      expect(result.entities).toEqual([]);
      expect(result.metadata.status).toBe('failed'); // Empty text is invalid
      expect(result.metadata.parametersFound).toBe(0);
    });

    test('should handle extraction errors gracefully', async () => {
      // Pass invalid input to trigger error
      const result = await extractor.extract(null);

      expect(result.entities).toEqual([]);
      expect(result.metadata.status).toBe('failed');
      expect(result.metadata).toHaveProperty('error');
    });

    test('should record extraction time', async () => {
      const text = '焦距: 35mm\n光圈: F1.8\nISO: 400';
      const result = await extractor.extract(text);

      expect(result.metadata).toHaveProperty('extractionTime');
      expect(result.metadata).toHaveProperty('algorithmTime');
      expect(result.metadata.extractionTime).toBeGreaterThanOrEqual(1);
      expect(result.metadata.algorithmTime).toBeGreaterThanOrEqual(1);
    });

    test('should extract structured data with key-value pairs', async () => {
      const text = `
        镜头型号: SEL35F18F
        焦距: 35mm
        最大光圈: F1.8
        重量: 280g
      `;

      const result = await extractor.extract(text);

      expect(result.entities.length).toBeGreaterThan(0);
      
      // Check that entities have proper structure
      result.entities.forEach(entity => {
        expect(entity.properties).toHaveProperty('value');
        expect(entity.source).toBe(EXTRACTION_SOURCES.ALGORITHM);
      });
    });

    test('should handle mixed Chinese and English text', async () => {
      const text = `
        Focal Length: 50mm
        焦距: 50mm
        Aperture: F1.4
        光圈: F1.4
      `;

      const result = await extractor.extract(text);

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.metadata.status).toBe('success');
    });
  });

  describe('getMetadata', () => {
    test('should return extractor metadata', () => {
      const metadata = extractor.getMetadata();

      expect(metadata).toHaveProperty('name', 'AlgorithmExtractor');
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('type', 'algorithm');
      expect(metadata).toHaveProperty('capabilities');
      expect(metadata).toHaveProperty('accuracy', 1.0);
      
      expect(Array.isArray(metadata.capabilities)).toBe(true);
      expect(metadata.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Type Determination', () => {
    test('should identify numerical parameters', async () => {
      const text = `
        焦距: 35mm
        ISO: 400
        快门: 1/125s
      `;

      const result = await extractor.extract(text);

      // Most photography parameters should be NUMERICAL_PARAMETER type
      const numericalParams = result.entities.filter(
        e => e.type === ENTITY_TYPES.NUMERICAL_PARAMETER
      );
      
      expect(numericalParams.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Scores', () => {
    test('should set confidence to 1.0 for all algorithm extractions', async () => {
      const text = `
        焦距: 35mm
        光圈: F1.8
        ISO: 400
      `;

      const result = await extractor.extract(text);

      result.entities.forEach(entity => {
        expect(entity.confidence).toBe(1.0);
      });
    });
  });
});
