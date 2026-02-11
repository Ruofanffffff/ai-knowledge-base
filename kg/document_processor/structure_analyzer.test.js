/**
 * Unit Tests for Structure Analyzer
 * Tests document structure analysis for Word, PDF, Excel, and Markdown files
 * 
 * Requirements tested: 1.1, 1.2, 1.3, 1.4, 1.9, 1.10
 */

const fs = require('fs');
const path = require('path');
const {
  analyzeMarkdownDocument,
  countStructuralUnits,
  extractHierarchy
} = require('./structure_analyzer');

// Mock Prisma client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      documentStructure: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' })
      }
    }))
  };
});

describe('Structure Analyzer - Unit Tests', () => {
  
  describe('analyzeMarkdownDocument', () => {
    const testDocId = 'test-doc-123';
    let tempFilePath;

    afterEach(() => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    it('should parse Markdown headings correctly', async () => {
      const content = '# Heading 1\n\n## Heading 2\n\n### Heading 3\n\nParagraph text';
      tempFilePath = path.join(__dirname, 'test-headings.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      expect(result).toBeDefined();
      expect(result.doc_id).toBe(testDocId);
      expect(result.file_type).toBe('markdown');
      expect(result.total_units).toBeGreaterThan(0);
      
      const headings = result.units.filter(u => u.type === 'heading');
      expect(headings.length).toBe(3);
      expect(headings[0].level).toBe(1);
      expect(headings[1].level).toBe(2);
      expect(headings[2].level).toBe(3);
    });

    it('should parse Markdown paragraphs correctly', async () => {
      const content = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
      tempFilePath = path.join(__dirname, 'test-paragraphs.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      const paragraphs = result.units.filter(u => u.type === 'paragraph');
      expect(paragraphs.length).toBe(3);
      expect(paragraphs[0].content).toContain('Paragraph 1');
      expect(paragraphs[1].content).toContain('Paragraph 2');
      expect(paragraphs[2].content).toContain('Paragraph 3');
    });

    it('should parse Markdown list items correctly', async () => {
      const content = '- Item 1\n- Item 2\n- Item 3\n\n1. Numbered 1\n2. Numbered 2';
      tempFilePath = path.join(__dirname, 'test-lists.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      const listItems = result.units.filter(u => u.type === 'list_item');
      expect(listItems.length).toBeGreaterThanOrEqual(5);
    });

    it('should parse Markdown code blocks correctly', async () => {
      const content = '```javascript\nconst x = 1;\nconsole.log(x);\n```\n\nSome text\n\n```python\nprint("hello")\n```';
      tempFilePath = path.join(__dirname, 'test-code.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      const codeBlocks = result.units.filter(u => u.type === 'code_block');
      expect(codeBlocks.length).toBe(2);
      expect(codeBlocks[0].content).toContain('const x = 1');
      expect(codeBlocks[1].content).toContain('print');
    });

    it('should build correct hierarchy tree', async () => {
      const content = '# H1\n\nParagraph under H1\n\n## H2\n\nParagraph under H2\n\n### H3\n\nParagraph under H3';
      tempFilePath = path.join(__dirname, 'test-hierarchy.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.root).toBeDefined();
      expect(result.hierarchy.root.type).toBe('document');
      expect(result.hierarchy.root.children.length).toBeGreaterThan(0);
    });

    it('should handle empty Markdown document', async () => {
      const content = '';
      tempFilePath = path.join(__dirname, 'test-empty.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      expect(result.total_units).toBe(0);
      expect(result.units).toHaveLength(0);
    });

    it('should handle Markdown with only whitespace', async () => {
      const content = '\n\n   \n\t\n  ';
      tempFilePath = path.join(__dirname, 'test-whitespace.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      expect(result.total_units).toBe(0);
    });

    it('should assign correct parent_id to nested elements', async () => {
      const content = '# Main\n\nParagraph 1\n\n## Sub\n\nParagraph 2';
      tempFilePath = path.join(__dirname, 'test-parents.md');
      fs.writeFileSync(tempFilePath, content);

      const result = await analyzeMarkdownDocument(testDocId, tempFilePath);

      const mainHeading = result.units.find(u => u.content === 'Main');
      const subHeading = result.units.find(u => u.content === 'Sub');
      const para2 = result.units.find(u => u.content === 'Paragraph 2');

      expect(mainHeading).toBeDefined();
      expect(subHeading.parent_id).toBe(mainHeading.unit_id);
      expect(para2.parent_id).toBe(subHeading.unit_id);
    });
  });

  describe('countStructuralUnits', () => {
    it('should count non-empty units', () => {
      const structure = {
        units: [
          { content: 'Text 1', is_empty: false },
          { content: '', is_empty: true },
          { content: 'Text 2', is_empty: false },
          { content: '   ', is_empty: true }
        ]
      };

      const count = countStructuralUnits(structure);
      expect(count).toBe(2);
    });

    it('should return 0 for empty units array', () => {
      const structure = { units: [] };
      const count = countStructuralUnits(structure);
      expect(count).toBe(0);
    });

    it('should exclude all empty units', () => {
      const structure = {
        units: [
          { content: '', is_empty: true },
          { content: '   ', is_empty: true },
          { content: '\n\n', is_empty: true }
        ]
      };

      const count = countStructuralUnits(structure);
      expect(count).toBe(0);
    });
  });

  describe('extractHierarchy', () => {
    it('should extract hierarchy tree from structure', () => {
      const structure = {
        hierarchy: {
          root: {
            unit_id: 'root',
            type: 'document',
            children: [
              { unit_id: 'h1', type: 'heading', children: [] }
            ]
          }
        }
      };

      const hierarchy = extractHierarchy(structure);
      
      expect(hierarchy).toBeDefined();
      expect(hierarchy.root).toBeDefined();
      expect(hierarchy.root.type).toBe('document');
      expect(hierarchy.root.children.length).toBe(1);
    });

    it('should handle empty hierarchy', () => {
      const structure = {
        hierarchy: {
          root: {
            unit_id: 'root',
            type: 'document',
            children: []
          }
        }
      };

      const hierarchy = extractHierarchy(structure);
      
      expect(hierarchy.root.children).toHaveLength(0);
    });
  });
});
