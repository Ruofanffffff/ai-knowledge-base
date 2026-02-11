/**
 * Property-Based Tests for Structure Analyzer
 * 
 * Property 1: 文档结构单元完整识别
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * For any document, all structural units must be identified and counted correctly.
 * No structural units should be lost during parsing.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const { analyzeMarkdownDocument, countStructuralUnits } = require('./structure_analyzer');

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

describe('Structure Analyzer - Property-Based Tests', () => {
  
  /**
   * Property 1: 文档结构单元完整识别
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   * 
   * For any Markdown document:
   * 1. All headings should be identified
   * 2. All paragraphs should be identified
   * 3. All list items should be identified
   * 4. All code blocks should be identified
   * 5. Total units count should match the sum of all unit types
   */
  describe('Property 1: Complete Structural Unit Identification', () => {
    
    it('should identify all headings in any Markdown document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 10 }),
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          async (levels, contents) => {
            // Generate Markdown with headings
            const headings = levels.map((level, i) => {
              const hashes = '#'.repeat(level);
              const content = contents[i % contents.length];
              return `${hashes} ${content}`;
            });
            
            const markdown = headings.join('\n\n');
            const tempFile = path.join(__dirname, `test-prop1-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              const identifiedHeadings = result.units.filter(u => u.type === 'heading');
              
              // Property: All headings must be identified
              expect(identifiedHeadings.length).toBe(levels.length);
              
              // Property: Each heading must have correct level
              identifiedHeadings.forEach((heading, i) => {
                expect(heading.level).toBe(levels[i]);
              });
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify all paragraphs in any Markdown document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 10, maxLength: 200 })
              .filter(s => {
                const trimmed = s.trim();
                // Filter out empty, heading-like, list-like, or code-like strings
                return trimmed.length > 0 && 
                       !trimmed.startsWith('#') &&
                       !trimmed.match(/^[\*\-\+\d\.]\s/) &&
                       !trimmed.startsWith('```');
              }),
            { minLength: 1, maxLength: 20 }
          ),
          async (paragraphs) => {
            const markdown = paragraphs.join('\n\n');
            const tempFile = path.join(__dirname, `test-prop1-para-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              const identifiedParagraphs = result.units.filter(u => u.type === 'paragraph');
              
              // Property: All non-empty paragraphs must be identified
              expect(identifiedParagraphs.length).toBe(paragraphs.length);
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify all list items in any Markdown document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 15 }),
          fc.constantFrom('- ', '* ', '+ ', '1. ', '2. ', '3. '),
          async (items, prefix) => {
            const markdown = items.map(item => `${prefix}${item}`).join('\n');
            const tempFile = path.join(__dirname, `test-prop1-list-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              const identifiedListItems = result.units.filter(u => u.type === 'list_item');
              
              // Property: All list items must be identified
              expect(identifiedListItems.length).toBe(items.length);
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify all code blocks in any Markdown document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          fc.constantFrom('javascript', 'python', 'java', 'cpp', ''),
          async (codeSnippets, language) => {
            const codeBlocks = codeSnippets.map(code => 
              `\`\`\`${language}\n${code}\n\`\`\``
            );
            const markdown = codeBlocks.join('\n\n');
            const tempFile = path.join(__dirname, `test-prop1-code-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              const identifiedCodeBlocks = result.units.filter(u => u.type === 'code_block');
              
              // Property: All code blocks must be identified
              expect(identifiedCodeBlocks.length).toBe(codeSnippets.length);
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should count total units correctly for any document structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            headings: fc.array(fc.tuple(fc.integer({ min: 1, max: 6 }), fc.string({ minLength: 5, maxLength: 30 })), { maxLength: 5 }),
            paragraphs: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { maxLength: 10 }),
            listItems: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { maxLength: 8 }),
            codeBlocks: fc.array(fc.string({ minLength: 10, maxLength: 80 }), { maxLength: 3 })
          }),
          async ({ headings, paragraphs, listItems, codeBlocks }) => {
            // Build complex Markdown document
            const parts = [];
            
            headings.forEach(([level, content]) => {
              parts.push(`${'#'.repeat(level)} ${content}`);
            });
            
            paragraphs.forEach(para => {
              parts.push(para);
            });
            
            listItems.forEach(item => {
              parts.push(`- ${item}`);
            });
            
            codeBlocks.forEach(code => {
              parts.push(`\`\`\`\n${code}\n\`\`\``);
            });
            
            const markdown = parts.join('\n\n');
            const tempFile = path.join(__dirname, `test-prop1-total-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              const expectedTotal = headings.length + paragraphs.length + listItems.length + codeBlocks.length;
              
              // Property: Total units must equal sum of all unit types
              expect(result.total_units).toBe(expectedTotal);
              expect(result.units.length).toBe(expectedTotal);
              
              // Property: countStructuralUnits should return same count
              const counted = countStructuralUnits(result);
              expect(counted).toBe(expectedTotal);
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all unit content without loss', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 20, maxLength: 100 })
              .filter(s => {
                const trimmed = s.trim();
                return trimmed.length > 5 && 
                       !trimmed.startsWith('#') &&
                       !trimmed.match(/^[\*\-\+\d\.]\s/) &&
                       !trimmed.startsWith('```');
              }),
            { minLength: 3, maxLength: 10 }
          ),
          async (contents) => {
            const markdown = contents.join('\n\n');
            const tempFile = path.join(__dirname, `test-prop1-content-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              // Property: All original non-empty content must be preserved in units (trimmed)
              const allUnitContent = result.units.map(u => u.content).join('\n');
              
              contents.forEach(originalContent => {
                // Content is trimmed during parsing
                expect(allUnitContent).toContain(originalContent.trim());
              });
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should build hierarchy tree with all units represented', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.integer({ min: 1, max: 3 }),
              fc.string({ minLength: 5, maxLength: 30 })
            ),
            { minLength: 2, maxLength: 8 }
          ),
          async (headingsData) => {
            const markdown = headingsData
              .map(([level, content]) => `${'#'.repeat(level)} ${content}`)
              .join('\n\n');
            
            const tempFile = path.join(__dirname, `test-prop1-hierarchy-${Date.now()}.md`);
            
            try {
              fs.writeFileSync(tempFile, markdown);
              const result = await analyzeMarkdownDocument('test-doc', tempFile);
              
              // Property: All units must appear in hierarchy tree
              const unitsInHierarchy = new Set();
              
              function collectUnits(node) {
                if (node.unit_id && node.unit_id !== 'root') {
                  unitsInHierarchy.add(node.unit_id);
                }
                if (node.children) {
                  node.children.forEach(collectUnits);
                }
              }
              
              collectUnits(result.hierarchy.root);
              
              // All units should be in hierarchy
              result.units.forEach(unit => {
                expect(unitsInHierarchy.has(unit.unit_id)).toBe(true);
              });
              
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
