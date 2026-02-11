/**
 * Unit tests for PromptBuilder
 */

const PromptBuilder = require('./prompt_builder');

describe('PromptBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  describe('buildEntityExtractionPrompt', () => {
    test('should generate Chinese prompt by default', () => {
      const text = '这是一个测试文档';
      const prompt = builder.buildEntityExtractionPrompt(text);

      expect(prompt).toContain('语义概念');
      expect(prompt).toContain('镜头实体');
      expect(prompt).toContain('待分析文档');
      expect(prompt).toContain(text);
    });

    test('should generate English prompt when language is en', () => {
      const text = 'This is a test document';
      const prompt = builder.buildEntityExtractionPrompt(text, { language: 'en' });

      expect(prompt).toContain('Semantic Concepts');
      expect(prompt).toContain('Lens Entities');
      expect(prompt).toContain('Document to Analyze');
      expect(prompt).toContain(text);
    });

    test('should include few-shot examples by default', () => {
      const text = '测试文档';
      const prompt = builder.buildEntityExtractionPrompt(text);

      expect(prompt).toContain('示例');
      expect(prompt).toContain('SEL35F18F');
    });

    test('should include algorithm results in context', () => {
      const text = '测试文档';
      const context = {
        algorithmResults: [
          { name: '焦距', value: '35mm' },
          { name: '光圈', value: 'F1.8' }
        ]
      };
      const prompt = builder.buildEntityExtractionPrompt(text, context);

      expect(prompt).toContain('已提取的数值参数');
      expect(prompt).toContain('焦距');
      expect(prompt).toContain('35mm');
    });

    test('should include JSON schema in prompt', () => {
      const text = '测试文档';
      const prompt = builder.buildEntityExtractionPrompt(text);

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('entities');
      expect(prompt).toContain('type');
      expect(prompt).toContain('confidence');
    });
  });

  describe('buildRelationExtractionPrompt', () => {
    test('should generate Chinese relation prompt', () => {
      const entities = [
        { name: 'SEL35F18F', type: 'lens' },
        { name: '街拍', type: 'technique' }
      ];
      const text = '测试文档';
      const prompt = builder.buildRelationExtractionPrompt(entities, text);

      expect(prompt).toContain('关系提取');
      expect(prompt).toContain('SEL35F18F');
      expect(prompt).toContain('街拍');
      expect(prompt).toContain('suitable_for');
      expect(prompt).toContain('recommended_for');
    });

    test('should generate English relation prompt when language is en', () => {
      builder.setLanguage('en');
      const entities = [
        { name: 'SEL35F18F', type: 'lens' },
        { name: 'street photography', type: 'technique' }
      ];
      const text = 'Test document';
      const prompt = builder.buildRelationExtractionPrompt(entities, text);

      expect(prompt).toContain('relation extraction');
      expect(prompt).toContain('SEL35F18F');
      expect(prompt).toContain('street photography');
      expect(prompt).toContain('suitable_for');
    });

    test('should include all entities in prompt', () => {
      const entities = [
        { name: 'Entity1', type: 'lens' },
        { name: 'Entity2', type: 'technique' },
        { name: 'Entity3', type: 'scene' }
      ];
      const text = '测试';
      const prompt = builder.buildRelationExtractionPrompt(entities, text);

      entities.forEach(entity => {
        expect(prompt).toContain(entity.name);
      });
    });
  });

  describe('setLanguage', () => {
    test('should change prompt language', () => {
      builder.setLanguage('en');
      const text = 'Test';
      const prompt = builder.buildEntityExtractionPrompt(text);

      expect(prompt).toContain('Semantic Concepts');
      expect(prompt).not.toContain('语义概念');
    });
  });

  describe('setIncludeExamples', () => {
    test('should disable few-shot examples', () => {
      builder.setIncludeExamples(false);
      const text = '测试';
      const prompt = builder.buildEntityExtractionPrompt(text);

      expect(prompt).not.toContain('示例');
      expect(prompt).not.toContain('Example');
    });

    test('should enable few-shot examples', () => {
      builder.setIncludeExamples(true);
      const text = '测试';
      const prompt = builder.buildEntityExtractionPrompt(text);

      expect(prompt).toContain('示例');
    });
  });

  describe('Constructor options', () => {
    test('should accept language option', () => {
      const enBuilder = new PromptBuilder({ language: 'en' });
      const prompt = enBuilder.buildEntityExtractionPrompt('Test');

      expect(prompt).toContain('Semantic Concepts');
    });

    test('should accept includeExamples option', () => {
      const noExamplesBuilder = new PromptBuilder({ includeExamples: false });
      const prompt = noExamplesBuilder.buildEntityExtractionPrompt('测试');

      expect(prompt).not.toContain('示例');
    });
  });
});
