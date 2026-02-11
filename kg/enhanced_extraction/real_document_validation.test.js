/**
 * Real Document Validation Tests
 * 
 * Tests the LLM-enhanced entity extraction system with real documents
 * to validate Requirements 7.1-7.4 (real-world extraction quality)
 */

const fs = require('fs');
const path = require('path');
const ExtractionCoordinator = require('./extraction_coordinator');
const Configuration = require('./configuration');

describe('Real Document Validation - 摄影课.md', () => {
  let coordinator;
  let photographyDocument;

  beforeAll(() => {
    // Load the real photography course document
    const docPath = path.join(__dirname, '../../摄影课.md');
    photographyDocument = fs.readFileSync(docPath, 'utf-8');

    // Configure the extraction coordinator with LLM enabled
    const config = new Configuration({
      llm: {
        enabled: true,
        model: 'qwen-plus',
        apiKey: process.env.DASHSCOPE_API_KEY || 'sk-43c76462bfad4a57bd2420c7fdb0aec4',
        timeout: 10000,
        maxRetries: 3
      },
      algorithm: {
        enabled: true
      },
      performance: {
        enableCache: true
      }
    });

    coordinator = new ExtractionCoordinator(config);
  });

  describe('Requirement 7.1: Extract at least 4 lens entities', () => {
    test('should extract SEL35F18F, SEL50F18F, SEL55F18Z, and SEL85F18', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Find lens entities
      const lensEntities = result.entities.filter(e => 
        e.type === 'lens' || 
        e.name.includes('SEL') ||
        (e.properties && (e.properties.focalLength || e.properties.maxAperture))
      );

      // Should have at least 4 lens entities
      expect(lensEntities.length).toBeGreaterThanOrEqual(4);

      // Verify specific lenses are extracted
      const lensNames = lensEntities.map(e => e.name);
      expect(lensNames).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/SEL35F18F/i),
          expect.stringMatching(/SEL50F18F/i),
          expect.stringMatching(/SEL55F18Z/i),
          expect.stringMatching(/SEL85F18/i)
        ])
      );
    });

    test('each lens entity should have required properties', async () => {
      const result = await coordinator.extract(photographyDocument);
      const lensEntities = result.entities.filter(e => 
        e.type === 'lens' || e.name.includes('SEL')
      );

      lensEntities.forEach(lens => {
        // Each lens should have properties object
        expect(lens.properties).toBeDefined();
        
        // Should have focal length (from name or properties)
        const hasFocalLength = 
          lens.properties.focalLength || 
          lens.name.match(/\d+\s*mm/i);
        expect(hasFocalLength).toBeTruthy();

        // Should have max aperture (from name or properties)
        const hasAperture = 
          lens.properties.maxAperture || 
          lens.name.match(/F\d+\.?\d*/i);
        expect(hasAperture).toBeTruthy();
      });
    });
  });

  describe('Requirement 7.2: Extract at least 3 technique entities', () => {
    test('should extract photography techniques', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Find technique entities
      const techniqueEntities = result.entities.filter(e => 
        e.type === 'technique' || 
        e.type === 'concept' ||
        e.name.includes('构图') ||
        e.name.includes('逆光') ||
        e.name.includes('虚化')
      );

      // Should have at least 3 technique entities
      expect(techniqueEntities.length).toBeGreaterThanOrEqual(3);

      // Verify specific techniques are extracted
      const techniqueNames = techniqueEntities.map(e => e.name.toLowerCase());
      const hasThreePartRule = techniqueNames.some(n => 
        n.includes('三分法') || n.includes('three')
      );
      const hasBacklight = techniqueNames.some(n => 
        n.includes('逆光') || n.includes('backlight')
      );
      const hasBlur = techniqueNames.some(n => 
        n.includes('虚化') || n.includes('blur') || n.includes('bokeh')
      );

      // At least 2 of the 3 main techniques should be found
      const foundCount = [hasThreePartRule, hasBacklight, hasBlur].filter(Boolean).length;
      expect(foundCount).toBeGreaterThanOrEqual(2);
    });

    test('technique entities should have descriptions', async () => {
      const result = await coordinator.extract(photographyDocument);
      const techniqueEntities = result.entities.filter(e => 
        e.type === 'technique' || e.type === 'concept'
      );

      // At least some techniques should have descriptions
      const withDescriptions = techniqueEntities.filter(t => 
        t.properties?.description || t.properties?.method
      );
      
      expect(withDescriptions.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement 7.3: Generate at least 10 semantic relations', () => {
    test('should extract semantic relations between entities', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Filter for semantic relations (not just co-occurrence)
      const semanticRelations = result.relations.filter(r => 
        r.type !== 'co_occurrence' &&
        r.source === 'llm'
      );

      // Should have at least 10 semantic relations
      expect(semanticRelations.length).toBeGreaterThanOrEqual(10);
    });

    test('relations should have valid types', async () => {
      const result = await coordinator.extract(photographyDocument);
      const semanticRelations = result.relations.filter(r => r.source === 'llm');

      const validTypes = [
        'suitable_for',
        'recommended_for',
        'applies_to',
        'affects',
        'used_in',
        '适用于',
        '推荐用于',
        '应用于',
        '影响'
      ];

      semanticRelations.forEach(relation => {
        const hasValidType = validTypes.some(type => 
          relation.type.toLowerCase().includes(type.toLowerCase())
        );
        expect(hasValidType).toBeTruthy();
      });
    });

    test('relations should connect extracted entities', async () => {
      const result = await coordinator.extract(photographyDocument);
      const entityNames = result.entities.map(e => e.name);
      const semanticRelations = result.relations.filter(r => r.source === 'llm');

      semanticRelations.forEach(relation => {
        // Source and target should reference actual entities
        const sourceExists = entityNames.some(name => 
          relation.source.includes(name) || name.includes(relation.source)
        );
        const targetExists = entityNames.some(name => 
          relation.target.includes(name) || name.includes(relation.target)
        );

        // At least one should match (some relations may use partial names)
        expect(sourceExists || targetExists).toBeTruthy();
      });
    });
  });

  describe('Requirement 7.4: Lens entities include complete descriptions', () => {
    test('lens entities should have descriptions', async () => {
      const result = await coordinator.extract(photographyDocument);
      const lensEntities = result.entities.filter(e => 
        e.type === 'lens' || e.name.includes('SEL')
      );

      // At least 3 out of 4 lenses should have descriptions
      const withDescriptions = lensEntities.filter(lens => 
        lens.properties?.description && 
        lens.properties.description.length > 10
      );

      expect(withDescriptions.length).toBeGreaterThanOrEqual(3);
    });

    test('lens descriptions should mention suitable scenes or use cases', async () => {
      const result = await coordinator.extract(photographyDocument);
      const lensEntities = result.entities.filter(e => 
        e.type === 'lens' || e.name.includes('SEL')
      );

      // At least some lenses should have suitable scenes
      const withScenes = lensEntities.filter(lens => 
        lens.properties?.suitableScenes?.length > 0 ||
        (lens.properties?.description && (
          lens.properties.description.includes('适合') ||
          lens.properties.description.includes('用于') ||
          lens.properties.description.includes('suitable') ||
          lens.properties.description.includes('for')
        ))
      );

      expect(withScenes.length).toBeGreaterThan(0);
    });
  });

  describe('Overall extraction quality', () => {
    test('should successfully process the document', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Should complete successfully or with partial success
      expect(['success', 'partial_success']).toContain(result.metadata.status);
    });

    test('should extract both algorithm and LLM results', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Should have entities from both sources
      const algorithmEntities = result.entities.filter(e => e.source === 'algorithm');
      const llmEntities = result.entities.filter(e => e.source === 'llm');

      expect(algorithmEntities.length).toBeGreaterThan(0);
      expect(llmEntities.length).toBeGreaterThan(0);
    });

    test('should include quality metrics', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Should have quality report
      expect(result.quality).toBeDefined();
      expect(result.quality.entityCompleteness).toBeGreaterThan(0);
      expect(result.quality.averageConfidence).toBeGreaterThan(0);
    });

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await coordinator.extract(photographyDocument);
      const duration = Date.now() - startTime;

      // Should complete within 15 seconds (allowing for LLM latency)
      expect(duration).toBeLessThan(15000);
    });
  });

  describe('Chinese language support (Requirement 6.1)', () => {
    test('should preserve Chinese entity names', async () => {
      const result = await coordinator.extract(photographyDocument);

      // Should have Chinese entity names
      const chineseEntities = result.entities.filter(e => 
        /[\u4e00-\u9fa5]/.test(e.name)
      );

      expect(chineseEntities.length).toBeGreaterThan(0);
    });

    test('should extract Chinese technique names', async () => {
      const result = await coordinator.extract(photographyDocument);

      const chineseTechniques = result.entities.filter(e => 
        (e.type === 'technique' || e.type === 'concept') &&
        /[\u4e00-\u9fa5]/.test(e.name)
      );

      // Should find Chinese techniques like "三分法", "逆光"
      expect(chineseTechniques.length).toBeGreaterThan(0);
    });
  });
});
